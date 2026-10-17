# TrustPulse: continuous rider identity engine

**HackForge 2026** · Team **Braniacs** · Track: *The Rented Account Problem (The Trust Juggler)*

> **Phone changed, city changed: fine. Person changed: caught.**

Delivery platforms verify a rider once and then trust the account forever. A rented or handed-off
account keeps running under someone else's verified identity. TrustPulse scores **every login and
session** against the rider's own behavioural pattern. Honest riders with a new phone or a new city
keep working, and a different person behind the same account gets escalated.

## How it works

```
 Rider app (PWA)                      TrustPulse API (FastAPI)                         Ops dashboard
 ───────────────                      ────────────────────────                         ─────────────
 PIN pad taps ──┐                     features.py   raw events → feature vectors
 swipe gestures ├─ /session/events ─▶ engine.py                                   ──WS──▶ live alerts
 phone motion  ─┘                       1. Context risk  (device/SIM/city/hour/travel)    trust timeline
 device/city ──── /session/start        2. Behaviour risk per group vs rider baseline     Strict↔Open slider
                                           (scaled Manhattan distance → anomaly)          review queue
                                        3. Fusion: behaviour dominates, context only
                                           amplifies → session risk
                                        4. Account drift (CUSUM across sessions)
                                        5. Action: ALLOW / SOFT_CHECK / STEP_UP / REVIEW
                                        6. Adaptive baseline: only clean sessions teach it
```

| Signal group | Features | Why a renter can't fake it |
|---|---|---|
| Typing rhythm | key hold time, gap between keys, tap offset on each button, finger size | Muscle memory for your own PIN |
| Swipe behaviour | duration, speed, straightness, angle, contact size | Motor habit |
| Phone grip | forward/sideways tilt, hand steadiness | How *you* hold *your* phone |
| Riding style | avg speed, harsh braking, acceleration, night share | Driving habit + shift pattern |
| Context (low weight) | new device / SIM / city, impossible travel, odd hour | Changes for honest reasons, so it only amplifies |

**Design choices worth saying out loud to judges**
- **Per-rider model, not one global classifier.** Each rider is compared with their *own* past. Scaled Manhattan distance is the standard keystroke-dynamics detector: it works with 8 enrollment samples and every number is explainable.
- **Explainable.** Every decision comes with reasons, e.g. *"Typing rhythm: only 6% match (biggest gap: gap after key 2) · Known device, SIM and city"*.
- **Graded response, not a gate.** Soft check (selfie at next pickup, no block) → step-up (live selfie) → human review.
- **Cross-session drift (CUSUM).** One messy session (rain, rushing) fades away. A renter who is "a bit off" every shift accumulates and gets caught, usually by the 2nd shift.
- **Poison-proof adaptive baseline.** Only clean sessions update the baseline, so a renter can't slowly teach the system their habits. An honest rider who passes a step-up is re-learned, so a new phone costs **at most one selfie**.
- **Privacy.** The server never stores raw events: profiles keep only derived numbers (timings, angles, speeds), and the PIN is stored as a hash. Next step: compute the features on-device so raw events never leave the phone.

## Results (synthetic fleet: 500 riders × 30 days)

`python -m ml.evaluate` replays the fleet through the real engine. The fleet includes honest
phone changes, honest city moves, messy sessions, renters on the **same phone and city**,
renters on a new phone, **lookalike renters** (relatives/friends with similar habits) and shared accounts (owner days, renter nights).

| Policy | Honest sessions stopped | Honest riders ever stopped | Rented sessions caught | ↳ on the **same phone** | Rented accounts caught |
|---|---|---|---|---|---|
| Open gate (verify once) | 0% | 0% | 0% | 0% | 0% |
| Strict gate (re-verify every login) | 100% | 100% | 100% | 100% | 100% |
| Context rules (re-verify on new device/city) | 0.56% | 28.0% | 37.8% | **5.7%** | 45.8% |
| **TrustPulse** (threshold 70) | **0.19%** | **3.4%** (one selfie) | **83.1%** | **81.8%** | **93.8%** |

26,000 scored sessions, 3,068 honest life-change sessions, 873 rented sessions across 48 rented accounts.
A rented account is caught after a **median of 2 sessions**. The misses are mostly "lookalike" renters
whose habits sit halfway between the owner's and a stranger's. All numbers are on **synthetic** data;
the next step is calibrating on real rider telemetry.

## Quick start (Windows, from `backend/`)

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt

python -m ml.evaluate                     # builds data/tradeoff.json (≈1 min, uses all cores)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
API docs: http://127.0.0.1:8000/docs · Contract for the app & dashboard: [docs/API.md](docs/API.md)

In a second terminal, stream live traffic for the dashboard:
```bash
python -m ml.simulate_live --riders 25 --reset
```

Run the end-to-end test:
```bash
python -m tests.test_flow
```

> On Windows use `127.0.0.1` instead of `localhost` in scripts and proxies (`localhost` tries IPv6 first and adds ~2 s per request).

## Repo layout

```
backend/
  app/
    config.py      all tunable knobs (weights, thresholds, floors)
    features.py    raw events → feature vectors
    engine.py      risk engine (context, behaviour, fusion, drift, actions, reasons)
    store.py       in-memory state + profiles.json
    schemas.py     request bodies (the API contract)
    main.py        FastAPI routes + WebSocket
  ml/
    data_gen.py    synthetic rider personas & scenarios
    evaluate.py    trade-off curve + baselines → data/tradeoff.json
    simulate_live.py  streams the fleet into the API for the live dashboard
  tests/test_flow.py
docs/API.md        contract for Member B (rider app + dashboard)
```

## Team split

| Member A: engine (this repo's `backend/`) | Member B: rider app + dashboard |
|---|---|
| Features, risk engine, drift, explanations | Rider PWA: PIN pad, swipe-to-accept, motion capture, selfie step-up |
| Synthetic data, evaluation, metrics | Ops dashboard: alerts, trust timeline, map, Strict↔Open slider, review queue |
| API + WebSocket, simulator | HTTPS + proxy, PPT, demo video |

## Live demo script (3 min)

1. **Before the demo:** reset `DEMO1` (`POST /riders/DEMO1/reset`) and log in **10–15 times** with your own hand.
2. Start `simulate_live` so the dashboard map and alert queue are already moving.
3. You log in and the trust score stays 🟢. *"Same person."*
4. Switch to "new phone" + city Pune in the app and log in. It stays 🟢, and the verdict says *"Context changed, behaviour matches: same person"*.
5. **Hand the phone to a judge.** They enter the same PIN. It turns 🔴: *"Same device & city, but different behaviour: possible account handoff"*, then the selfie step-up appears and lands in the review queue.
6. Drag the **Strict ↔ Open** slider to show the trade-off live with real numbers.
