"""Stream synthetic riders into the running API so the dashboard has live traffic.

    python -m ml.simulate_live                      # 25 riders, one session every 1.5s
    python -m ml.simulate_live --riders 40 --interval 0.8 --reset

1. Enrolls every rider + fast-forwards a few normal days (sent instantly).
2. Then replays the rest of each rider's month one session at a time,
   favouring riders whose account gets rented out, so alerts show up during the demo.
"""
import argparse
import json
import random
import time
import urllib.error
import urllib.request

from app import config as C
from ml.data_gen import generate_fleet

COLORS = {"ALLOW": "\033[92m", "SOFT_CHECK": "\033[93m", "STEP_UP": "\033[33m", "REVIEW": "\033[91m", "ENROLLING": "\033[94m"}
RESET = "\033[0m"


def post(api, path, body):
    req = urllib.request.Request(api + path, data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read())


def send(api, rider, s):
    start = post(api, "/session/start", {**s["ctx"], "name": rider["name"], "pin": rider["pin"]})
    return post(api, f"/session/{start['session_id']}/events?label={s['label']}", s["payload"])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--api", default="http://127.0.0.1:8000")
    ap.add_argument("--riders", type=int, default=25)
    ap.add_argument("--interval", type=float, default=1.5)
    ap.add_argument("--seed", type=int, default=11)
    ap.add_argument("--reset", action="store_true", help="wipe these riders' profiles first")
    ap.add_argument("--warmup", type=int, default=14,
                    help="extra sessions per rider sent instantly after enrollment, so rented accounts show up fast")
    args = ap.parse_args()

    # Bigger pool, then keep a few rented accounts in the demo set on purpose.
    pool = generate_fleet(args.riders * 3, days=30, seed=args.seed)
    rented = [r for r in pool if any(s["label"] == "takeover" for s in r["sessions"])]
    clean = [r for r in pool if r not in rented]
    n_rented = min(len(rented), max(3, args.riders // 5))
    fleet = rented[:n_rented] + clean[: args.riders - n_rented]
    random.Random(args.seed).shuffle(fleet)

    try:
        if args.reset:
            for r in fleet:
                post(args.api, f"/riders/{r['rider_id']}/reset", {})
        print(f"Enrolling {len(fleet)} riders ({n_rented} of them will be rented out)...")
        cursor = {}
        for r in fleet:
            # Fast-forward through enrollment + a few normal days, stopping before any takeover.
            first_rented = next((i for i, s in enumerate(r["sessions"]) if s["label"] == "takeover"), len(r["sessions"]))
            upto = max(C.MIN_ENROLL, min(C.MIN_ENROLL + args.warmup, first_rented))
            for s in r["sessions"][:upto]:
                send(args.api, r, s)
            cursor[r["rider_id"]] = upto
        print("Streaming live sessions. Ctrl+C to stop.\n")

        rng = random.Random(args.seed)
        while True:
            live = [r for r in fleet if cursor[r["rider_id"]] < len(r["sessions"])]
            if not live:
                print("Month finished for every rider.")
                break
            weights = [3 if r in rented else 1 for r in live]
            r = rng.choices(live, weights)[0]
            s = r["sessions"][cursor[r["rider_id"]]]
            cursor[r["rider_id"]] += 1
            out = send(args.api, r, s)
            col = COLORS.get(out["action"], "")
            truth = "RENTED " if s["label"] == "takeover" else "genuine"
            print(f"{r['rider_id']} {r['name']:<18} {s['tag']:<14} truth={truth} "
                  f"trust={out['trust']:>3}  {col}{out['action']:<10}{RESET} {out['verdict']}")
            time.sleep(args.interval)
    except urllib.error.URLError as e:
        print(f"API not reachable at {args.api}: {e}. Start it with: uvicorn app.main:app --host 0.0.0.0 --port 8000")
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
