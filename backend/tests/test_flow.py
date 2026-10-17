"""End-to-end API test: enroll -> genuine -> new phone -> takeover -> selfie -> reviewer.

    python -m tests.test_flow       (or: pytest tests)
"""
import numpy as np
from fastapi.testclient import TestClient

from app import config as C
from app.main import app
from app.store import store
from ml.data_gen import make_persona, new_phone_shift, sample_payload

RID = "TEST_RIDER"


def test_full_flow():
    client = TestClient(app)
    rng = np.random.default_rng(1)
    owner, renter = make_persona(rng), make_persona(rng)
    pin = "2580"
    base = {"rider_id": RID, "name": "Test Rider", "pin": pin, "device_id": "phone-A", "sim_id": "sim-1",
            "city": "Mumbai", "lat": 19.07, "lon": 72.87}
    client.post(f"/riders/{RID}/reset")
    ts = 1_760_000_000

    def login(persona, **ctx):
        nonlocal ts
        ts += 6 * 3600
        s = client.post("/session/start", json={**base, **ctx, "ts": ts}).json()
        return client.post(f"/session/{s['session_id']}/events", json=sample_payload(persona, pin, rng)).json()

    with client.websocket_connect("/ws") as ws:
        # 1. Enrollment
        for i in range(C.MIN_ENROLL):
            out = login(owner)
            assert out["action"] == "ENROLLING", out
        assert ws.receive_json()["type"] == "session"

    # 2. Wrong PIN is rejected
    r = client.post("/session/start", json={**base, "pin": "0000"})
    assert r.status_code == 401

    # 3. Same person, same phone -> allowed
    out = login(owner)
    print("genuine        ", out["trust"], out["action"], "|", out["verdict"])
    assert out["action"] == "ALLOW"

    # 4. Same person, new phone + new city -> still allowed (context changed, person same)
    out = login(new_phone_shift(owner, rng), device_id="phone-B", city="Pune", lat=18.52, lon=73.85)
    print("new phone+city ", out["trust"], out["action"], "|", out["verdict"])
    assert out["action"] in ("ALLOW", "SOFT_CHECK"), out
    assert out["context_risk"] > 30

    # 5. Different person, SAME phone + city -> escalated within a few shifts
    #    (a single borderline session only gets a soft check; drift accumulates)
    for shift in range(1, 4):
        out = login(renter)
        print(f"takeover shift {shift}", out["trust"], out["action"], "|", out["verdict"])
        assert out["action"] != "ALLOW", out
        if out["action"] in ("STEP_UP", "REVIEW"):
            break
    print("   reasons:", out["reasons"])
    assert out["action"] in ("STEP_UP", "REVIEW"), out
    sid = out["session_id"]

    # 6. Selfie -> review queue -> reviewer rejects
    assert client.post(f"/session/{sid}/stepup", json={"image": "data:image/jpeg;base64,AAAA"}).json()["status"] == "PENDING_REVIEW"
    assert client.get(f"/session/{sid}/selfie").json()["image"].startswith("data:image")
    assert any(a["session_id"] == sid for a in client.get("/alerts").json())
    assert client.post(f"/session/{sid}/resolve", json={"decision": "reject"}).json()["status"] == "BLOCKED"

    # 7. Dashboard endpoints
    riders = client.get("/riders").json()
    assert any(r["rider_id"] == RID for r in riders)
    detail = client.get(f"/riders/{RID}").json()
    assert len(detail["history"]) == C.MIN_ENROLL + 2 + shift
    assert client.post("/config", json={"threshold": 55}).json()["threshold"] == 55
    client.post("/config", json={"threshold": C.DEFAULT_THRESHOLD})
    base_dbg = client.get(f"/riders/{RID}/baseline").json()
    assert base_dbg["groups"]["keystroke"]["features"]["dwell_0"]["std"] > 0

    client.post(f"/riders/{RID}/reset")
    assert RID not in store.profiles


