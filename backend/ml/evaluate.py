"""Replay the synthetic fleet through the real engine and measure the trade-off.

Outputs data/tradeoff.json, which powers the dashboard's Strict <-> Open slider
and the comparison slide.

    python -m ml.evaluate              # 500 riders x 30 days, every threshold (4 worker processes)
    python -m ml.evaluate --riders 100 # quicker

Step-ups are simulated the way they'd play out for real: an honest rider passes the
selfie (drift reset + baseline re-learned), a renter fails it.

Policies compared:
  open_gate      verify once, never again (today's default)
  strict_gate    re-verify on EVERY login (the problem statement's strict extreme)
  context_rules  re-verify when device or city changes (typical rules engine)
  trustpulse     this engine at the chosen threshold
"""
import argparse
import json
import statistics
import time
from multiprocessing import Pool
from pathlib import Path

from app import config as C
from app.engine import Profile, process_batch, start_session, verify_identity
from ml.data_gen import generate_fleet

OUT = Path(__file__).resolve().parent.parent / "data" / "tradeoff.json"
THRESHOLDS = list(range(20, 100, 5))
_FLEET = None


def _init(riders, days):
    global _FLEET
    _FLEET = generate_fleet(riders, days)


def replay(threshold):
    rows = []
    for r in _FLEET:
        prof = Profile(rider_id=r["rider_id"], name=r["name"])
        verified_devices, verified_cities = set(), set()
        for s in r["sessions"]:
            sess = start_session(prof, dict(s["ctx"]))
            enrolling = sess["enrolling"]
            process_batch(prof, sess, s["payload"], threshold=threshold)
            dev, city = s["ctx"]["device_id"], s["ctx"]["city"]
            if enrolling:
                verified_devices.add(dev)
                verified_cities.add(city)
                continue

            # what the rider actually experiences: the engine's action, not the raw score
            flagged = sess["action"] in ("STEP_UP", "REVIEW")
            if flagged and s["label"] == "genuine":
                verify_identity(prof, sess)  # honest rider passes the selfie

            ctx_flag = dev not in verified_devices or city not in verified_cities
            if ctx_flag and s["label"] == "genuine":  # passes the re-verification, now trusted
                verified_devices.add(dev)
                verified_cities.add(city)
            rows.append({"rider": r["rider_id"], "label": s["label"], "tag": s["tag"],
                         "risk": 100 * sess["risk"], "flag": flagged, "ctx_flag": ctx_flag})
    return threshold, rows


def pct(n, d):
    return round(100 * n / d, 2) if d else 0.0


def rates(rows, flag):
    gen = [r for r in rows if r["label"] == "genuine"]
    gen_ctx = [r for r in gen if r["tag"] != "normal"]
    tko = [r for r in rows if r["label"] == "takeover"]
    tko_same = [r for r in tko if r["tag"] == "takeover_same"]

    # Account level: how many rented sessions run before the first escalation?
    by_rider = {}
    for r in tko:
        by_rider.setdefault(r["rider"], []).append(flag(r))
    caught_within = [f.index(True) + 1 if True in f else None for f in by_rider.values()]
    caught = [c for c in caught_within if c is not None]

    return {
        "false_lockout": pct(sum(map(flag, gen)), len(gen)),
        "false_lockout_life_change": pct(sum(map(flag, gen_ctx)), len(gen_ctx)),
        "honest_riders_ever_stopped": pct(len({r["rider"] for r in gen if flag(r)}), len({r["rider"] for r in gen})),
        "takeover_caught": pct(sum(map(flag, tko)), len(tko)),
        "takeover_caught_same_device": pct(sum(map(flag, tko_same)), len(tko_same)),
        "accounts_caught": pct(len(caught), len(caught_within)),
        "accounts_caught_first_session": pct(sum(c == 1 for c in caught), len(caught_within)),
        "median_sessions_to_catch": statistics.median(caught) if caught else None,
    }


def histogram(rows, label):
    bins = [0] * 20
    for r in rows:
        if r["label"] == label:
            bins[min(int(r["risk"] // 5), 19)] += 1
    return bins


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--riders", type=int, default=500)
    ap.add_argument("--days", type=int, default=30)
    ap.add_argument("--workers", type=int, default=4,
                    help="parallel replays; each holds the whole synthetic fleet in RAM (~150 MB at 500 riders)")
    args = ap.parse_args()

    t0 = time.time()
    T = C.DEFAULT_THRESHOLD
    with Pool(processes=max(1, args.workers), initializer=_init, initargs=(args.riders, args.days)) as pool:
        runs = dict(pool.map(replay, sorted(set(THRESHOLDS) | {T})))
    rows = runs[T]

    curve = [{"threshold": t, **rates(runs[t], lambda r: r["flag"])} for t in THRESHOLDS]
    result = {
        "default_threshold": T,
        "fleet": {
            "riders": args.riders,
            "scored_sessions": len(rows),
            "genuine_sessions": sum(r["label"] == "genuine" for r in rows),
            "life_change_sessions": sum(r["label"] == "genuine" and r["tag"] != "normal" for r in rows),
            "takeover_sessions": sum(r["label"] == "takeover" for r in rows),
            "takeover_accounts": len({r["rider"] for r in rows if r["label"] == "takeover"}),
        },
        "curve": curve,
        "baselines": {
            "open_gate": rates(rows, lambda r: False),
            "strict_gate": rates(rows, lambda r: True),
            "context_rules": rates(rows, lambda r: r["ctx_flag"]),
            "trustpulse": rates(rows, lambda r: r["flag"]),
        },
        "risk_histogram": {"bin_size": 5, "genuine": histogram(rows, "genuine"), "takeover": histogram(rows, "takeover")},
    }
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps(result, indent=1))

    f, b = result["fleet"], result["baselines"]
    print(f"Replayed {f['riders']} riders x {len(runs)} thresholds ({f['scored_sessions']} sessions each) in {time.time() - t0:.0f}s")
    print(f"  life-change sessions: {f['life_change_sessions']}, rented sessions: {f['takeover_sessions']} "
          f"({f['takeover_accounts']} rented accounts)\n")
    cols = [("false_lockout", "honest stopped"), ("honest_riders_ever_stopped", "riders ever hit"),
            ("takeover_caught", "rented caught"), ("takeover_caught_same_device", "(same phone)"),
            ("accounts_caught", "accounts caught")]
    print(f"{'':15}" + "".join(f"{h:>17}" for _, h in cols))
    for name, x in b.items():
        print(f"{name:15}" + "".join(f"{x[k]:>16}%" for k, _ in cols))
    print(f"\nTrustPulse @ threshold {T}: median rented sessions before caught = "
          f"{b['trustpulse']['median_sessions_to_catch']}")
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
