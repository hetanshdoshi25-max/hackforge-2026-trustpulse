# TrustPulse: pitch kit (HackForge 2026 · Team Braniacs)

Everything for the PPT, the 3-minute pitch and judge Q&A. Numbers come from
`backend/data/tradeoff.json` (synthetic, 500 riders) and `backend/data/real_eval.json` (real people, fill in on the day).

---

## The one line

> **"Phone changed, city changed: fine. Person changed: caught."**

Say it in the first 20 seconds and again in the last 10.

---

## Slides (9)

**1. Title**
TrustPulse: continuous identity for gig riders · Team Braniacs · HackForge 2026

**2. The problem (a story, not a definition)**
Ramesh is verified once: Aadhaar, licence, police check. He rents his account to Suresh for ₹3,000/month.
Same phone. Same city. Same PIN. The platform sees "Ramesh". Suresh is unverified and could be underage, have no licence, or have a record.
*Visual:* one phone, two faces.

**3. Why today's options fail**
| | Strict gate (re-verify every login) | Open gate (verify once) |
|---|---|---|
| Honest riders | Blocked over a new phone or city, so they quit | Fine |
| Rented accounts | Caught | Run for weeks |

The industry's middle ground, **context rules** (re-verify on a new device or city), catches **only 5.7%** of renters who use the owner's own phone, and still hits **28%** of honest riders.

**4. Our insight**
Context describes your *life*. Behaviour describes *you*.
A renter can borrow the phone, the SIM and the PIN, but not your **typing rhythm, swipe style, phone grip and riding style**.

**5. How it works** (diagram)
Rider app → 4 behaviour signals + context → per-rider baseline → risk 0–100 → graded response
`ALLOW → SOFT CHECK (selfie at next pickup) → STEP-UP (live selfie) → HUMAN REVIEW`
Plus: cross-session drift, poison-proof learning, replay/bot detection, PIN lockout.

**6. Results: synthetic fleet** (500 riders × 30 days, 26,000 sessions, 48 rented accounts)
| | Honest riders ever stopped | Renters on the same phone caught | Rented accounts caught |
|---|---|---|---|
| Context rules | 28.0% | 5.7% | 45.8% |
| **TrustPulse** | **5.0%** (one selfie) | **83.3%** | **97.9%** |
Caught after a **median of 2 shifts**. Honest sessions stopped: **0.24%**.
*Visual:* the Strict↔Open slider curve.

**7. Results: real humans** (fill in from `python -m ml.real_eval`)
"N people, same PIN, same phone. Owner blocked __%. Impostor stepped up on first login __%. EER __%.
Best single signal: __."
This slide is what separates you from the other teams. Don't skip collecting the data.

**8. Live demo** (switch to phone + dashboard)

**8b. Beyond one account: rental rings**
One renter rides several verified accounts. We compare flagged sessions across accounts (PIN-independent behaviour + shared phones):
**100% of ring accounts linked, 100% precision, 0 honest accounts in a ring.** Show the `/rings` 3D graph.

**8c. Challenge** (optional, at the booth): "Here's Ramesh's PIN. Can you log in as him?" Leaderboard on `/challenge`.

**9. Impact & next steps**
- Platforms: safety and legal liability (unverified riders), with zero friction for 95% of honest riders (the rest see one selfie, never a block)
- Riders: no lockouts over a new phone, so fewer drop-offs
- Next: on-device feature extraction (privacy), real telemetry calibration, face match on step-up, multi-platform account-sharing graph

---

## 3-minute script

