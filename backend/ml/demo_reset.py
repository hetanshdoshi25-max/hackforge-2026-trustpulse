"""One command before going on stage: wipe the demo rider, set the threshold, check everything.

    python -m ml.demo_reset                    # rider DEMO1, threshold from real_eval if available
    python -m ml.demo_reset --rider DEMO2 --threshold 50
"""
import argparse
import json
import urllib.error
import urllib.request
from pathlib import Path

from app import config as C

REAL_EVAL = Path(__file__).resolve().parent.parent / "data" / "real_eval.json"


def call(api, path, body=None):
    req = urllib.request.Request(api + path, method="POST" if body is not None else "GET",
                                 data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=5) as r:
        return json.loads(r.read())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--api", default="http://127.0.0.1:8000")
    ap.add_argument("--rider", default="DEMO1")
    ap.add_argument("--threshold", type=int, help="default: recommended by ml.real_eval, else the config default")
    args = ap.parse_args()

    threshold, source = args.threshold, "--threshold"
    if threshold is None and REAL_EVAL.exists():
        rec = json.loads(REAL_EVAL.read_text())["overall"].get("recommended")
        if rec:
            threshold, source = rec["threshold"], "real_eval recommendation"
    if threshold is None:
        threshold, source = C.DEFAULT_THRESHOLD, "config default"

    try:
        health = call(args.api, "/health")
    except urllib.error.URLError:
        raise SystemExit(f"[X] API not running at {args.api}. Start: uvicorn app.main:app --host 0.0.0.0 --port 8000")

    call(args.api, f"/riders/{args.rider}/reset", {})
    cfg = call(args.api, "/config", {"threshold": threshold})
    try:
        call(args.api, "/metrics/tradeoff")
        slider = "[OK] Strict<->Open slider data present"
    except urllib.error.HTTPError:
        slider = "[X] No tradeoff.json: run python -m ml.evaluate"

    print(f"[OK] API up ({health['riders']} riders, {health['sessions']} sessions in memory)")
    print(f"[OK] Rider {args.rider} wiped: log in {C.MIN_ENROLL}+ times (15 is better) with the demo person's hand")
    print(f"[OK] Threshold = {cfg['threshold']} ({source})")
    print(slider)
    print(f"[i]  Recording: {'ON' if cfg.get('recording') else 'off'}")
    print("\nNext: python -m ml.simulate_live --riders 25 --reset   (keeps the dashboard alive)")


if __name__ == "__main__":
    main()
