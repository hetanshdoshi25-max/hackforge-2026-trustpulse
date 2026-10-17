"""Synthetic rider fleet: every rider is a 'persona' with personal habits.

Each session is produced in the *same raw format the rider app sends*
(PIN taps with down/up times, swipe gestures, motion samples, trip summary),
so evaluation and the live simulator exercise the real feature pipeline.

Scenarios per rider over `days` days (2 sessions/day):
  normal          - same person, same phone, same city
  new_phone       - same person switches phone (screen shifts touch habits a bit)
  moved_city      - same person relocates
  takeover_same   - account rented out: different person, SAME phone + city (the hard case)
  takeover_new    - different person on a new phone
  shared accounts - owner rides days, renter rides nights on the same account
  lookalike renter- half the renters are relatives/friends with similar habits (harder)
  messy sessions  - 12% of all sessions are noisy (rushing, rain, one-handed)

Run `python -m ml.data_gen` to write a small sample to data/sample_fleet.json.
"""
import json
import random
from pathlib import Path

import numpy as np

CITIES = {
    "Mumbai": (19.0760, 72.8777), "Pune": (18.5204, 73.8567), "Delhi": (28.6139, 77.2090),
    "Bengaluru": (12.9716, 77.5946), "Hyderabad": (17.3850, 78.4867), "Ahmedabad": (23.0225, 72.5714),
}
FIRST = ["Ramesh", "Suresh", "Amit", "Rahul", "Vikas", "Arjun", "Imran", "Sandeep", "Ravi", "Karan",
         "Manoj", "Deepak", "Faizal", "Ajay", "Nitin", "Prakash", "Sunil", "Rohit", "Anil", "Javed"]
LAST = ["Kumar", "Sharma", "Patil", "Yadav", "Shaikh", "Singh", "Reddy", "Gupta", "Naik", "Verma"]
START_TS = 1_759_276_800  # 1 Oct 2025 00:00 UTC


def make_persona(rng):
    return {
        "dwell": rng.normal(105, 22) + rng.normal(0, 14, 4), "dwell_sd": rng.uniform(9, 18),
        "flight": np.clip(rng.normal(170, 55) + rng.normal(0, 35, 3), 40, 450), "flight_sd": rng.uniform(18, 40),
        "off": rng.normal(0, 0.22, 2), "off_sd": rng.uniform(0.07, 0.14),
        "size": rng.normal(9, 2), "size_sd": rng.uniform(0.4, 1.0),
        "swipe_dur": float(np.clip(rng.normal(360, 90), 150, 700)), "swipe_dur_sd": rng.uniform(30, 60),
        "swipe_path": rng.normal(230, 45), "swipe_path_sd": rng.uniform(15, 30),
        "swipe_straight": float(np.clip(rng.normal(0.93, 0.03), 0.8, 0.995)),
        "swipe_angle": rng.normal(0, 0.12),
        "beta": rng.normal(52, 12), "beta_sd": rng.uniform(2.5, 5),
        "gamma": rng.normal(0, 8), "gamma_sd": rng.uniform(2, 4),
        "jitter": abs(rng.normal(0.25, 0.08)) + 0.05, "jitter_sd": rng.uniform(0.03, 0.06),
        "speed": rng.normal(24, 4), "harsh": abs(rng.normal(1.0, 0.5)), "accel_std": abs(rng.normal(1.2, 0.3)),
        "shift_start": int(rng.integers(7, 21)),
    }


def new_phone_shift(p, rng):
    """A new phone changes screen size / grip a little, not the person."""
    q = dict(p)
    q["swipe_path"] = p["swipe_path"] * rng.uniform(0.88, 1.12)
    q["size"] = p["size"] + rng.normal(0, 0.8)
    q["off"] = p["off"] + rng.normal(0, 0.05, 2)
    q["beta"] = p["beta"] + rng.normal(0, 3)
    return q


def lookalike(owner, other, mix=0.5):
    """A renter who is a relative/friend: habits halfway between the owner and a stranger."""
    q = dict(other)
    for k, v in owner.items():
        if k != "shift_start":
            q[k] = mix * v + (1 - mix) * other[k]
    return q


def night_ratio(shift_start):
    hours = [(shift_start + h) % 24 for h in range(8)]
    return sum(h >= 22 or h < 5 for h in hours) / 8