| Time | Who | What |
|---|---|---|
| 0:00–0:25 | A | Ramesh/Suresh story → the one line |
| 0:25–0:50 | A | Strict vs Open gate; context rules catch 5.7% of same-phone renters |
| 0:50–1:15 | A | Insight + how it works (one diagram, don't read it) |
| 1:15–2:15 | B | **Live demo** (below) |
| 2:15–2:45 | A | Numbers: synthetic + real |
| 2:45–3:00 | A | Impact + the one line again |

### Demo choreography (B drives, A narrates)
1. Dashboard visible, simulator running: "This is a live fleet. Every dot is a rider being scored right now."
2. B logs in on the demo phone → 🟢 "Same person."
3. Toggle "new phone" + city Pune → log in → still 🟢. Verdict: *"Context changed, behaviour matches: same person."* **"No lockout for Ramesh."**
4. **Hand the phone to a judge.** "Here's the PIN, please log in." → 🔴 *"Same device & city, but different behaviour"* → selfie step-up → appears in the review queue with reasons.
5. Drag the Strict↔Open slider: "Every platform can choose its own trade-off, with real numbers."

---

## Judge Q&A (practise these out loud)

**"Your data is synthetic. Why should we believe the numbers?"**
The synthetic fleet is deliberately hard: lookalike renters (relatives with similar habits), messy sessions, honest phone and city changes. We also validated on real people today (slide 7), and the engine picks its threshold from real data.

**"What if the renter learns to type like the owner?"**
Four independent signals have to be faked at once, every shift, including how you hold the phone. A renter who is "almost right" every day accumulates drift (CUSUM) and is caught within a few shifts. One good imitation isn't enough.

**"What if they record the owner's taps and replay them?"**
Humans never repeat their timings to the millisecond. A replay matches a past login too perfectly and goes straight to review. Our tests cover this.

**"What if the real rider gets injured, or just has a bad day?"**
One bad session fades away; drift needs a pattern. The worst case is a selfie, never a silent block. After a passed step-up the baseline re-learns, so a broken wrist or a new phone costs one selfie.

**"Can the renter slowly poison the baseline?"**
No. Only clean sessions teach the model, and learning pauses while the account is drifting.

**"New riders with no history?" / "What if it's shared from day one?"**
The first 8 logins are enrollment. When it completes, we check whether those logins come from one person or two people taking turns: one person forms a single cluster, two form two. 0 of 500 honest enrollments were flagged, and 66% of two-stranger enrollments were caught. Look-alike relatives can slip through, and the onboarding KYC plus later drift detection cover that.

**"What if the owner logs in and THEN hands over the phone?"**
That's the most common real pattern, and we score every swipe after login separately. "Clean login, then a different person's behaviour" gets its own verdict: *phone handed over after login*.

**"Privacy? DPDP Act?"**
Profiles store only derived numbers (timings, angles), never keystroke content or raw sensor streams. The PIN is a salted PBKDF2 hash. Next step: compute features on-device so raw data never leaves the phone. Under the DPDP Act it would be collected with the rider's consent for one stated purpose (identity assurance), with retention limits. Recordings from this hackathon are git-ignored and get deleted after the event.

**"Why not a deep learning model?"**
Each rider has 8–40 samples. Per-rider distance models are the proven approach in keystroke biometrics at that data size, run in milliseconds, and every decision is explainable ("gap after key 2 is 4σ off"). A global deep model needs labelled takeovers that platforms don't have.

**"How does it scale to lakhs of riders?"**
Measured (`python -m ml.benchmark`): **1,456 logins/second on one CPU core**, which is **5.2 million sessions per hour per core** (median 0.68 ms, p99 1.3 ms; pure Python, all 4 signals, 200 riders with adaptive 40-sample baselines). A 20-core laptop covers ~100 million sessions/hour. Per-rider state is a few KB. Stateless API workers plus Redis/Postgres for profiles scale horizontally.

**"Why not just ask for a selfie every day?"**
That's the strict gate: daily friction for 100% of riders, and a renter can still show the owner's photo or have the owner do the morning selfie. Continuous behaviour covers the *whole* shift.

**"What does the platform actually do with an alert?"**
A graded response: soft check (selfie at next pickup, no block) → step-up (live selfie now) → human review with reasons and the selfie. Ops sees *why*, not just a score.

**"What about organised renting, one person on many accounts?"**
That's the rental-ring view. Each flagged session is a sighting of an unknown person; we match sightings across accounts by behaviour that doesn't depend on the PIN, plus shared phones. 100% of ring accounts linked with 100% precision on our synthetic fleet, and no honest account ever pulled into a ring.

**"Can anyone fool it if they know the PIN?"**
Try it: the challenge page gives you the PIN. Attempts run against a copy of the profile, so the real rider is never affected.

**"Business value?"**
One incident involving an unverified rider costs far more in legal liability and brand damage than this system. And no false lockouts means fewer rider drop-offs.

---

## Pre-demo checklist
- [ ] Laptop and phone on the same network; app opens over HTTPS on the phone
- [ ] `POST /riders/DEMO1/reset`, then enroll DEMO1 with **15 logins** by the demo person
- [ ] Threshold set from `real_eval` (`POST /config`)
- [ ] Everything started with `python start.py --demo --phone` (backend, frontend, threshold 45, live riders)
- [ ] Backup demo **video** recorded and on the laptop desktop
- [ ] Phone fully charged, auto-lock off, brightness up, notifications silenced
