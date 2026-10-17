# TrustPulse API: contract for the rider app & dashboard

Base URL (local): `http://localhost:8000` · Interactive docs: `http://localhost:8000/docs`

> **HTTPS note for the rider app:** phone motion sensors only work on HTTPS pages.
> Serve the app over HTTPS (e.g. Vite + `@vitejs/plugin-basic-ssl`) and **proxy** `/api/*` to
> `http://<laptop-ip>:8000` so the browser never makes a mixed-content request.

---

## Rider app flow

```
[PIN pad] --4th tap--> POST /session/start --> POST /session/{id}/events (keystrokes + motion)
                                                     │
[Orders screen] -- every swipe-to-accept --> POST /session/{id}/events (touches + motion)
                                                     │
          response.action ── ALLOW       → nothing, keep working
                          ── SOFT_CHECK  → small banner "quick selfie at next pickup" (no block)
                          ── STEP_UP     → selfie screen → POST /session/{id}/stepup
                          ── REVIEW      → "Session paused, under review", poll GET /session/{id}
                          ── ENROLLING   → "Learning your pattern 3/8, log in again"
```

The first **8 logins** of a rider are enrollment (baseline building). For the demo, log in 10–15 times with your own hand first.

### 1. `POST /session/start`, on PIN completion

```json
{
  "rider_id": "DEMO1",
  "name": "Ramesh Kumar",
  "pin": "2580",
  "device_id": "uuid stored in localStorage",
  "sim_id": "optional",
  "city": "Mumbai",
  "lat": 19.07, "lon": 72.87,
  "ts": 1760000000
}
```
- `pin`: the first login sets it; after that, a wrong PIN returns **401**.
- `ts` is optional (epoch **seconds**); the server uses its own clock if missing.
- "Simulate new phone" in the demo = generate a new `device_id`. "Moved city" = change `city`/`lat`/`lon`.

Response = **Session object** (below). Keep `session_id`.

### 2. `POST /session/{session_id}/events`

Send any subset of these; every field is optional.

```json
{
  "keystrokes": [
    {"key": "2", "down": 1532.4, "up": 1641.0, "x": -0.12, "y": 0.30, "size": 11.5}
  ],
  "touches": [
    {"dur": 380, "dx": 240, "dy": -6, "path": 252, "size": 10.2}
  ],
  "motion": [
    {"t": 1530.0, "ax": 0.1, "ay": 7.6, "az": 6.1, "beta": 51.0, "gamma": -3.2}
  ],
  "riding": {"avg_speed": 24.1, "harsh_brake": 0.9, "accel_std": 1.1, "night_ratio": 0.2}
}
```

| Field | How to capture it (browser) |
|---|---|
| `keystrokes[].down/up` | **Custom on-screen PIN pad** (not the OS keyboard, which gives no timings). `performance.now()` at `pointerdown` / `pointerup` on each button. |
| `keystrokes[].x/y` | Tap offset from button centre, normalised: `(e.clientX - centreX) / (width/2)`, same for y → range −1..1 |
| `keystrokes[].size` | `(e.width + e.height) / 2` from the PointerEvent (contact size). Mouse gives 1, which the server ignores. |
| `touches[]` | One entry per swipe gesture (e.g. "swipe to accept order"): `dur` = up−down ms, `dx/dy` = end−start px, `path` = summed distance of all `pointermove`s, `size` = avg contact size. Use `touch-action: none` on the slider. |
| `motion[]` | `devicemotion` → `e.accelerationIncludingGravity.{x,y,z}`, `deviceorientation` → `e.beta`, `e.gamma`. Send the samples recorded *during* the PIN entry / swipe (10–60 samples is plenty). **iOS:** call `DeviceMotionEvent.requestPermission()` and `DeviceOrientationEvent.requestPermission()` inside a button click first. |
| `riding` | Optional. Only the simulator sends it today. |

PIN length must stay the same for a rider (4 digits). If the user hits backspace, clear the whole entry and restart capture.

Response = **Session object**.

### 3. `POST /session/{session_id}/stepup`

```json
{ "image": "data:image/jpeg;base64,..." }
```
Capture with `getUserMedia({video: {facingMode: "user"}})` → draw to canvas → `toDataURL("image/jpeg", 0.6)`.
Session `status` becomes `PENDING_REVIEW` and an alert with the selfie goes to the dashboard. Poll `GET /session/{id}` every 3 s until `status` is `VERIFIED` (continue) or `BLOCKED`.

### 4. `GET /session/{session_id}` returns the Session object

---

## Session object (returned by all the session endpoints)

