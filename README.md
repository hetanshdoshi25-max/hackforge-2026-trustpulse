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
- **Personal calibration.** Some people are naturally less consistent. Each rider's tolerance is scaled by how much they vary *from themselves*, so honest-but-messy riders aren't flagged (capped, so renters still stand out).
- **Replay / bot detection.** A recorded PIN entry played back matches a past login *too perfectly*. Humans never repeat timings to the millisecond, so it goes straight to review.
- **Mid-session handoff.** The most common real pattern is that the owner types the PIN and then hands the phone over. Each swipe batch is scored on its own (averaged over the last 3 gestures to cancel noise), and an in-session CUSUM flags *"clean login, then a different person"*. Measured on synthetic shifts: caught within 5 swipes 21/60 → **32/60**, while false flags on 30-swipe honest shifts dropped 4/150 → **1/150**.
- **Shared from day one.** When enrollment completes, the PIN logins are checked for two clusters (2-means). One person's logins form one cloud; two people taking turns form two. 0/500 honest enrollments flagged, 66% of two-stranger enrollments caught. Look-alike relatives mostly pass, and that's a known limit.
- **Rental-ring detection.** Renting is a business: one renter often rides several accounts. Every flagged session is a sighting of an unknown person; sightings are compared ACROSS accounts with a PIN-independent behaviour signature (average key hold, thumb position on keys, finger size, grip, swipe style) and by shared phones. On a synthetic fleet with rings of 3 (`python -m ml.ring_eval`): **100% of ring accounts linked, 100% precision, 0 honest accounts in any ring** (shared phones alone: 31%).
- **"Can you fool TrustPulse?"** Judges get the rider's PIN and try to log in as them (`/play` on a phone, leaderboard at `/challenge`). Attempts are scored on a copy of the profile, so the real rider is never affected, and every attempt is real impostor data.
- **Account time machine.** On a rider's page, play the account's history session by session and watch the fingerprint: weeks of the owner inside the shell, then the day someone else took over.
- **Measured scale.** `python -m ml.benchmark`: **1,456 logins/s on one CPU core (5.2 million sessions/hour/core)**, median 0.68 ms, p99 1.3 ms.
- **PIN brute-force lockout.** 5 wrong PINs lock the account for 5 minutes and raise a dashboard alert.
- **Privacy.** The server never stores raw events: profiles keep only derived numbers (timings, angles, speeds), and the PIN is stored as a salted PBKDF2 hash. Next step: compute the features on-device so raw events never leave the phone.

## Results (synthetic fleet: 500 riders × 30 days)

`python -m ml.evaluate` replays the fleet through the real engine. The fleet includes honest
phone changes, honest city moves, messy sessions, renters on the **same phone and city**,
renters on a new phone, **lookalike renters** (relatives/friends with similar habits) and shared accounts (owner days, renter nights).

| Policy | Honest sessions stopped | Honest riders ever stopped | Rented sessions caught | ↳ on the **same phone** | Rented accounts caught |
|---|---|---|---|---|---|
| Open gate (verify once) | 0% | 0% | 0% | 0% | 0% |
| Strict gate (re-verify every login) | 100% | 100% | 100% | 100% | 100% |
| Context rules (re-verify on new device/city) | 0.56% | 28.0% | 37.8% | **5.7%** | 45.8% |
| **TrustPulse** (threshold 70) | **0.24%** | **5.0%** (one selfie) | **85.1%** | **83.3%** | **97.9%** |

26,000 scored sessions, 3,068 honest life-change sessions, 873 rented sessions across 48 rented accounts.
A rented account is caught after a **median of 2 sessions**. The misses are mostly "lookalike" renters
whose habits sit halfway between the owner's and a stranger's. All numbers are on **synthetic** data;
the next step is calibrating on real rider telemetry.

## Real-human validation

Synthetic numbers prove the logic; real people prove it works. Once the rider app's PIN pad is live:

