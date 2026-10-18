"""Measure rental-ring detection on a synthetic fleet where renters ride several accounts.

    python -m ml.ring_eval              # 500 riders, rings of 3 (~1 min, single process)

Replays every session through the real engine; each escalated session becomes a sighting.
Then sweeps the link distance and reports recall / precision / false links.
A ring account is only *linkable* if it was flagged at least once AND so was a ring-mate:
nothing can link an account the engine never flagged.
"""
import argparse
import json
from itertools import combinations
from pathlib import Path

from app import config as C
from app.engine import Profile, process_batch, start_session
from app.rings import detect_rings, is_sighting, within_person_scale
from ml.data_gen import generate_fleet

OUT = Path(__file__).resolve().parent.parent / "data" / "ring_eval.json"


def collect(fleet):
    sightings, profiles = [], []
    for r in fleet:
        prof = Profile(rider_id=r["rider_id"])
        for s in r["sessions"]:
            sess = start_session(prof, dict(s["ctx"]))
            process_batch(prof, sess, s["payload"])
            if is_sighting(sess):
                sightings.append({"rider_id": r["rider_id"], "session_id": sess["session_id"], "ts": s["ctx"]["ts"],
                                  "device_id": s["ctx"]["device_id"], "vectors": sess["vectors"]})
        profiles.append(prof)
    return sightings, profiles


def score(rings, truth, sighted):
    """truth: {rider_id: renter_id or None}; sighted: accounts with >= 1 flagged session."""
    ring_accounts = {a for a, t in truth.items() if t and t.startswith("ring-")}
    linkable = {a for a in ring_accounts & sighted if any(o != a and truth.get(o) == truth[a] for o in sighted)}
    linked_pairs = [(x, y) for ring in rings for x, y in combinations(ring["accounts"], 2)]
    good = [p for p in linked_pairs if truth.get(p[0]) and truth.get(p[0]) == truth.get(p[1])]
    found = {a for ring in rings for a in ring["accounts"]
             if a in ring_accounts and any(truth.get(o) == truth[a] for o in ring["accounts"] if o != a)}
    in_rings = {a for ring in rings for a in ring["accounts"]}
    return {
        "rings_detected": len(rings),
        "linkable_accounts": len(linkable),
        "recall_all_ring_accounts": round(100 * len(found) / max(1, len(ring_accounts)), 1),
        "recall_of_linkable": round(100 * len(found) / max(1, len(linkable)), 1),
        "link_precision": round(100 * len(good) / max(1, len(linked_pairs)), 1),
        "honest_accounts_in_rings": sum(1 for a in in_rings if not truth.get(a)),
        "solo_renters_in_rings": sum(1 for a in in_rings if (truth.get(a) or "").startswith("solo-")),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--riders", type=int, default=500)
    ap.add_argument("--ring-size", type=int, default=3)
    args = ap.parse_args()

    fleet = generate_fleet(args.riders, 30, ring_size=args.ring_size)
    truth = {r["rider_id"]: r["renter"] for r in fleet}
    sightings, profiles = collect(fleet)
    scale = within_person_scale(profiles)
    sighted = {s["rider_id"] for s in sightings}
    n_rings = len({t for t in truth.values() if t and t.startswith("ring-")})
    n_solo = sum(1 for t in truth.values() if t and t.startswith("solo-"))
    print(f"{args.riders} riders, {n_rings} true rings of {args.ring_size}, {n_solo} solo renters, "
          f"{len(sightings)} sightings from {len(sighted)} accounts\n")

    sweep = []
    print(f"{'link dist':>9} {'rings':>6} {'recall(all)':>12} {'recall(linkable)':>17} {'precision':>10} {'honest in rings':>16}")
    for d in (0.8, 1.0, 1.1, 1.2, 1.5):
        C.RING_LINK_DISTANCE = d
        m = {"link_distance": d, **score(detect_rings(sightings, scale), truth, sighted)}
        sweep.append(m)
        print(f"{d:>9} {m['rings_detected']:>6} {m['recall_all_ring_accounts']:>11}% {m['recall_of_linkable']:>16}% "
              f"{m['link_precision']:>9}% {m['honest_accounts_in_rings']:>16}")

    C.RING_LINK_DISTANCE = -1  # device evidence alone, for comparison
    dev_only = score(detect_rings(sightings, scale), truth, sighted)
    print(f"\nlinkable ring accounts (flagged, with a flagged ring-mate): {dev_only['linkable_accounts']}")
    print(f"shared-phone evidence alone: {dev_only['recall_of_linkable']}% of linkable, precision {dev_only['link_precision']}%")
    OUT.write_text(json.dumps({"riders": args.riders, "ring_size": args.ring_size, "true_rings": n_rings,
                               "sightings": len(sightings), "sweep": sweep, "device_only": dev_only}, indent=1))
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