```json
{
  "session_id": "a1b2c3d4e5f6",
  "rider_id": "DEMO1",
  "name": "Ramesh Kumar",
  "city": "Mumbai", "lat": 19.07, "lon": 72.87,
  "device_id": "…",
  "ts": 1760000000, "received_at": 1760000003.2,
  "enrolling": false, "enroll_progress": 8, "enroll_target": 8,
  "trust": 18,                 // 0-100, show this as the big number (100 = definitely the rider)
  "risk": 82,                  // 100 - trust
  "behaviour_risk": 91,        // null if no behaviour data yet
  "context_risk": 0,
  "action": "STEP_UP",         // ENROLLING | ALLOW | SOFT_CHECK | STEP_UP | REVIEW
  "status": "ACTIVE",          // ACTIVE | PENDING_REVIEW | VERIFIED | BLOCKED
  "verdict": "Same device & city, but different behaviour: possible account handoff",
  "reasons": [
    "Typing rhythm: only 6% match with baseline (biggest gap: gap after key 2)",
    "Phone grip: only 21% match with baseline (biggest gap: phone tilt (forward))",
    "Known device, SIM and city"
  ],
  "signals": {
    "keystroke": {"match": 6,  "top": [["flight_1", 4.1], ["dwell_3", 3.2], ["offy", 2.8]]},
    "motion":    {"match": 21, "top": [["beta", 3.9], ["jitter", 1.2], ["gamma", 0.4]]}
  },
  "timeline": [{"t": 1760000003.2, "trust": 18, "action": "STEP_UP"}],
  "has_selfie": false,
  "label": null               // ground truth "genuine"/"takeover", only for simulator sessions
}
```

Colour code suggestion: `ALLOW` green · `SOFT_CHECK` yellow · `STEP_UP` orange · `REVIEW` red · `ENROLLING` blue.

---

## Dashboard endpoints

| Method | Path | What |
|---|---|---|
| GET | `/riders` | All riders, each with the `last` Session object, enroll progress, known cities |
| GET | `/riders/{id}` | Rider detail + `history` (sessions oldest→newest), good for the trust timeline chart |
| POST | `/riders/{id}/reset` | Wipe a rider (to re-do the demo enrollment) |
| GET | `/sessions?limit=100&rider_id=` | Recent sessions, newest first (for the map / live feed) |
| GET | `/alerts?limit=50` | Alert queue, newest first. Session object + `alert_type` (`SOFT_CHECK`/`STEP_UP`/`REVIEW`/`SELFIE_SUBMITTED`) + `alert_at` |
| GET | `/session/{id}/selfie` | `{ "image": "data:image/jpeg;base64,..." }` |
| POST | `/session/{id}/resolve` | `{ "decision": "approve" \| "reject" }` reviewer button |
| GET | `/config` | `{ "threshold": 70, "min_enroll": 8 }` |
| POST | `/config` | `{ "threshold": 55 }` sets live strictness. **Lower = stricter.** |
| GET | `/metrics/tradeoff` | Data for the Strict ↔ Open slider (below) |
| WS | `/ws` | Live push. Messages: `{"type": "session" \| "alert" \| "config" \| "rider_reset", "data": {...}}` |

Simplest dashboard pattern: on every WS message, re-fetch `/riders` and `/alerts` (debounced ~500 ms).

### `GET /metrics/tradeoff`

Generated by `python -m ml.evaluate` (real file: `backend/data/tradeoff.json`). All rates are **percentages**.

```json
{
  "default_threshold": 70,
  "fleet": {"riders": 500, "scored_sessions": 26000, "genuine_sessions": 25127,
            "life_change_sessions": 3068, "takeover_sessions": 873, "takeover_accounts": 48},
  "curve": [
    {"threshold": 20, "false_lockout": 3.9, "false_lockout_life_change": 5.1, "honest_riders_ever_stopped": 85.0,
     "takeover_caught": 90.1, "takeover_caught_same_device": 89.0,
     "accounts_caught": 100.0, "accounts_caught_first_session": 91.7, "median_sessions_to_catch": 1},
    "... one entry per threshold 20, 25, ... 95"
  ],
  "baselines": {
    "open_gate":     { "...same keys as a curve entry, minus threshold..." },
    "strict_gate":   { },
    "context_rules": { },
    "trustpulse":    { }
  },
  "risk_histogram": {"bin_size": 5, "genuine": ["20 counts"], "takeover": ["20 counts"]}
}
```

| Key | Show it as |
|---|---|
| `false_lockout` | "Honest sessions stopped" |
| `honest_riders_ever_stopped` | "Honest riders who ever had to do a selfie" |
| `takeover_caught` | "Rented sessions caught" |
| `takeover_caught_same_device` | "...even on the same phone" (context rules score ~6% here, our killer stat) |
| `accounts_caught` | "Rented accounts caught" |
| `median_sessions_to_catch` | "Caught within N shifts" |

**Slider UX:** a range input over `curve[].threshold` (left = Strict, right = Open). For the selected point show
the numbers above plus a line chart of `false_lockout` and `takeover_caught` against the threshold. "Apply" → `POST /config`.
**Comparison slide/card:** the four `baselines` side by side.
**Histogram:** `risk_histogram` as two overlaid bar series (honest vs rented risk scores) shows the separation visually.
