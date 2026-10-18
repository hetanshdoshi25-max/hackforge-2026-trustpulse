"""All tunable knobs of the TrustPulse engine live here."""

# A rider needs this many PIN logins before we trust their baseline.
MIN_ENROLL = 8
# Rolling window of behaviour samples kept per signal group (adaptive baseline).
BASELINE_WINDOW = 40
# A session only teaches the baseline if its risk never crossed this.
LEARN_MAX_RISK = 0.30

# Step-up threshold on the 0-100 risk scale (the "Strict <-> Open" slider).
DEFAULT_THRESHOLD = 70

# How much each behavioural signal group counts in the fused behaviour score.
GROUP_WEIGHTS = {"keystroke": 0.45, "touch": 0.30, "motion": 0.25, "riding": 0.40}
GROUPS = list(GROUP_WEIGHTS)
# Power mean over group anomalies: p=1 is a plain average; p=2 lets strong,
# agreeing mismatches dominate instead of being diluted by one normal-looking signal.
FUSION_POWER = 2.0

# Distance -> anomaly mapping: anomaly = sigmoid((d - CENTER) * SLOPE)
# d is the mean scaled distance (in "standard deviations") from the rider's baseline.
ANOMALY_CENTER = 1.7
ANOMALY_SLOPE = 3.0

# Std-dev floors so a tiny/lucky enrollment doesn't make the baseline brittle.
REL_FLOOR = 0.08
ABS_FLOORS = {
    "dwell": 12.0, "flight": 20.0, "offx": 0.06, "offy": 0.06, "tapsize": 1.0,
    "swipe_dur": 30.0, "swipe_vel": 0.08, "swipe_straight": 0.02, "swipe_angle": 0.05, "swipe_size": 1.0,
    "beta": 3.0, "gamma": 3.0, "jitter": 0.04,
    "avg_speed": 1.5, "harsh_brake": 0.25, "accel_std": 0.1, "night_ratio": 0.05,
}

# Context signals: "life changes". Combined with noisy-OR, deliberately low impact on their own.
CONTEXT_RISK = {
    "new_device": 0.45,
    "new_sim": 0.25,
    "new_city": 0.40,
    "impossible_travel": 0.90,
    "odd_hour": 0.25,
}
MAX_TRAVEL_KMH = 150

# Fusion: risk = B_W*behaviour + C_W*context + X_W*behaviour*context
FUSION_BEHAVIOUR = 0.85
FUSION_CONTEXT = 0.15
FUSION_INTERACTION = 0.30

# Older evidence inside a session fades by this factor per new batch.
RECENCY_DECAY = 0.6
# Account-level drift (CUSUM across sessions): each session adds (risk - ALLOWANCE).
# One messy session fades away; a renter who is "a bit off" every shift accumulates.
DRIFT_ALLOWANCE = 0.20
# No baseline learning while the account is drifting (stops renters poisoning it).
DRIFT_LEARN_MAX = 0.15

# Personal calibration: a rider whose own logins are naturally inconsistent gets a
# proportionally wider tolerance, so honest-but-messy riders aren't flagged.
# Typical in-baseline distance of a consistent rider:
CALIB_REFERENCE = 0.75
# Never relax a rider's tolerance by more than this (renters must still stand out).
CALIB_MIN_FACTOR = 0.6

# Replay / bot detection (PIN pad only, it has 10+ features): a login whose EVERY
# feature is within this many std-devs of one stored sample is a recording, not a human.
REPLAY_MAX_Z = 0.15

# Shared from day one: when enrollment completes, if the PIN logins split into two
# clusters this far apart (centroid gap in within-cluster std units; one person ~1.2,
# two strangers ~3.7), each with at least SPLIT_MIN_CLUSTER logins -> step-up.
SPLIT_SCORE_MIN = 3.0
SPLIT_MIN_CLUSTER = 3

# PIN brute force: lock the account after this many wrong PINs.
PIN_MAX_FAILS = 5
PIN_LOCK_SECONDS = 300

# Mid-session handoff (in-session CUSUM over each batch's own evidence):
# each batch adds (batch_risk - ALLOWANCE); a clean login followed by enough
# accumulated mismatch = the phone was handed over after the PIN.
HANDOFF_ALLOWANCE = 0.35
HANDOFF_TRIGGER = 0.45
# The login counts as "clean" (owner's own PIN entry) below this batch risk.
HANDOFF_LOGIN_MAX = 0.30
# In-session averaging of the last N gestures for the noisy per-gesture signals.
SMOOTHED_GROUPS = ("touch", "motion")
SMOOTH_WINDOW = 3

# Behaviour risk below this = "same person": the session is ALLOWed whatever the
# context did (new phone/SIM/city), and the new context is learned.
BEHAVIOUR_MATCH = 0.30

# Rental rings: two accounts' averaged impostor signatures closer than this (in
# within-person std units, noise-normalised) = the same unknown person.
RING_LINK_DISTANCE = 1.1
RING_MIN_FEATURES = 4
# A flagged session only counts as a sighting of an unknown person if its OWN
# behaviour risk is at least this (not escalated purely by drift history).
SIGHTING_MIN_BEHAVIOUR = 0.6

# Session risk smoothing between batches.
SESSION_SMOOTHING = 0.3

ACTIONS = ["ENROLLING", "ALLOW", "SOFT_CHECK", "STEP_UP", "REVIEW"]
