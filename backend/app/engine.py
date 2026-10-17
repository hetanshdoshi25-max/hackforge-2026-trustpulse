"""TrustPulse risk engine.

Core idea: *context changed != person changed*.
  - Context signals (device, SIM, city, hour, travel) describe the rider's life.
    They change for honest reasons, so on their own they barely move the score.
  - Behaviour signals (typing rhythm, swipe style, phone grip, riding style)
    describe the *person*. A renter can borrow the phone, not the habits.

Each rider has a per-feature baseline (mean/std). A new sample is compared with a
scaled Manhattan distance (the standard keystroke-dynamics detector: it works with
~8 enrollment samples and every feature's contribution is explainable).
"""
import math
import uuid
from dataclasses import dataclass, field, fields
from datetime import datetime, timedelta, timezone

import numpy as np

from . import config as C
from .features import extract_all

IST = timezone(timedelta(hours=5, minutes=30))

GROUP_LABELS = {
    "keystroke": "Typing rhythm",
    "touch": "Swipe behaviour",
    "motion": "Phone grip",
    "riding": "Riding style",
}
FEATURE_LABELS = {
    "dwell": "key {n} hold time", "flight": "gap after key {n}",
    "offx": "tap position (left/right)", "offy": "tap position (up/down)", "tapsize": "finger contact size",
    "swipe_dur": "swipe duration", "swipe_vel": "swipe speed", "swipe_straight": "swipe straightness",
    "swipe_angle": "swipe angle", "swipe_size": "swipe contact size",
    "beta": "phone tilt (forward)", "gamma": "phone tilt (sideways)", "jitter": "hand steadiness",
    "avg_speed": "average speed", "harsh_brake": "harsh braking rate",
    "accel_std": "acceleration style", "night_ratio": "night-time riding share",
}


# ---------------------------------------------------------------- profile

@dataclass
class Profile:
    rider_id: str
    name: str = ""
    pin_hash: str | None = None
    samples: dict = field(default_factory=lambda: {g: [] for g in C.GROUPS})
    devices: dict = field(default_factory=dict)
    sims: dict = field(default_factory=dict)
    cities: dict = field(default_factory=dict)
    hours: list = field(default_factory=lambda: [0] * 24)
    last_lat: float | None = None
    last_lon: float | None = None
    last_ts: float | None = None
    session_count: int = 0
    drift: float = 0.0
    drift_streak: int = 0
    shared_enrollment: bool = False
    pin_fails: int = 0
    locked_until: float = 0.0
    # Runtime cache {group: (stats, calibration_factor)}; never persisted.
    _baseline: dict = field(default_factory=dict, repr=False, compare=False)

    @property
    def enroll_progress(self):
        return min(len(self.samples["keystroke"]), C.MIN_ENROLL)

    @property
    def enrolled(self):
        return self.enroll_progress >= C.MIN_ENROLL

    def to_dict(self):
        return {f.name: getattr(self, f.name) for f in fields(self) if not f.name.startswith("_")}

    @classmethod
    def from_dict(cls, d):
        known = {f.name for f in fields(cls)}
        p = cls(**{k: v for k, v in d.items() if k in known})
        for g in C.GROUPS:
            p.samples.setdefault(g, [])
        return p


# ---------------------------------------------------------------- math helpers

def _sigmoid(x):
    return 1 / (1 + math.exp(-x))


def _floor(name):
    if name in C.ABS_FLOORS:
        return C.ABS_FLOORS[name]
    return C.ABS_FLOORS.get(name.rsplit("_", 1)[0], 1e-3)


def group_stats(samples):
    """Per-feature (mean, std) from a list of feature dicts, with std floors."""
    stats = {}
    for name in {k for s in samples for k in s}:
        vals = [s[name] for s in samples if name in s]
        if len(vals) < 3:
            continue
        n = len(vals)
        mu = sum(vals) / n
        sd = math.sqrt(sum((v - mu) ** 2 for v in vals) / (n - 1))
        sd = max(sd, C.REL_FLOOR * abs(mu), _floor(name))
        stats[name] = (mu, sd)
    return stats


