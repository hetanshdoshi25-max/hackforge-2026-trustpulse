"""Request bodies. This is the contract with the rider app (see docs/API.md)."""
from pydantic import BaseModel, Field


class SessionStart(BaseModel):
    rider_id: str
    name: str | None = None
    pin: str | None = None
    device_id: str
    sim_id: str | None = None
    city: str | None = None
    lat: float | None = None
    lon: float | None = None
    ts: float | None = Field(None, description="Epoch seconds. Defaults to server time.")


class Key(BaseModel):
    key: str
    down: float  # ms, performance.now()
    up: float
    x: float | None = None  # tap offset from button centre, -1..1
    y: float | None = None
    size: float | None = None  # pointer contact size in px


class Gesture(BaseModel):
    dur: float  # ms
    dx: float  # px, end - start
    dy: float
    path: float  # px, total path length
    size: float | None = None


class Motion(BaseModel):
    t: float
    ax: float | None = None  # accelerationIncludingGravity
    ay: float | None = None
    az: float | None = None
    beta: float | None = None  # deviceorientation
    gamma: float | None = None


class Riding(BaseModel):
    avg_speed: float | None = None
    harsh_brake: float | None = None
    accel_std: float | None = None
    night_ratio: float | None = None


class Events(BaseModel):
    keystrokes: list[Key] = []
    touches: list[Gesture] = []
    motion: list[Motion] = []
    riding: Riding | None = None


class StepUp(BaseModel):
    image: str  # data URL (image/jpeg)


class Resolve(BaseModel):
    decision: str  # "approve" | "reject"


class ConfigIn(BaseModel):
    threshold: int = Field(ge=10, le=95)