def test_replay_attack():
    """A bot replaying the owner's recorded PIN entry matches TOO perfectly."""
    client = TestClient(app)
    rng = np.random.default_rng(2)
    owner, rid, pin = make_persona(rng), "TEST_REPLAY", "1397"
    client.post(f"/riders/{rid}/reset")
    ctx = {"rider_id": rid, "pin": pin, "device_id": "phone-A", "city": "Mumbai"}
    recorded = None
    for _ in range(C.MIN_ENROLL + 2):
        payload = sample_payload(owner, pin, rng)
        recorded = recorded or payload
        sid = client.post("/session/start", json=ctx).json()["session_id"]
        out = client.post(f"/session/{sid}/events", json=payload).json()
    assert out["action"] == "ALLOW", out

    sid = client.post("/session/start", json=ctx).json()["session_id"]
    out = client.post(f"/session/{sid}/events", json=recorded).json()
    print("replayed login ", out["trust"], out["action"], "|", out["verdict"])
    assert out["action"] in ("STEP_UP", "REVIEW"), out
    assert "replay" in out["verdict"]
    client.post(f"/riders/{rid}/reset")


def test_mid_session_handoff(seed=7):
    """Owner types the PIN, then hands the phone over: the swipes give it away."""
    client = TestClient(app)
    rng = np.random.default_rng(seed)
    owner, renter, rid, pin = make_persona(rng), make_persona(rng), "TEST_HANDOFF", "5555"
    client.post(f"/riders/{rid}/reset")
    ctx = {"rider_id": rid, "pin": pin, "device_id": "phone-A", "city": "Mumbai"}

    def phone_only(persona):
        pl = sample_payload(persona, pin, rng)
        pl.pop("riding")  # real phones don't send trip summaries
        return pl

    for _ in range(C.MIN_ENROLL + 4):
        sid = client.post("/session/start", json=ctx).json()["session_id"]
        client.post(f"/session/{sid}/events", json=phone_only(owner))

    sid = client.post("/session/start", json=ctx).json()["session_id"]
    pl = phone_only(owner)
    out = client.post(f"/session/{sid}/events", json={"keystrokes": pl["keystrokes"], "motion": pl["motion"]}).json()
    assert out["action"] == "ALLOW", out  # clean login by the owner
    for _ in range(8):
        r = phone_only(renter)
        out = client.post(f"/session/{sid}/events", json={"touches": r["touches"][:1], "motion": r["motion"]}).json()
    print("handoff        ", out["trust"], out["action"], "|", out["verdict"])
    assert out["action"] in ("STEP_UP", "REVIEW"), out
    assert "handed over" in out["verdict"]
    client.post(f"/riders/{rid}/reset")


def test_shared_from_day_one(seed=4):
    """Two people take turns during enrollment: the baseline splits into two clusters."""
    client = TestClient(app)
    rng = np.random.default_rng(seed)
    a, b, rid, pin = make_persona(rng), make_persona(rng), "TEST_SHARED", "8080"
    client.post(f"/riders/{rid}/reset")
    ctx = {"rider_id": rid, "pin": pin, "device_id": "phone-A", "city": "Mumbai"}
    for i in range(C.MIN_ENROLL):
        sid = client.post("/session/start", json=ctx).json()["session_id"]
        out = client.post(f"/session/{sid}/events", json=sample_payload(a if i % 2 else b, pin, rng)).json()
    print("shared day one ", out["trust"], out["action"], "|", out["verdict"])
    assert out["action"] == "STEP_UP", out
    assert client.get(f"/riders/{rid}").json()["shared_enrollment"] is True
    assert any(al["rider_id"] == rid and al["alert_type"] == "STEP_UP" for al in client.get("/alerts").json())
    client.post(f"/riders/{rid}/reset")


def test_pin_lockout():
    client = TestClient(app)
    rid = "TEST_LOCK"
    client.post(f"/riders/{rid}/reset")
    ctx = {"rider_id": rid, "device_id": "phone-A"}
    assert client.post("/session/start", json={**ctx, "pin": "4321"}).status_code == 200
    codes = [client.post("/session/start", json={**ctx, "pin": "0000"}).status_code for _ in range(C.PIN_MAX_FAILS)]
    assert codes == [401] * (C.PIN_MAX_FAILS - 1) + [423], codes
    # Even the right PIN is refused while locked
    assert client.post("/session/start", json={**ctx, "pin": "4321"}).status_code == 423
    assert any(a["alert_type"] == "PIN_LOCKOUT" and a["rider_id"] == rid for a in client.get("/alerts").json())
    print("pin lockout     after", C.PIN_MAX_FAILS, "wrong PINs:", codes[-1])
    client.post(f"/riders/{rid}/reset")


if __name__ == "__main__":
    test_full_flow()
    test_replay_attack()
    test_mid_session_handoff()
    test_shared_from_day_one()
    test_pin_lockout()
    print("\nALL CHECKS PASSED")
