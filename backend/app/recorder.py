"""Optional recording of real app sessions, for validating the engine on real people.

Off by default. Turn on before starting the server:
    cmd:         set TRUSTPULSE_RECORD=1
    PowerShell:  $env:TRUSTPULSE_RECORD="1"

Privacy: this is biometric data. PIN digits are NOT written (only a short hash of the
digit sequence, so the evaluator can check everyone typed the same PIN), and the
recordings folder is git-ignored. Delete it after the hackathon.
"""
import hashlib
import json
import os
import time
from collections import Counter
from pathlib import Path

from .store import DATA_DIR

ENABLED = os.environ.get("TRUSTPULSE_RECORD") == "1"
FILE = Path(os.environ.get("TRUSTPULSE_RECORD_FILE", DATA_DIR / "recordings" / "sessions.jsonl"))


def pin_sequence_hash(keystrokes):
    seq = "".join(k["key"] for k in sorted(keystrokes, key=lambda k: k["down"]))
    return hashlib.sha256(seq.encode()).hexdigest()[:12] if seq else None


def record(session, payload):
    if not ENABLED:
        return
    keys = payload.get("keystrokes") or []
    line = {
        "rider_id": session["rider_id"],
        "session_id": session["session_id"],
        "recorded_at": time.time(),
        "device_id": session["ctx"].get("device_id"),
        "pin_seq": pin_sequence_hash(keys),
        "payload": {**payload, "keystrokes": [{k: v for k, v in key.items() if k != "key"} for key in keys]},
    }
    FILE.parent.mkdir(parents=True, exist_ok=True)
    with FILE.open("a", encoding="utf-8") as f:
        f.write(json.dumps(line) + "\n")


def summary():
    """Logins recorded per person, so you know who still has to type more."""
    if not FILE.exists():
        return {"enabled": ENABLED, "file": str(FILE), "people": {}}
    pin_logins = Counter()
    pins = {}
    with FILE.open(encoding="utf-8") as f:
        for raw in f:
            line = json.loads(raw)
            if line["pin_seq"]:
                pin_logins[line["rider_id"]] += 1
                pins.setdefault(line["rider_id"], set()).add(line["pin_seq"])
    return {
        "enabled": ENABLED,
        "file": str(FILE),
        "people": {rid: {"pin_logins": n, "distinct_pins": len(pins[rid])} for rid, n in pin_logins.items()},
        "same_pin_for_everyone": len({p for s in pins.values() for p in s}) <= 1,
    }
