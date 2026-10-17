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

# Session risk smoothing between batches.
SESSION_SMOOTHING = 0.3

ACTIONS = ["ENROLLING", "ALLOW", "SOFT_CHECK", "STEP_UP", "REVIEW"]