def sample_payload(p, pin, rng, noise=1.0):
    """noise > 1 = a messy session (rushing, rain, one hand on the handlebar)."""
    p = {k: (v * noise if k.endswith("_sd") else v) for k, v in p.items()}
    keys, t = [], 0.0
    for i in range(4):
        dwell = max(30.0, rng.normal(p["dwell"][i], p["dwell_sd"]))
        keys.append({"key": pin[i], "down": t, "up": t + dwell,
                     "x": float(rng.normal(p["off"][0], p["off_sd"])), "y": float(rng.normal(p["off"][1], p["off_sd"])),
                     "size": float(max(3.0, rng.normal(p["size"], p["size_sd"])))})
        if i < 3:
            t += dwell + max(20.0, rng.normal(p["flight"][i], p["flight_sd"]))

    touches = []
    for _ in range(2):
        path = max(60.0, rng.normal(p["swipe_path"], p["swipe_path_sd"]))
        straight = float(np.clip(rng.normal(p["swipe_straight"], 0.015), 0.6, 1.0))
        ang = rng.normal(p["swipe_angle"], 0.04)
        touches.append({"dur": float(max(80.0, rng.normal(p["swipe_dur"], p["swipe_dur_sd"]))),
                        "dx": float(path * straight * np.cos(ang)), "dy": float(path * straight * np.sin(ang)),
                        "path": float(path), "size": float(max(3.0, rng.normal(p["size"], p["size_sd"])))})

    beta_s = rng.normal(p["beta"], p["beta_sd"])
    gamma_s = rng.normal(p["gamma"], p["gamma_sd"])
    jit = abs(rng.normal(p["jitter"], p["jitter_sd"]))
    motion = []
    for k in range(12):
        b = rng.normal(beta_s, 1.5)
        m = 9.81 + rng.normal(0, jit)
        motion.append({"t": k * 50.0, "ax": float(rng.normal(0, 0.05)),
                       "ay": float(m * np.sin(np.radians(b))), "az": float(m * np.cos(np.radians(b))),
                       "beta": float(b), "gamma": float(rng.normal(gamma_s, 1.5))})

    riding = {"avg_speed": float(rng.normal(p["speed"], 1.5)), "harsh_brake": float(abs(rng.normal(p["harsh"], 0.25))),
              "accel_std": float(abs(rng.normal(p["accel_std"], 0.1))),
              "night_ratio": float(np.clip(rng.normal(night_ratio(p["shift_start"]), 0.05), 0, 1))}
    return {"keystrokes": keys, "touches": touches, "motion": motion, "riding": riding}


def generate_rider(idx, rng, days=30):
    rid = f"R{idx:04d}"
    owner = make_persona(rng)
    pin = "".join(str(d) for d in rng.integers(0, 10, 4))
    home = random.Random(idx).choice(list(CITIES))
    device, sim = f"dev-{rid}-a", f"sim-{rid}-a"

    roll = rng.random()
    phone_day = int(rng.integers(12, 26)) if roll < 0.20 else None
    move_day = int(rng.integers(12, 26)) if 0.20 <= roll < 0.30 else None
    takeover_day = int(rng.integers(12, 26)) if rng.random() < 0.10 else None
    renter = make_persona(rng) if takeover_day else None
    if renter and rng.random() < 0.5:
        renter = lookalike(owner, renter, mix=rng.uniform(0.4, 0.6))
    renter_new_device = takeover_day is not None and rng.random() < 0.3
    shared = takeover_day is not None and rng.random() < 0.4
    other_city = random.Random(idx + 999).choice([c for c in CITIES if c != home])

    sessions = []
    for day in range(days):
        for k in range(2):
            p, dev, city, label, tag = owner, device, home, "genuine", "normal"
            if phone_day is not None and day >= phone_day:
                p, dev, tag = new_phone_shift(owner, np.random.default_rng(idx)), f"dev-{rid}-b", "new_phone"
            if move_day is not None and day >= move_day:
                city, tag = other_city, "moved_city"
            if takeover_day is not None and day >= takeover_day and (not shared or k == 1):
                p, label = renter, "takeover"
                tag = "takeover_new" if renter_new_device else "takeover_same"
                if renter_new_device:
                    dev = f"dev-{rid}-x"
            hour = (p["shift_start"] + int(rng.integers(0, 8))) % 24
            ts = START_TS + day * 86400 + hour * 3600 + int(rng.integers(0, 3600)) - 19800  # IST -> UTC
            lat, lon = CITIES[city]
            ctx = {"rider_id": rid, "device_id": dev, "sim_id": sim, "city": city,
                   "lat": lat + float(rng.normal(0, 0.03)), "lon": lon + float(rng.normal(0, 0.03)), "ts": float(ts)}
            noise = rng.uniform(1.8, 2.5) if rng.random() < 0.12 else 1.0
            sessions.append({"ctx": ctx, "payload": sample_payload(p, pin, rng, noise), "label": label, "tag": tag})
    sessions.sort(key=lambda s: s["ctx"]["ts"])
    name = f"{random.Random(idx).choice(FIRST)} {random.Random(idx * 7).choice(LAST)}"
    return {"rider_id": rid, "name": name, "pin": pin, "home": home, "sessions": sessions}


def generate_fleet(n_riders=500, days=30, seed=7):
    rng = np.random.default_rng(seed)
    return [generate_rider(i + 1, rng, days) for i in range(n_riders)]


if __name__ == "__main__":
    out = Path(__file__).resolve().parent.parent / "data" / "sample_fleet.json"
    out.parent.mkdir(exist_ok=True)
    fleet = generate_fleet(n_riders=5, days=10)
    out.write_text(json.dumps(fleet, indent=1))
    print(f"Wrote {len(fleet)} riders x {len(fleet[0]['sessions'])} sessions to {out}")
