"""Validate TrustPulse on REAL people recorded from the rider app.

Collection protocol (10 min per person):
  1. Start the server with recording on (cmd: `set TRUSTPULSE_RECORD=1`, then uvicorn).
  2. Everyone uses the SAME PIN (e.g. 2580) but their OWN rider ID (P1, P2, ...).
     Same PIN matters: we are testing "someone else typing *your* PIN".
  3. Each person logs in 15-20 times on the SAME phone, holding it naturally,
     and does a swipe-to-accept after each login if the app has one.
  4. Check progress: http://127.0.0.1:8000/recordings/summary
  5. Run:  python -m ml.real_eval

For every person A: the first --enroll logins build A's baseline. Then
  genuine  = A's remaining logins
  impostor = every other person's logins, as if typed on A's phone in A's city
Every login is scored on its own (no help from cross-session drift), so these are
conservative single-login numbers. A separate "shifts to catch" figure replays each
impostor's logins in a row to show the drift detector at work.
"""
import argparse
import copy
import json
import statistics
from collections import OrderedDict
from pathlib import Path

from app import config as C
from app import recorder
from app.engine import GROUP_LABELS, Profile, process_batch, start_session

OUT = Path(__file__).resolve().parent.parent / "data" / "real_eval.json"
T0 = 1_760_000_000  # fixed clock: same hour every day, so context stays neutral


def load_sessions(path):
    """{rider_id: [ {pin_seq, payload}, ... ]} with each session's batches merged, in order."""
    sessions = OrderedDict()
    with open(path, encoding="utf-8") as f:
        for raw in f:
            line = json.loads(raw)
            s = sessions.setdefault(line["session_id"], {"rider_id": line["rider_id"], "pin_seq": None,
                                                         "payload": {"keystrokes": [], "touches": [], "motion": []}})
            s["pin_seq"] = s["pin_seq"] or line["pin_seq"]
            for k in ("keystrokes", "touches", "motion"):
                s["payload"][k] += line["payload"].get(k) or []
    people = OrderedDict()
    for s in sessions.values():
        if s["payload"]["keystrokes"]:  # a login = a session with a PIN entry
            people.setdefault(s["rider_id"], []).append(s)
    return people


def ctx(i):
    return {"rider_id": "eval", "device_id": "eval-phone", "sim_id": "eval-sim", "city": "eval-city", "ts": T0 + i * 86400}


def enroll(sessions):
    p = Profile(rider_id="eval")
    for i, s in enumerate(sessions):
        process_batch(p, start_session(p, ctx(i)), s["payload"])
    return p


def score(profile, s, i):
    """Score one login against a COPY of the profile, so tests never change the baseline."""
    p = copy.deepcopy(profile)
    sess = start_session(p, ctx(i))
    process_batch(p, sess, s["payload"])
    return 100 * sess["risk"], {g: 100 * st["anomaly"] for g, st in sess["groups"].items()}


def shifts_to_catch(profile, sessions, start_i, threshold):
    """Impostor keeps using the account shift after shift (drift + learning live)."""
    p = copy.deepcopy(profile)
    for n, s in enumerate(sessions, 1):
        sess = start_session(p, ctx(start_i + n))
        process_batch(p, sess, s["payload"], threshold=threshold)
        if 100 * sess["risk"] >= threshold:
            return n
    return None


def eer(genuine, impostor):
    """Equal error rate: the threshold where wrongly-blocked == wrongly-allowed."""
    if not genuine or not impostor:
        return None, None
    best = (1e9, None, None)
    for t in range(0, 101):
        frr = sum(g >= t for g in genuine) / len(genuine)
        far = sum(i < t for i in impostor) / len(impostor)
        best = min(best, (abs(frr - far), t, (frr + far) / 2))
    return round(100 * best[2], 1), best[1]


def recommend_threshold(genuine, impostor, max_owner_blocked=2.0, min_owner_allowed=90.0):
    """Lowest step-up threshold where the owner is (almost) never blocked and usually
    sees no friction at all. Lowest = catches the most impostors on their first login."""
    for t in range(40, 100, 5):
        blocked = 100 * sum(g >= t for g in genuine) / len(genuine)
        allowed = 100 * sum(g < t - 30 for g in genuine) / len(genuine)
        if blocked <= max_owner_blocked and allowed >= min_owner_allowed:
            return {"threshold": t, "owner_blocked": round(blocked, 1), "owner_allowed": round(allowed, 1),
                    "impostor_stepped_up": round(100 * sum(i >= t for i in impostor) / len(impostor), 1)}
    return None


