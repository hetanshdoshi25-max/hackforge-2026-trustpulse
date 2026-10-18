"""Start TrustPulse with one command: backend + frontend (+ demo setup).

    python start.py                 # backend + frontend
    python start.py --demo          # + demo threshold 45 + live simulated riders
    python start.py --phone         # HTTPS so a phone on the same WiFi can open the rider app
    python start.py --demo --phone  # everything for demo day

Ctrl+C stops everything.
"""
import argparse
import json
import os
import signal
import socket
import ssl
import subprocess
import sys
import threading
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"
WINDOWS = os.name == "nt"

COLORS = {"api": "\033[36m", "web": "\033[35m", "sim": "\033[33m", "tp": "\033[92m"}
RESET = "\033[0m"
if WINDOWS:
    os.system("")  # enables ANSI colours in the Windows console
# Vite prints symbols like "➜" that a cp1252 console can't encode; an encoding error would
# kill the reader thread, the child's pipe would fill up and the dev server would freeze.
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

procs: list[subprocess.Popen] = []


def say(tag, msg):
    print(f"{COLORS.get(tag, '')}[{tag}]{RESET} {msg}", flush=True)


def stream(tag, proc):
    for line in iter(proc.stdout.readline, ""):
        if line.strip():
            say(tag, line.rstrip())


def launch(tag, cmd, cwd, env=None):
    p = subprocess.Popen(
        cmd, cwd=cwd, env={**os.environ, **(env or {})},
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding="utf-8", errors="replace",
        shell=WINDOWS and cmd[0] == "npm",  # npm is npm.cmd on Windows
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if WINDOWS else 0,
    )
    procs.append(p)
    threading.Thread(target=stream, args=(tag, p), daemon=True).start()
    return p


def stop_all(*_):
    say("tp", "stopping...")
    for p in procs:
        if p.poll() is None:
            if WINDOWS:  # kill the whole tree (npm -> node -> vite)
                subprocess.run(["taskkill", "/T", "/F", "/PID", str(p.pid)], capture_output=True)
            else:
                p.terminate()
    sys.exit(0)


def wait_for(url, seconds=60):
    # local readiness probe only: the dev HTTPS certificate is self-signed
    ctx = ssl._create_unverified_context() if url.startswith("https") else None
    deadline = time.time() + seconds
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=2, context=ctx):
                return True
        except Exception:
            time.sleep(0.5)
    return False


def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))  # no packet is sent; just picks the outgoing interface
        return s.getsockname()[0]
    except OSError:
        return None
    finally:
        s.close()


def ensure_deps():
    try:
        import fastapi, numpy, uvicorn  # noqa: F401
    except ImportError:
        say("tp", "installing backend dependencies (first run only)...")
        subprocess.run([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"], cwd=BACKEND, check=True)
    if not (FRONTEND / "node_modules").exists():
        say("tp", "installing frontend dependencies (first run only)...")
        subprocess.run(["npm", "install"], cwd=FRONTEND, check=True, shell=WINDOWS)


def main():
    ap = argparse.ArgumentParser(description="Start TrustPulse backend + frontend")
    ap.add_argument("--demo", action="store_true", help="set demo threshold and stream simulated riders")
    ap.add_argument("--phone", action="store_true", help="serve over HTTPS for phones on the same WiFi")
    ap.add_argument("--threshold", type=int, default=45, help="step-up threshold used with --demo (default 45)")
    ap.add_argument("--api-port", type=int, default=8000)
    ap.add_argument("--web-port", type=int, default=5173)
    args = ap.parse_args()

    signal.signal(signal.SIGINT, stop_all)
    if hasattr(signal, "SIGBREAK"):
        signal.signal(signal.SIGBREAK, stop_all)

    ensure_deps()
    api = f"http://127.0.0.1:{args.api_port}"

    say("tp", "starting backend...")
    launch("api", [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", str(args.api_port)], BACKEND)
    if not wait_for(api + "/health"):
        say("tp", f"backend didn't come up on port {args.api_port}. Is something else using it?")
        stop_all()

    say("tp", "starting frontend...")
    web_env = {"VITE_BACKEND_TARGET": api, "VITE_ENABLE_SSL": "true" if args.phone else "false"}
    launch("web", ["npm", "run", "dev", "--", "--port", str(args.web_port), "--strictPort"], FRONTEND, web_env)

    if args.demo:
        req = urllib.request.Request(api + "/config", json.dumps({"threshold": args.threshold}).encode(),
                                     {"Content-Type": "application/json"}, method="POST")
        urllib.request.urlopen(req, timeout=5)
        say("tp", f"demo threshold set to {args.threshold}")
        launch("sim", [sys.executable, "-u", "-m", "ml.simulate_live", "--api", api, "--riders", "25"], BACKEND)

    scheme = "https" if args.phone else "http"
    if wait_for(f"{scheme}://127.0.0.1:{args.web_port}/", 60):
        base = f"{scheme}://localhost:{args.web_port}"
        print()
        say("tp", "TrustPulse is running. Open:")
        say("tp", f"  Start page   {base}/")
        say("tp", f"  Dashboard    {base}/dashboard")
        say("tp", f"  Demo Stage   {base}/stage")
        say("tp", f"  Rider app    {base}/rider")
        say("tp", f"  Challenge    {base}/challenge   (projector leaderboard)")
        ip = lan_ip()
        if args.phone and ip:
            say("tp", f"  On the phone {scheme}://{ip}:{args.web_port}/rider   (same WiFi; accept the certificate warning)")
            say("tp", f"  Challengers  {scheme}://{ip}:{args.web_port}/play")
        say("tp", "Ctrl+C stops everything.")
        print()

    while True:
        for p in procs[:2]:  # backend or frontend died -> stop everything
            if p.poll() is not None:
                say("tp", "a server stopped unexpectedly, shutting down")
                stop_all()
        time.sleep(1)


if __name__ == "__main__":
    main()