1. Start the server with recording on (cmd: `set TRUSTPULSE_RECORD=1`, PowerShell: `$env:TRUSTPULSE_RECORD="1"`).
2. Everyone types the **same PIN** (e.g. `2580`) under their **own rider ID** (`P1`, `P2`, ...) on the **same phone**, 15–20 logins each, plus a swipe after each login.
3. Check progress at `http://127.0.0.1:8000/recordings/summary`.
4. Run `python -m ml.real_eval`. You get, per person and overall:
   - owner allowed / not blocked, impostor flagged / stepped up on a **single** login
   - EER (equal error rate) and which signal separates people best
   - how many logins an impostor survives when they keep using the account (drift)
   - a **recommended demo threshold** from your own data. Apply it with `POST /config`.

Phones don't send riding data, so phone-only risk scores run lower than the synthetic fleet's. That's why the threshold should come from real data.

Privacy: PIN digits are never written (only a hash proving everyone typed the same PIN), and `data/recordings/` is git-ignored. Delete it after the event.

## Quick start: one command

From the repo root (needs Python 3.11+ and Node 20+):

```bash
python start.py
```
This installs missing dependencies on the first run, starts the backend and frontend in one window, and prints the links. **Ctrl+C stops everything.**

| Option | What it adds |
|---|---|
| `--demo` | demo threshold 45 + live simulated riders on the dashboard |
| `--phone` | HTTPS and the phone URL, for opening the rider app on a phone on the same WiFi |
| `--threshold 50` | a different demo threshold |
| `--api-port` / `--web-port` | other ports if 8000 / 5173 are busy |

Then open http://localhost:5173/ and choose **delivery partner** (rider app) or **operations team** (dashboard).
API docs: http://127.0.0.1:8000/docs · Contract for the app & dashboard: [docs/API.md](docs/API.md)

**Other backend commands** (from `backend/`):
```bash
python -m ml.evaluate        # rebuilds data/tradeoff.json (~1.5 min, 4 worker processes)
python -m tests.test_flow    # end-to-end API tests
python -m ml.ring_eval       # rental-ring detection: recall / precision on a fleet with rings
python -m ml.benchmark       # engine throughput on one core -> data/benchmark.json
```

> On Windows use `127.0.0.1` instead of `localhost` in scripts and proxies (`localhost` tries IPv6 first and adds ~2 s per request).

## Demo day

**Before going on stage:**
```bash
python -m ml.demo_reset
```
This wipes `DEMO1`, sets the threshold (from `ml.real_eval` if you ran it), and checks the API and slider data.
Then enroll DEMO1 with 15 logins and start `python -m ml.simulate_live --riders 25`.

**Phone can't reach the laptop?** Hackathon WiFi often isolates devices from each other. Try in this order:
1. **Phone hotspot (most reliable):** connect the laptop to the phone's hotspot. Run `ipconfig` and use the laptop's IPv4 address in the app URL.
2. **Windows Firewall:** when Python asks, allow it on **Private** networks (or allow port 8000 and the app's port).
3. **ngrok (works on any network, and gives real HTTPS so the phone sensors work):** `ngrok http 5173` for the rider app's dev server. If Vite rejects the host, add `server: { allowedHosts: true }` to `vite.config.js`. The app's `/api` proxy still reaches the backend locally.
4. **Last resort:** play the backup video.

## Repo layout

```
start.py           one command: backend + frontend (+ --demo, --phone)
backend/
  app/
    config.py      all tunable knobs (weights, thresholds, floors)
    features.py    raw events → feature vectors
    engine.py      risk engine (context, behaviour, fusion, drift, actions, reasons)
    store.py       in-memory state + profiles.json
    schemas.py     request bodies (the API contract)
    main.py        FastAPI routes + WebSocket
    recorder.py    optional recording of real sessions (TRUSTPULSE_RECORD=1)
  ml/
    data_gen.py    synthetic rider personas & scenarios
    evaluate.py    trade-off curve + baselines → data/tradeoff.json
    simulate_live.py  streams the fleet into the API for the live dashboard
    real_eval.py   validates on real people recorded from the app
    demo_reset.py  one-command pre-demo reset + checks
  tests/test_flow.py
docs/API.md        contract for Member B (rider app + dashboard)
docs/PITCH.md      slides, 3-min script, judge Q&A, demo checklist
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
