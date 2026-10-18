import { useCallback, useEffect, useRef } from 'react';
import type { MotionTelemetry } from '../types/api';

const BUFFER = 300; // ~5 s at 60 Hz

/**
 * Rolling buffer of phone motion + tilt, so a login can send what happened WHILE the
 * PIN was typed. `since(t0)` returns samples after a performance.now() time (<= 60).
 */
export function useMotionBuffer() {
  const buf = useRef<MotionTelemetry[]>([]);

  useEffect(() => {
    let beta: number | null = null;
    let gamma: number | null = null;
    const onOrient = (e: DeviceOrientationEvent) => {
      beta = e.beta === null ? null : Number(e.beta.toFixed(1));
      gamma = e.gamma === null ? null : Number(e.gamma.toFixed(1));
    };
    const onMotion = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity;
      if (!a || a.x === null || a.y === null || a.z === null) return;
      buf.current.push({ t: Number(performance.now().toFixed(1)), ax: a.x, ay: a.y, az: a.z, beta, gamma });
      if (buf.current.length > BUFFER) buf.current.splice(0, buf.current.length - BUFFER);
    };
    window.addEventListener('deviceorientation', onOrient);
    window.addEventListener('devicemotion', onMotion);
    return () => {
      window.removeEventListener('deviceorientation', onOrient);
      window.removeEventListener('devicemotion', onMotion);
    };
  }, []);

  const since = useCallback((t0: number): MotionTelemetry[] => {
    const recent = buf.current.filter((m) => m.t >= t0);
    const step = Math.max(1, Math.ceil(recent.length / 60));
    return recent.filter((_, i) => i % step === 0);
  }, []);

  /** iOS asks for permission separately for motion and tilt, from a user gesture. */
  const requestPermission = useCallback(async () => {
    for (const ev of [window.DeviceMotionEvent, window.DeviceOrientationEvent] as unknown as {
      requestPermission?: () => Promise<string>;
    }[]) {
      try {
        await ev?.requestPermission?.();
      } catch {
        // denied or unsupported: login still works, just without the grip signal
      }
    }
  }, []);

  return { since, requestPermission };
}