def pct(n, d):
    return round(100 * n / d, 1) if d else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--file", default=str(recorder.FILE))
    ap.add_argument("--enroll", type=int, default=10, help="logins per person used to build the baseline")
    ap.add_argument("--threshold", type=int, default=C.DEFAULT_THRESHOLD)
    args = ap.parse_args()
    T, SOFT = args.threshold, args.threshold - 30

    if not Path(args.file).exists():
        raise SystemExit(f"No recordings at {args.file}. Start the server with TRUSTPULSE_RECORD=1 and collect logins first.")
    people = load_sessions(args.file)
    need = args.enroll + 3
    ready = {rid: s for rid, s in people.items() if len(s) >= need}
    for rid, s in people.items():
        if rid not in ready:
            print(f"  skipping {rid}: only {len(s)} logins (need {need})")
    if len(ready) < 2:
        raise SystemExit("Need at least 2 people with enough logins.")
    pins = {s["pin_seq"] for ss in ready.values() for s in ss}
    if len(pins) > 1:
        print("  WARNING: people typed different PINs. Impostor numbers will look better than reality.\n")

    all_gen, all_imp, per_group = [], [], {g: ([], []) for g in GROUP_LABELS}
    rows, catches = [], []
    for rid, sessions in ready.items():
        profile = enroll(sessions[: args.enroll])
        base_i = args.enroll
        gen = [score(profile, s, base_i + k) for k, s in enumerate(sessions[args.enroll:])]
        others = [(orid, s) for orid, ss in ready.items() if orid != rid for s in ss]
        imp = [score(profile, s, base_i) for _, s in others]
        for orid, ss in ready.items():
            if orid != rid:
                catches.append(shifts_to_catch(profile, ss, base_i, T))

        g_risk, i_risk = [r for r, _ in gen], [r for r, _ in imp]
        all_gen += g_risk
        all_imp += i_risk
        for g in GROUP_LABELS:
            per_group[g][0].extend(a[g] for _, a in gen if g in a)
            per_group[g][1].extend(a[g] for _, a in imp if g in a)
        rows.append({
            "person": rid, "genuine_logins": len(g_risk), "impostor_logins": len(i_risk),
            "genuine_allowed": pct(sum(r < SOFT for r in g_risk), len(g_risk)),
            "genuine_not_blocked": pct(sum(r < T for r in g_risk), len(g_risk)),
            "impostor_flagged": pct(sum(r >= SOFT for r in i_risk), len(i_risk)),
            "impostor_stepped_up": pct(sum(r >= T for r in i_risk), len(i_risk)),
            "eer": eer(g_risk, i_risk)[0],
        })

    caught = [c for c in catches if c is not None]
    overall = {
        "people": len(ready), "genuine_logins": len(all_gen), "impostor_logins": len(all_imp),
        "genuine_allowed": pct(sum(r < SOFT for r in all_gen), len(all_gen)),
        "genuine_not_blocked": pct(sum(r < T for r in all_gen), len(all_gen)),
        "impostor_flagged": pct(sum(r >= SOFT for r in all_imp), len(all_imp)),
        "impostor_stepped_up": pct(sum(r >= T for r in all_imp), len(all_imp)),
        "eer": eer(all_gen, all_imp)[0], "eer_threshold": eer(all_gen, all_imp)[1],
        "impostors_caught_eventually": pct(len(caught), len(catches)),
        "median_shifts_to_catch": statistics.median(caught) if caught else None,
    }
    overall["recommended"] = recommend_threshold(all_gen, all_imp)
    signal_eer = {GROUP_LABELS[g]: eer(*per_group[g])[0] for g in GROUP_LABELS if per_group[g][0] and per_group[g][1]}
    OUT.write_text(json.dumps({"threshold": T, "overall": overall, "per_person": rows, "signal_eer": signal_eer}, indent=1))

    print(f"Real-human validation: {overall['people']} people, {overall['genuine_logins']} genuine + "
          f"{overall['impostor_logins']} impostor logins (threshold {T})\n")
    print(f"{'person':<12}{'owner allowed':>15}{'owner not blocked':>19}{'impostor flagged':>18}{'impostor step-up':>18}{'EER':>8}")
    for r in rows + [{"person": "OVERALL", **overall}]:
        print(f"{r['person']:<12}{r['genuine_allowed']:>14}%{r['genuine_not_blocked']:>18}%"
              f"{r['impostor_flagged']:>17}%{r['impostor_stepped_up']:>17}%{r['eer']:>7}%")
    print(f"\nSingle-login EER (lower is better): {overall['eer']}% at risk {overall['eer_threshold']}")
    print(f"Impostor keeps using the account: caught in {overall['impostors_caught_eventually']}% of cases, "
          f"median {overall['median_shifts_to_catch']} login(s)")
    print("Which signal separates people best (EER per signal, lower = better):")
    for name, e in sorted(signal_eer.items(), key=lambda kv: kv[1]):
        print(f"  {name:<16}{e}%")

    rec = overall["recommended"]
    if rec:
        print(f"\nRecommended demo threshold: {rec['threshold']}")
        print(f"  owner blocked {rec['owner_blocked']}% | owner sees no check {rec['owner_allowed']}% | "
              f"impostor stepped up on FIRST login {rec['impostor_stepped_up']}%")
        print(f"  Apply: http://127.0.0.1:8000/docs -> POST /config -> {{\"threshold\": {rec['threshold']}}} "
              f"(or the dashboard slider)")
    else:
        print("\nNo threshold keeps the owner unblocked: collect more logins per person, holding the phone naturally.")
    print(f"\nWrote {OUT}")


if __name__ == "__main__":
    main()