def distance(vec, stats):
    """Scaled Manhattan distance + per-feature z-scores (for explanations)."""
    zs = {n: abs(v - stats[n][0]) / stats[n][1] for n, v in vec.items() if n in stats}
    if not zs:
        return None, [], {}
    d = sum(zs.values()) / len(zs)
    top = sorted(zs.items(), key=lambda kv: -kv[1])[:3]
    return d, top, zs


def calibration_factor(samples, stats):
    """How inconsistent is this rider with *themselves*? Messy riders get a wider
    tolerance (factor < 1), capped so renters still stand out."""
    if not stats:
        return 1.0
    ds = sorted(distance(smp, stats)[0] or 0.0 for smp in samples)
    n = len(ds)
    typical = ds[n // 2] * math.sqrt(n / (n - 1))  # in-sample distances run slightly small
    if typical <= C.CALIB_REFERENCE:
        return 1.0
    return max(C.CALIB_MIN_FACTOR, C.CALIB_REFERENCE / typical)


def baseline(profile, group):
    """(stats, calibration factor) for a group, cached until the group learns again."""
    if group not in profile._baseline:
        samples = profile.samples[group]
        stats = group_stats(samples)
        profile._baseline[group] = (stats, calibration_factor(samples, stats))
    return profile._baseline[group]


def is_replay(vec, samples, stats):
    """A recorded-and-replayed login matches a past sample far too precisely:
    EVERY feature within a hair of the same stored sample (humans never manage that)."""
    shared = [n for n in vec if n in stats]
    if len(shared) < 6:
        return False
    for smp in samples:
        # all() stops at the first feature that differs, so the usual case is ~1 comparison
        if all(n in smp and abs(vec[n] - smp[n]) < C.REPLAY_MAX_Z * stats[n][1] for n in shared):
            return True
    return False


def enrollment_split(samples):
    """Do the enrollment logins look like ONE person or TWO? 2-means on standardised
    vectors; returns (gap between the two centroids in within-cluster std units,
    size of the smaller cluster). One person ~1.2, two strangers ~3.7."""
    vecs = [v for v in samples if v]
    names = sorted(set.intersection(*(set(v) for v in vecs))) if vecs else []
    if len(vecs) < 2 * C.SPLIT_MIN_CLUSTER or len(names) < 4:
        return 0.0, 0
    X = np.array([[v[n] for n in names] for v in vecs])
    X = (X - X.mean(0)) / (X.std(0) + 1e-9)
    i, j = np.unravel_index(np.abs(X[:, None] - X[None]).sum(-1).argmax(), (len(X), len(X)))
    centres = X[[i, j]]
    for _ in range(10):
        lab = (np.abs(X - centres[0]).sum(1) > np.abs(X - centres[1]).sum(1)).astype(int)
        if lab.min() == lab.max():
            return 0.0, 0
        centres = np.array([X[lab == k].mean(0) for k in (0, 1)])
    within = np.sqrt(((X - centres[lab]) ** 2).sum(0) / (len(X) - 2)) + 1e-9
    return float((np.abs(centres[0] - centres[1]) / within).mean()), int(min(lab.sum(), len(lab) - lab.sum()))


def anomaly_from_distance(d):
    return _sigmoid((d - C.ANOMALY_CENTER) * C.ANOMALY_SLOPE)


def feature_label(name):
    base, _, idx = name.rpartition("_")
    if idx.isdigit() and base in FEATURE_LABELS:
        return FEATURE_LABELS[base].format(n=int(idx) + 1)
    return FEATURE_LABELS.get(name, name)


def haversine_km(lat1, lon1, lat2, lon2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(a))


def ist_hour(ts):
    return datetime.fromtimestamp(ts, tz=IST).hour


# ---------------------------------------------------------------- context

def context_risk(profile, ctx):
    """Noisy-OR over context changes. Returns (risk 0..1, [(code, reason)])."""
    if not profile.enrolled:
        return 0.0, []
    items = []
    if ctx["device_id"] not in profile.devices:
        items.append(("new_device", "New device (never seen for this rider)"))
    if ctx.get("sim_id") and profile.sims and ctx["sim_id"] not in profile.sims:
        items.append(("new_sim", "New SIM card"))
    if ctx.get("city") and profile.cities and ctx["city"] not in profile.cities:
        items.append(("new_city", f"New city: {ctx['city']}"))
    if None not in (ctx.get("lat"), ctx.get("lon"), profile.last_lat, profile.last_ts):
        km = haversine_km(profile.last_lat, profile.last_lon, ctx["lat"], ctx["lon"])
        hours = max((ctx["ts"] - profile.last_ts) / 3600, 1 / 60)
        if km > 50 and km / hours > C.MAX_TRAVEL_KMH:
            items.append(("impossible_travel", f"Impossible travel: {km:.0f} km in {hours * 60:.0f} min"))
    total = sum(profile.hours)
    if total >= 10 and profile.hours[ist_hour(ctx["ts"])] / total < 0.03:
        items.append(("odd_hour", f"Unusual working hour ({ist_hour(ctx['ts'])}:00)"))

    keep = 1.0
    for code, _ in items:
        keep *= 1 - C.CONTEXT_RISK[code]
    return 1 - keep, items


def learn_context(profile, ctx):
    for key, book in (("device_id", profile.devices), ("sim_id", profile.sims), ("city", profile.cities)):
        if ctx.get(key):
            book[ctx[key]] = book.get(ctx[key], 0) + 1
    profile.hours[ist_hour(ctx["ts"])] += 1
    if ctx.get("lat") is not None:
        profile.last_lat, profile.last_lon = ctx["lat"], ctx["lon"]
    profile.last_ts = ctx["ts"]


def learn_behaviour(profile, vectors):
    for g, vec in vectors:
        buf = profile.samples[g]
        buf.append(vec)
        del buf[: -C.BASELINE_WINDOW]
        profile._baseline.pop(g, None)


# ---------------------------------------------------------------- session flow

def action_for(risk, threshold):
    r = risk * 100
    if r < threshold - 30:
        return "ALLOW"
    if r < threshold:
        return "SOFT_CHECK"
    if r < min(threshold + 20, 95):
        return "STEP_UP"
    return "REVIEW"


def start_session(profile, ctx):
    """Called on login. ctx: device_id, sim_id, city, lat, lon, ts (epoch seconds)."""
    c_risk, c_items = context_risk(profile, ctx)
    profile.session_count += 1
    return {
        "session_id": uuid.uuid4().hex[:12],
        "rider_id": profile.rider_id,
        "ctx": ctx,
        "enrolling": not profile.enrolled,
        "context_risk": c_risk,
        "context_items": c_items,
        "groups": {},
        "batch": 0,
        "risk": None,
        "own_risk": None,
        "max_risk": 0.0,
        "drift_base": profile.drift,
        "streak_base": profile.drift_streak,
        "action": "ENROLLING" if not profile.enrolled else "ALLOW",
        "status": "ACTIVE",
        "verdict": "",
        "reasons": [],
        "context_learned": False,
        "timeline": [],
    }


def _smoothed(session, group, vec):
    """Swipes and grip arrive one gesture at a time and a single gesture is noisy.
    Score the average of the last few in this session: honest noise averages out,
    a different person's consistent offset doesn't."""
    if group not in C.SMOOTHED_GROUPS:
        return vec
    recent = session.setdefault("recent", {}).setdefault(group, [])
    recent.append(vec)
    del recent[: -C.SMOOTH_WINDOW]
    keys = set.intersection(*(set(v) for v in recent))
    return {k: sum(v[k] for v in recent) / len(recent) for k in keys}


def _fuse(session, c, only_batch=None):
    """Power-mean of group anomalies -> (behaviour risk, fused risk). With only_batch,
    use just the groups that arrived in that batch."""
    num = den = 0.0
    for g, st in session["groups"].items():
        if only_batch is not None and st["batch"] != only_batch:
            continue
        w = C.GROUP_WEIGHTS[g] * C.RECENCY_DECAY ** (session["batch"] - st["batch"])
        num += w * st["anomaly"] ** C.FUSION_POWER
        den += w
    b = (num / den) ** (1 / C.FUSION_POWER) if den else None
    if b is None:
        fused = 0.5 * c if only_batch is None else 0.0
    else:
        fused = C.FUSION_BEHAVIOUR * b + C.FUSION_CONTEXT * c + C.FUSION_INTERACTION * b * c
    groups = [st for st in session["groups"].values() if only_batch is None or st["batch"] == only_batch]
    if any(st.get("replay") for st in groups):
        fused = max(fused, 0.9)  # replayed inputs are never a human: at least STEP_UP
    return b, max(0.0, min(1.0, fused))


def _verdict(b, c, drift_led=False, replay=False, handoff=False):
    if replay:
        return "Inputs replayed from a past login: likely bot / automated takeover"
    if handoff:
        return "Clean login, then a different person's behaviour: phone handed over after login"
    if drift_led:
        return "Repeated small mismatches across sessions: possible shared / rented account"
    if b is None:
        return "Not enough behavioural evidence yet"
    if b < 0.35 and c >= 0.3:
        return "Context changed, behaviour matches: same person"
    if b < 0.35:
        return "Behaviour matches the rider's baseline"
    if b >= 0.6 and c < 0.3:
        return "Same device & city, but different behaviour: possible account handoff"
    if b >= 0.6:
        return "New context AND different behaviour: likely takeover"
    return "Some behavioural drift, monitoring"


def _reasons(session):
    out = []
    if session.get("handoff"):
        out.append("Login matched the owner, but the swipes since then don't (mid-session handoff)")
    if session.get("drift_streak", 0) >= 2 and session.get("drift", 0) >= 0.3:
        out.append(f"Behaviour has been off for {session['drift_streak']} sessions in a row (cumulative drift)")
    for g, st in sorted(session["groups"].items(), key=lambda kv: -kv[1]["anomaly"]):
        label, match = GROUP_LABELS[g], round(100 * (1 - st["anomaly"]))
        if st.get("replay"):
            out.append(f"{label}: identical to a past login down to the millisecond (possible replay / bot)")
        elif st["anomaly"] >= 0.5:
            worst = feature_label(st["top"][0][0])
            out.append(f"{label}: only {match}% match with baseline (biggest gap: {worst})")
        elif st["anomaly"] >= 0.3:
            out.append(f"{label}: {match}% match, slightly unusual")
        else:
            out.append(f"{label}: {match}% match with baseline")
    out += [r for _, r in session["context_items"]]
    if not session["context_items"]:
        out.append("Known device, SIM and city")
    return out


def process_batch(profile, session, payload, threshold=C.DEFAULT_THRESHOLD, now=None):
    """Score one batch of events (PIN entry, swipes, motion, trip summary)."""
    feats = extract_all(payload)
    session["batch"] += 1
    fresh = [(g, v) for g, v in feats.items() if v]

    if session["enrolling"]:
        learn_behaviour(profile, fresh)
        if not session["context_learned"]:
            learn_context(profile, session["ctx"])
            session["context_learned"] = True
        if session["action"] != "ENROLLING":  # already escalated earlier in this session
            session["timeline"].append({"t": now, "trust": round(100 * (1 - session["risk"])), "action": session["action"]})
            return session
        session.update(
            risk=0.0, action="ENROLLING",
            verdict=f"Learning this rider's pattern ({profile.enroll_progress}/{C.MIN_ENROLL} logins)",
            reasons=[f"Enrollment: {profile.enroll_progress}/{C.MIN_ENROLL} baseline samples collected"],
        )
        if profile.enrolled and not profile.shared_enrollment:
            # Enrollment just completed: was it one person, or two taking turns?
            score, smaller = enrollment_split(profile.samples["keystroke"])
            if score >= C.SPLIT_SCORE_MIN and smaller >= C.SPLIT_MIN_CLUSTER:
                profile.shared_enrollment = True
                session.update(
                    risk=0.8, max_risk=0.8, action="STEP_UP",
                    verdict="Enrollment logins look like 2 different people: account shared from day one",
                    reasons=[f"Typing rhythm during enrollment splits into two groups "
                             f"({score:.1f}x apart; one person scores ~1.2)",
                             "Verify identity, then reset the rider to re-enroll"],
                )
        session["timeline"].append({"t": now, "trust": round(100 * (1 - session["risk"])), "action": session["action"]})
        return session

    learnable = []
    for g, vec in fresh:
        if len(profile.samples[g]) < C.MIN_ENROLL:
            learnable.append((g, vec))  # group not baselined yet (e.g. motion was off)
            continue
        stats, factor = baseline(profile, g)
        d, top, zs = distance(_smoothed(session, g, vec), stats)
        if d is None:
            continue
        replay = g == "keystroke" and is_replay(vec, profile.samples[g], stats)
        session["groups"][g] = {
            "anomaly": 1.0 if replay else anomaly_from_distance(d * factor),
            "distance": d, "calibration": round(factor, 3), "replay": replay,
            "top": [(n, round(z, 2)) for n, z in top], "batch": session["batch"],
            "z": {n: round(z, 2) for n, z in zs.items()},  # every feature, for the 3D fingerprint
        }
        if not replay:
            learnable.append((g, vec))
    session.setdefault("vectors", []).extend(learnable)

    # Fuse behaviour groups (older evidence in this session fades out).
    c = session["context_risk"]
    b, fused = _fuse(session, c)
    own = fused if session["own_risk"] is None else C.SESSION_SMOOTHING * session["own_risk"] + (1 - C.SESSION_SMOOTHING) * fused
    session["own_risk"] = own

    # In-session change point: score ONLY this batch's fresh evidence and accumulate it.
    # Catches "owner types the PIN, then hands the phone over", where the clean
    # login would otherwise dilute everything that follows.
    _, batch_risk = _fuse(session, c, only_batch=session["batch"])
    if session["batch"] == 1:
        session["login_clean"] = batch_risk < C.HANDOFF_LOGIN_MAX
    session["handoff_cusum"] = max(0.0, session.get("handoff_cusum", 0.0) + batch_risk - C.HANDOFF_ALLOWANCE)
    session["handoff"] = (session.get("login_clean", False) and session["batch"] > 1
                          and session["handoff_cusum"] >= C.HANDOFF_TRIGGER)
    if session["handoff"]:
        own = max(own, min(0.99, session["handoff_cusum"] + C.HANDOFF_ALLOWANCE))

    # Account-level CUSUM: recomputed from the session's starting value so multiple
    # batches in one session don't compound.
    drift = max(0.0, session["drift_base"] + own - C.DRIFT_ALLOWANCE)
    profile.drift = drift
    profile.drift_streak = session["streak_base"] + 1 if own > C.DRIFT_ALLOWANCE else 0
    session["drift"], session["drift_streak"] = drift, profile.drift_streak
    # "Drift-led" = this session alone looks borderline, the history is what escalates it.
    session["drift_led"] = own < 0.6 and drift > own and drift >= 0.3
    risk = max(own, min(drift, 0.99))
    session["risk"] = risk
    session["max_risk"] = max(session["max_risk"], risk)
    session["behaviour_risk"] = b

    # Escalation is sticky inside a session: we never silently de-escalate.
    new_action = action_for(risk, threshold)
    if C.ACTIONS.index(new_action) > C.ACTIONS.index(session["action"]):
        session["action"] = new_action
    replay = any(st.get("replay") for st in session["groups"].values())
    session["verdict"] = _verdict(b, c, session["drift_led"], replay, session["handoff"])
    session["reasons"] = _reasons(session)
    session["timeline"].append({"t": now, "trust": round(100 * (1 - risk)), "action": session["action"]})

    # Adaptive baseline: only clean sessions teach the profile (renters can't poison it).
    if session["max_risk"] < C.LEARN_MAX_RISK and drift < C.DRIFT_LEARN_MAX:
        learn_behaviour(profile, learnable)
        if not session["context_learned"]:
            learn_context(profile, session["ctx"])
            session["context_learned"] = True
    return session


def verify_identity(profile, session):
    """Step-up passed (selfie matched / reviewer approved): this IS the rider.
    Reset the drift and learn this session, so a new phone costs at most one selfie."""
    profile.drift, profile.drift_streak = 0.0, 0
    learn_behaviour(profile, session.get("vectors", []))
    if not session["context_learned"]:
        learn_context(profile, session["ctx"])
        session["context_learned"] = True
