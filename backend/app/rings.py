"""Rental-ring detection: is the SAME unknown person riding several verified accounts?

Renting is a business: one renter often rides several accounts. Every flagged session
is a "sighting" of an unknown person. We compare sightings ACROSS accounts:
  - behaviour: a PIN-independent signature (average key hold, where the thumb lands
    on a key, finger size, phone grip, swipe style). Per-key timings are left out on
    purpose: each account has a different PIN, so they'd differ for the same person.
  - device: the same phone showing up in flagged sessions of different accounts.
Accounts linked by either kind of evidence form a ring (connected component).
"""
from statistics import median

from . import config as C
from .engine import group_stats

GROUP_FEATURES = {
    "keystroke": ("offx", "offy", "tapsize"),
    "touch": ("swipe_dur", "swipe_vel", "swipe_straight", "swipe_angle", "swipe_size"),
    "motion": ("beta", "gamma", "jitter"),
    "riding": ("avg_speed", "harsh_brake", "accel_std", "night_ratio"),
}
# Used until enough enrolled riders exist to measure within-person spread.
DEFAULT_SCALE = {
    "dwell_mean": 12.0, "offx": 0.1, "offy": 0.1, "tapsize": 0.8,
    "swipe_dur": 45.0, "swipe_vel": 0.08, "swipe_straight": 0.02, "swipe_angle": 0.05, "swipe_size": 0.8,
    "beta": 4.0, "gamma": 3.0, "jitter": 0.05,
    "avg_speed": 1.5, "harsh_brake": 0.25, "accel_std": 0.1, "night_ratio": 0.05,
}


def is_sighting(session):
    """Is this session a look at an UNKNOWN person? Escalated AND its own behaviour was
    off. Sessions escalated only by the account's drift history are excluded: on a shared
    account the owner's own shifts get escalated too, and their habits would pollute the
    renter's signature."""
    b = session.get("behaviour_risk")
    return (session.get("action") in ("STEP_UP", "REVIEW") and bool(session.get("vectors"))
            and b is not None and b >= C.SIGHTING_MIN_BEHAVIOUR)


def signature(vectors):
    """[(group, feature_vector), ...] from one or more sessions -> {feature: mean value}."""
    acc = {}
    for g, vec in vectors:
        feats = {k: vec[k] for k in GROUP_FEATURES.get(g, ()) if k in vec}
        if g == "keystroke":
            dwells = [v for k, v in vec.items() if k.startswith("dwell_")]
            if dwells:
                feats["dwell_mean"] = sum(dwells) / len(dwells)
        for k, v in feats.items():
            acc.setdefault(k, []).append(v)
    return {k: sum(v) / len(v) for k, v in acc.items()}


def within_person_scale(profiles):
    """Typical spread of each signature feature for ONE person, measured on enrolled
    riders' own baselines (median across riders); defaults until there's enough data."""
    per_feature = {}
    for p in profiles:
        if not p.enrolled:
            continue
        for g in GROUP_FEATURES:
            if len(p.samples[g]) < C.MIN_ENROLL:
                continue
            sigs = [signature([(g, v)]) for v in p.samples[g]]
            stats = group_stats(sigs)
            for k, (_, sd) in stats.items():
                per_feature.setdefault(k, []).append(sd)
    scale = dict(DEFAULT_SCALE)
    for k, sds in per_feature.items():
        if len(sds) >= 3:
            scale[k] = median(sds)
    return scale


def account_distance(a, b, scale):
    """Mean scaled difference between two accounts' averaged impostor signatures,
    normalised by how much averaging n sightings should shrink the noise."""
    shared = [k for k in a["sig"] if k in b["sig"] and k in scale]
    if len(shared) < C.RING_MIN_FEATURES:
        return None
    noise = (1 / a["n"] + 1 / b["n"]) ** 0.5
    return sum(abs(a["sig"][k] - b["sig"][k]) / (scale[k] * noise) for k in shared) / len(shared)


def detect_rings(sightings, scale):
    """sightings: [{rider_id, session_id, ts, device_id, vectors}] -> list of rings."""
    accounts = {}
    for s in sightings:
        a = accounts.setdefault(s["rider_id"], {"vectors": [], "n": 0, "devices": set(), "first": s["ts"], "last": s["ts"]})
        a["vectors"] += s["vectors"]
        a["n"] += 1
        if s.get("device_id"):
            a["devices"].add(s["device_id"])
        a["first"], a["last"] = min(a["first"], s["ts"]), max(a["last"], s["ts"])
    for a in accounts.values():
        a["sig"] = signature(a["vectors"])

    ids = sorted(accounts)
    parent = {i: i for i in ids}

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    edges = []
    for i, x in enumerate(ids):
        for y in ids[i + 1:]:
            ax, ay = accounts[x], accounts[y]
            d = account_distance(ax, ay, scale)
            shared_dev = sorted(ax["devices"] & ay["devices"])
            behaviour_link = d is not None and d < C.RING_LINK_DISTANCE
            if behaviour_link or shared_dev:
                edges.append({
                    "a": x, "b": y,
                    "behaviour_match": None if d is None else round(max(0.0, 1 - d / (2 * C.RING_LINK_DISTANCE)) * 100),
                    "distance": None if d is None else round(d, 2),
                    "shared_devices": shared_dev,
                })
                parent[find(x)] = find(y)

    groups = {}
    for x in ids:
        groups.setdefault(find(x), []).append(x)
    rings = []
    for members in groups.values():
        if len(members) < 2:
            continue
        ring_edges = [e for e in edges if e["a"] in members]
        rings.append({
            "accounts": sorted(members),
            "sightings": sum(accounts[m]["n"] for m in members),
            "first_seen": min(accounts[m]["first"] for m in members),
            "last_seen": max(accounts[m]["last"] for m in members),
            "evidence": ring_edges,
            "device_evidence": any(e["shared_devices"] for e in ring_edges),
        })
    rings.sort(key=lambda r: (-len(r["accounts"]), -r["sightings"]))
    for n, r in enumerate(rings, 1):
        r["ring_id"] = f"RING-{n}"
    return rings
