"""Turn raw app events into fixed feature vectors, one per signal group.

Every function returns a dict {feature_name: float} or None when there's not
enough data for that group in this batch.
"""
import math
from statistics import mean, pstdev

RIDING_KEYS = ("avg_speed", "harsh_brake", "accel_std", "night_ratio")


def keystroke_features(keys):
    """PIN-pad taps -> hold times, gaps between keys, tap offset and finger size."""
    if not keys or len(keys) < 2:
        return None
    keys = sorted(keys, key=lambda k: k["down"])
    f = {}
    for i, k in enumerate(keys):
        f[f"dwell_{i}"] = k["up"] - k["down"]
    for i in range(len(keys) - 1):
        f[f"flight_{i}"] = keys[i + 1]["down"] - keys[i]["up"]

    xs = [k["x"] for k in keys if k.get("x") is not None]
    ys = [k["y"] for k in keys if k.get("y") is not None]
    sizes = [k["size"] for k in keys if k.get("size")]
    if xs:
        f["offx"] = mean(xs)
    if ys:
        f["offy"] = mean(ys)
    if sizes and max(sizes) > 1.5:  # mouse reports size 1 -> useless
        f["tapsize"] = mean(sizes)
    return f


def touch_features(gestures):
    """Swipe gestures -> duration, speed, straightness, angle, contact size."""
    gs = [g for g in gestures or [] if g["dur"] > 0 and g["path"] > 5]
    if not gs:
        return None
    f = {
        "swipe_dur": mean(g["dur"] for g in gs),
        "swipe_vel": mean(g["path"] / g["dur"] for g in gs),
        "swipe_straight": mean(min(1.0, math.hypot(g["dx"], g["dy"]) / g["path"]) for g in gs),
        "swipe_angle": mean(math.atan2(g["dy"], abs(g["dx"]) or 1e-6) for g in gs),
    }
    sizes = [g["size"] for g in gs if g.get("size")]
    if sizes and max(sizes) > 1.5:
        f["swipe_size"] = mean(sizes)
    return f


def motion_features(samples):
    """Accelerometer / orientation stream -> how the phone is held + hand steadiness."""
    samples = samples or []
    betas = [s["beta"] for s in samples if s.get("beta") is not None]
    gammas = [s["gamma"] for s in samples if s.get("gamma") is not None]
    mags = [
        math.sqrt(s["ax"] ** 2 + s["ay"] ** 2 + s["az"] ** 2)
        for s in samples
        if None not in (s.get("ax"), s.get("ay"), s.get("az"))
    ]
    f = {}
    if len(betas) >= 3:
        f["beta"] = mean(betas)
    if len(gammas) >= 3:
        f["gamma"] = mean(gammas)
    if len(mags) >= 5:
        f["jitter"] = pstdev(mags)
    return f or None


def riding_features(riding):
    """Trip telemetry summary (from the simulator or a future GPS module)."""
    if not riding:
        return None
    f = {k: float(riding[k]) for k in RIDING_KEYS if riding.get(k) is not None}
    return f or None


def extract_all(payload):
    return {
        "keystroke": keystroke_features(payload.get("keystrokes")),
        "touch": touch_features(payload.get("touches")),
        "motion": motion_features(payload.get("motion")),
        "riding": riding_features(payload.get("riding")),
    }
