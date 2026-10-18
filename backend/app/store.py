"""In-memory state, with rider profiles persisted to data/profiles.json.

Writes are batched: requests only mark the store dirty, and a background task
flushes at most once per SAVE_INTERVAL (plus on shutdown). The file is written
atomically so a crash mid-write can't corrupt it.
"""
import json
import os
from pathlib import Path

from . import config as C
from .engine import Profile

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
# Override to run a throwaway server (e.g. a UI preview) without touching real profiles.
PROFILES_FILE = Path(os.environ.get("TRUSTPULSE_PROFILES", DATA_DIR / "profiles.json"))
SAVE_INTERVAL = 2.0
MAX_SESSIONS_PER_RIDER = 200


class Store:
    def __init__(self):
        self.profiles: dict[str, Profile] = {}
        self.sessions: dict[str, dict] = {}
        self.rider_sessions: dict[str, list[str]] = {}
        self.alerts: list[dict] = []
        self.selfies: dict[str, str] = {}
        # flagged sessions that looked like an unknown person, for rental-ring detection
        self.sightings: dict[str, dict] = {}
        # "Can you fool TrustPulse?": attempts to pass as the target rider
        self.challenge = {"target": "DEMO1", "pin": None, "attempts": []}
        self.threshold = C.DEFAULT_THRESHOLD
        self.dirty = False
        self.load()

    def load(self):
        if PROFILES_FILE.exists():
            raw = json.loads(PROFILES_FILE.read_text())
            self.profiles = {rid: Profile.from_dict(p) for rid, p in raw.items()}

    def save(self):
        DATA_DIR.mkdir(exist_ok=True)
        tmp = PROFILES_FILE.with_suffix(".tmp")
        tmp.write_text(json.dumps({rid: p.to_dict() for rid, p in self.profiles.items()}))
        os.replace(tmp, PROFILES_FILE)
        self.dirty = False

    def mark_dirty(self):
        self.dirty = True

    def flush(self):
        if self.dirty:
            self.save()

    def profile(self, rider_id, name=None):
        if rider_id not in self.profiles:
            self.profiles[rider_id] = Profile(rider_id=rider_id, name=name or rider_id)
        elif name:
            self.profiles[rider_id].name = name
        return self.profiles[rider_id]

    def add_session(self, s, track=True):
        self.sessions[s["session_id"]] = s
        if not track:  # challenge attempts: kept for lookup, never part of the rider's history
            return
        sids = self.rider_sessions.setdefault(s["rider_id"], [])
        sids.append(s["session_id"])
        # Keep memory bounded on long simulator runs.
        for old in sids[:-MAX_SESSIONS_PER_RIDER]:
            self.sessions.pop(old, None)
            self.selfies.pop(old, None)
        del sids[:-MAX_SESSIONS_PER_RIDER]

    def reset_rider(self, rider_id):
        self.profiles.pop(rider_id, None)
        for sid in self.rider_sessions.pop(rider_id, []):
            self.sessions.pop(sid, None)
            self.selfies.pop(sid, None)
        self.alerts = [a for a in self.alerts if a["rider_id"] != rider_id]
        self.sightings = {k: v for k, v in self.sightings.items() if v["rider_id"] != rider_id}
        self.save()


store = Store()
