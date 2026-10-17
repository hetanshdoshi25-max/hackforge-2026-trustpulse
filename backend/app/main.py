"""TrustPulse API. Run: uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"""
import asyncio
import hashlib
import hmac
import json
import secrets
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from . import config as C
from . import recorder
from .engine import GROUP_LABELS, baseline, feature_label, process_batch, start_session, verify_identity
from .schemas import ConfigIn, Events, Resolve, SessionStart, StepUp
from .store import DATA_DIR, SAVE_INTERVAL, store


@asynccontextmanager
async def lifespan(_app):
    async def saver():
        while True:
            await asyncio.sleep(SAVE_INTERVAL)
            store.flush()

    task = asyncio.create_task(saver())
    yield
    task.cancel()
    store.flush()


app = FastAPI(title="TrustPulse", description="Continuous rider identity engine", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

ESCALATED = {"SOFT_CHECK", "STEP_UP", "REVIEW"}


# ---------------------------------------------------------------- websocket hub

class Hub:
    def __init__(self):
        self.clients: set[WebSocket] = set()

    async def send(self, kind, data):
        msg = json.dumps({"type": kind, "data": data})
        for ws in list(self.clients):
            try:
                await ws.send_text(msg)
            except Exception:
                self.clients.discard(ws)


hub = Hub()


@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    await ws.accept()
    hub.clients.add(ws)
    try:
        while True:
            await ws.receive_text()  # keep-alive; dashboard doesn't need to send anything
    except WebSocketDisconnect:
        hub.clients.discard(ws)


# ---------------------------------------------------------------- helpers

def pin_hash(pin, salt=None):
    """Salted PBKDF2, stored as 'salt$hash'. A 4-digit PIN is weak on its own;
    the lockout below is what really protects it."""
    salt = salt or secrets.token_hex(8)
    digest = hashlib.pbkdf2_hmac("sha256", pin.encode(), bytes.fromhex(salt), 100_000).hex()
    return f"{salt}${digest}"


def pin_ok(stored, pin, rider_id):
    if "$" not in stored:  # legacy unsalted sha256 from older profiles.json
        return hmac.compare_digest(stored, hashlib.sha256(f"{rider_id}:{pin}".encode()).hexdigest())
    salt, _, _ = stored.partition("$")
    return hmac.compare_digest(stored, pin_hash(pin, salt))


def public(s):
    p = store.profiles.get(s["rider_id"])
    risk = s["risk"] or 0.0
    return {
        "session_id": s["session_id"],
        "rider_id": s["rider_id"],
        "name": p.name if p else s["rider_id"],
        "city": s["ctx"].get("city"),
        "lat": s["ctx"].get("lat"),
        "lon": s["ctx"].get("lon"),
        "device_id": s["ctx"].get("device_id"),
        "ts": s["ctx"]["ts"],
        "received_at": s["received_at"],
        "enrolling": s["enrolling"],
        "enroll_progress": p.enroll_progress if p else 0,
        "enroll_target": C.MIN_ENROLL,
        "trust": round(100 * (1 - risk)),
        "risk": round(100 * risk),
        "behaviour_risk": None if s.get("behaviour_risk") is None else round(100 * s["behaviour_risk"]),
        "context_risk": round(100 * s["context_risk"]),
        "action": s["action"],
        "status": s["status"],
        "verdict": s["verdict"],
        "reasons": s["reasons"],
        "signals": {g: {"match": round(100 * (1 - st["anomaly"])), "top": st["top"]} for g, st in s["groups"].items()},
        "timeline": s["timeline"],
        "has_selfie": s["session_id"] in store.selfies,
        "label": s.get("label"),  # only set by the simulator (ground truth, for the demo)
    }


def get_session(sid):
    s = store.sessions.get(sid)
    if not s:
        raise HTTPException(404, "Unknown session")
    return s


async def push_alert(alert):
    store.alerts.append(alert)
    del store.alerts[:-300]
    await hub.send("alert", alert)


async def raise_alert(s, kind):
    alert = {**public(s), "alert_type": kind, "alert_at": time.time()}
    alert.pop("timeline")
    await push_alert(alert)


async def check_pin(profile, pin):
    now = time.time()
    if profile.locked_until > now:
        raise HTTPException(423, f"Too many wrong PINs. Try again in {int(profile.locked_until - now)} s")
    if profile.pin_hash is None:
        profile.pin_hash = pin_hash(pin)
        return
    if pin_ok(profile.pin_hash, pin, profile.rider_id):
        if "$" not in profile.pin_hash:
            profile.pin_hash = pin_hash(pin)  # upgrade legacy hash
        profile.pin_fails = 0
        return
    profile.pin_fails += 1
    store.mark_dirty()
    if profile.pin_fails >= C.PIN_MAX_FAILS:
        profile.locked_until, profile.pin_fails = now + C.PIN_LOCK_SECONDS, 0
        await push_alert({
            "alert_type": "PIN_LOCKOUT", "alert_at": now, "session_id": None,
            "rider_id": profile.rider_id, "name": profile.name, "action": "REVIEW",
            "trust": None, "risk": None, "status": "LOCKED",
            "verdict": f"{C.PIN_MAX_FAILS} wrong PINs in a row: possible PIN guessing",
            "reasons": [f"Account locked for {C.PIN_LOCK_SECONDS // 60} min"],
        })
        raise HTTPException(423, "Too many wrong PINs. Account locked")
    raise HTTPException(401, "Wrong PIN")


# ---------------------------------------------------------------- session endpoints

@app.get("/health")
def health():
    return {"ok": True, "riders": len(store.profiles), "sessions": len(store.sessions)}


@app.post("/session/start")
async def session_start(body: SessionStart, request: Request):
    profile = store.profile(body.rider_id, body.name)
    if body.pin:
        await check_pin(profile, body.pin)
    ctx = body.model_dump(exclude={"pin", "name"})
    ctx["ts"] = ctx["ts"] or time.time()
    ctx["ip"] = request.client.host if request.client else None
    s = start_session(profile, ctx)
    s["received_at"] = time.time()
    store.add_session(s)
    store.mark_dirty()
    return public(s)


@app.post("/session/{sid}/events")
async def session_events(sid: str, body: Events, label: str | None = None):
    s = get_session(sid)
    if s["status"] in ("PENDING_REVIEW", "BLOCKED"):
        return public(s)  # frozen until a human decides
    profile = store.profiles[s["rider_id"]]
    before = s["action"]
    if label:
        s["label"] = label
    payload = body.model_dump()
    recorder.record(s, payload)
    process_batch(profile, s, payload, threshold=store.threshold, now=time.time())
    s["received_at"] = time.time()
    store.mark_dirty()
    out = public(s)
    await hub.send("session", out)
    if s["action"] != before and s["action"] in ESCALATED:
        await raise_alert(s, s["action"])
    return out


@app.get("/session/{sid}")
def session_get(sid: str):
    return public(get_session(sid))


@app.post("/session/{sid}/stepup")
async def session_stepup(sid: str, body: StepUp):
    """Rider sends a live selfie; it lands in the human review queue."""
    s = get_session(sid)
    store.selfies[sid] = body.image
    s["status"] = "PENDING_REVIEW"
    await raise_alert(s, "SELFIE_SUBMITTED")
    await hub.send("session", public(s))
    return public(s)


@app.get("/session/{sid}/selfie")
def session_selfie(sid: str):
    if sid not in store.selfies:
        raise HTTPException(404, "No selfie for this session")
    return {"image": store.selfies[sid]}


@app.post("/session/{sid}/resolve")
async def session_resolve(sid: str, body: Resolve):
    """Ops reviewer decision from the dashboard."""
    s = get_session(sid)
    if body.decision == "approve":
        verify_identity(store.profiles[s["rider_id"]], s)
        store.mark_dirty()
        s["status"], s["action"] = "VERIFIED", "ALLOW"
        s["verdict"] = "Verified by reviewer"
    elif body.decision == "reject":
        s["status"], s["action"] = "BLOCKED", "REVIEW"
        s["verdict"] = "Blocked by reviewer: account handoff confirmed"
    else:
        raise HTTPException(400, "decision must be 'approve' or 'reject'")
    await hub.send("session", public(s))
    return public(s)


# ---------------------------------------------------------------- dashboard endpoints

@app.get("/sessions")
def sessions(limit: int = 100, rider_id: str | None = None):
    items = store.sessions.values() if rider_id is None else (
        store.sessions[sid] for sid in store.rider_sessions.get(rider_id, []))
    items = sorted(items, key=lambda s: s["received_at"], reverse=True)[:limit]
    return [public(s) for s in items]


@app.get("/alerts")
def alerts(limit: int = 50):
    return store.alerts[::-1][:limit]


@app.get("/riders")
def riders():
    out = []
    for rid, p in store.profiles.items():
        sids = store.rider_sessions.get(rid, [])
        last = public(store.sessions[sids[-1]]) if sids else None
        out.append({
            "rider_id": rid, "name": p.name, "enrolled": p.enrolled,
            "enroll_progress": p.enroll_progress, "sessions": p.session_count,
            "known_devices": len(p.devices), "known_cities": list(p.cities),
            "last": last,
        })
    return sorted(out, key=lambda r: -(r["last"]["received_at"] if r["last"] else 0))


@app.get("/riders/{rider_id}")
def rider(rider_id: str):
    p = store.profiles.get(rider_id)
    if not p:
        raise HTTPException(404, "Unknown rider")
    return {
        "rider_id": rider_id, "name": p.name, "enrolled": p.enrolled,
        "enroll_progress": p.enroll_progress, "sessions": p.session_count,
        "known_devices": list(p.devices), "known_cities": list(p.cities),
        "baseline_samples": {g: len(v) for g, v in p.samples.items()},
        "history": sessions(limit=200, rider_id=rider_id)[::-1],
    }


@app.get("/riders/{rider_id}/baseline")
def rider_baseline(rider_id: str):
    """Debug view: what the engine has learned for this rider, and how the last
    session compared feature by feature. Use it to tune on real phone data."""
    p = store.profiles.get(rider_id)
    if not p:
        raise HTTPException(404, "Unknown rider")
    sids = store.rider_sessions.get(rider_id, [])
    last = store.sessions[sids[-1]] if sids else None
    groups = {}
    for g, samples in p.samples.items():
        if len(samples) < 3:
            groups[g] = {"label": GROUP_LABELS[g], "samples": len(samples)}
            continue
        stats, factor = baseline(p, g)
        groups[g] = {
            "label": GROUP_LABELS[g], "samples": len(samples), "calibration": round(factor, 3),
            "features": {n: {"label": feature_label(n), "mean": round(mu, 3), "std": round(sd, 3)}
                         for n, (mu, sd) in sorted(stats.items())},
            "last_session": last and last["groups"].get(g, {}).get("top"),
        }
    return {"rider_id": rider_id, "enrolled": p.enrolled, "drift": round(p.drift, 3),
            "drift_streak": p.drift_streak, "groups": groups}


@app.post("/riders/{rider_id}/reset")
async def rider_reset(rider_id: str):
    store.reset_rider(rider_id)
    await hub.send("rider_reset", {"rider_id": rider_id})
    return {"ok": True}


@app.get("/config")
def get_config():
    return {"threshold": store.threshold, "min_enroll": C.MIN_ENROLL, "recording": recorder.ENABLED}


@app.get("/recordings/summary")
def recordings_summary():
    """During real-data collection: how many PIN logins each person has done so far."""
    return recorder.summary()


@app.post("/config")
async def set_config(body: ConfigIn):
    store.threshold = body.threshold
    await hub.send("config", {"threshold": store.threshold})
    return get_config()


_tradeoff_cache = {"mtime": None, "data": None}


@app.get("/metrics/tradeoff")
def tradeoff():
    f = DATA_DIR / "tradeoff.json"
    if not f.exists():
        raise HTTPException(404, "Run `python -m ml.evaluate` first")
    mtime = f.stat().st_mtime
    if _tradeoff_cache["mtime"] != mtime:  # re-read only when evaluate rewrites it
        _tradeoff_cache.update(mtime=mtime, data=json.loads(f.read_text()))
    return _tradeoff_cache["data"]
