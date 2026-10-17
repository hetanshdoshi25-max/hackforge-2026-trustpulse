"""TrustPulse API. Run: uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"""
import hashlib
import json
import time

from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from . import config as C
from .engine import process_batch, start_session, verify_identity
from .schemas import ConfigIn, Events, Resolve, SessionStart, StepUp
from .store import DATA_DIR, store

app = FastAPI(title="TrustPulse", description="Continuous rider identity engine")
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

def pin_hash(rider_id, pin):
    return hashlib.sha256(f"{rider_id}:{pin}".encode()).hexdigest()


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


async def raise_alert(s, kind):
    alert = {**public(s), "alert_type": kind, "alert_at": time.time()}
    alert.pop("timeline")
    store.alerts.append(alert)
    del store.alerts[:-300]
    await hub.send("alert", alert)


# ---------------------------------------------------------------- session endpoints

@app.get("/health")
def health():
    return {"ok": True, "riders": len(store.profiles), "sessions": len(store.sessions)}


@app.post("/session/start")
async def session_start(body: SessionStart, request: Request):
    profile = store.profile(body.rider_id, body.name)
    if body.pin:
        h = pin_hash(body.rider_id, body.pin)
        if profile.pin_hash is None:
            profile.pin_hash = h
        elif profile.pin_hash != h:
            raise HTTPException(401, "Wrong PIN")
    ctx = body.model_dump(exclude={"pin", "name"})
    ctx["ts"] = ctx["ts"] or time.time()
    ctx["ip"] = request.client.host if request.client else None
    s = start_session(profile, ctx)
    s["received_at"] = time.time()
    store.add_session(s)
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
    process_batch(profile, s, body.model_dump(), threshold=store.threshold, now=time.time())
    s["received_at"] = time.time()
    store.save()
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
        store.save()
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


@app.post("/riders/{rider_id}/reset")
async def rider_reset(rider_id: str):
    store.reset_rider(rider_id)
    await hub.send("rider_reset", {"rider_id": rider_id})
    return {"ok": True}


@app.get("/config")
def get_config():
    return {"threshold": store.threshold, "min_enroll": C.MIN_ENROLL}


@app.post("/config")
async def set_config(body: ConfigIn):
    store.threshold = body.threshold
    await hub.send("config", {"threshold": store.threshold})
    return get_config()


@app.get("/metrics/tradeoff")
def tradeoff():
    f = DATA_DIR / "tradeoff.json"
    if not f.exists():
        raise HTTPException(404, "Run `python -m ml.evaluate` first")
    return json.loads(f.read_text())
