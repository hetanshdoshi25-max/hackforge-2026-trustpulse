"""How fast is the engine? Scores real logins through the real engine on ONE CPU core.

    python -m ml.benchmark            # ~20 s, writes data/benchmark.json

The PS talks about tens of thousands of riders and millions of sessions; this turns
"it scales" into a measured number. Payloads are generated up front so only scoring
is timed (feature extraction + baseline stats + distances + fusion + drift + learning).
"""
import json
import os
import platform
import statistics
import time
from pathlib import Path

import numpy as np

from app.engine import Profile, process_batch, start_session
from ml.data_gen import make_persona, sample_payload

OUT = Path(__file__).resolve().parent.parent / "data" / "benchmark.json"


def main(riders=200, logins_per_rider=40, enroll=12):
    rng = np.random.default_rng(3)
    personas = [make_persona(rng) for _ in range(riders)]
    profiles = [Profile(rider_id=f"B{i}") for i in range(riders)]

    # enroll everyone first (not timed)
    for i, (p, prof) in enumerate(zip(personas, profiles)):
        for k in range(enroll):
            process_batch(prof, start_session(prof, {"device_id": "d", "ts": 1.76e9 + k * 86400}), sample_payload(p, "2580", rng))

    work = [(i, sample_payload(personas[i], "2580", rng)) for _ in range(logins_per_rider) for i in range(riders)]
    rng.shuffle(work)

    latencies = []
    t0 = time.perf_counter()
    for n, (i, payload) in enumerate(work):
        s = time.perf_counter()
        prof = profiles[i]
        sess = start_session(prof, {"device_id": "d", "ts": 1.8e9 + n * 60})
        process_batch(prof, sess, payload)
        latencies.append(time.perf_counter() - s)
    total = time.perf_counter() - t0

    per_sec = len(work) / total
    lat = sorted(latencies)
    result = {
        "sessions_scored": len(work),
        "riders": riders,
        "sessions_per_second_one_core": round(per_sec),
        "sessions_per_hour_one_core": round(per_sec * 3600),
        "latency_ms": {
            "median": round(statistics.median(lat) * 1000, 3),
            "p95": round(lat[int(len(lat) * 0.95)] * 1000, 3),
            "p99": round(lat[int(len(lat) * 0.99)] * 1000, 3),
        },
        "cores_on_this_machine": os.cpu_count(),
        "machine": f"{platform.processor() or platform.machine()} · Python {platform.python_version()}",
        "note": "Pure-Python engine, one core, all 4 signals, 40-sample adaptive baselines. HTTP/JSON overhead not included.",
    }
    OUT.write_text(json.dumps(result, indent=1))
    print(f"{len(work):,} logins scored in {total:.1f}s on one core")
    print(f"  {per_sec:,.0f} sessions/s  =  {per_sec * 3600 / 1e6:.1f} million sessions/hour per core")
    print(f"  latency median {result['latency_ms']['median']} ms · p95 {result['latency_ms']['p95']} ms · p99 {result['latency_ms']['p99']} ms")
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
