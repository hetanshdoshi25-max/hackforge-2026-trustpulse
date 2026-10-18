"""Production entry point: ONE service serves the API and the built frontend.

    uvicorn app.serve:app --host 0.0.0.0 --port 8000

  /api/...   the TrustPulse API (same routes as app.main, under /api)
  /ws        live WebSocket updates
  /...       the React app (frontend/dist), with SPA fallback for deep links

Same origin for everything: no CORS, no proxy, and the platform's HTTPS covers the
phone's sensors and camera.
"""
import os
from pathlib import Path

from fastapi import FastAPI, HTTPException, WebSocket
from fastapi.responses import FileResponse

from .main import app as api
from .main import lifespan, ws_endpoint

DIST = Path(os.environ.get("TRUSTPULSE_STATIC", Path(__file__).resolve().parents[2] / "frontend" / "dist")).resolve()

# A mounted sub-app's lifespan doesn't run, so the root app owns it (periodic profile saves).
app = FastAPI(title="TrustPulse", lifespan=lifespan, docs_url=None, redoc_url=None)
app.mount("/api", api)


@app.websocket("/ws")
async def ws(websocket: WebSocket):
    await ws_endpoint(websocket)


@app.get("/{path:path}", include_in_schema=False)
def frontend(path: str):
    """Static file if it exists, otherwise index.html so /dashboard, /stage... work on reload."""
    if not DIST.exists():
        raise HTTPException(503, f"Frontend not built: {DIST} missing (run npm run build in frontend/)")
    target = (DIST / path).resolve()
    if path and target.is_file() and DIST in target.parents:
        return FileResponse(target)
    return FileResponse(DIST / "index.html")
