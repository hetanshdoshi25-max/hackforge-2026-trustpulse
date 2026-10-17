import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import type { KeyTelemetry, MotionTelemetry, Session, SessionStartPayload } from '../types/api';
import { PinPad } from '../components/rider-app/PinPad';
import { StepUpCamera } from '../components/rider-app/StepUpCamera';
import { DemoOrderScreen } from '../components/rider-app/DemoOrderScreen';
import { StatusBadge } from '../components/common/StatusBadge';
import { TrustScore } from '../components/common/TrustScore';
import {
  Smartphone,
  MapPin,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Compass,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';

const INDIAN_CITIES = [
  { city: 'Mumbai', lat: 19.07, lon: 72.87 },
  { city: 'Pune', lat: 18.52, lon: 73.85 },
  { city: 'Delhi', lat: 28.61, lon: 77.21 },
  { city: 'Bengaluru', lat: 12.97, lon: 77.59 },
  { city: 'Hyderabad', lat: 17.38, lon: 78.48 },
];

function getOrCreateDeviceId(): string {
  const key = 'trustpulse_demo_device_id';
  let devId = localStorage.getItem(key);
  if (!devId) {
    devId = 'dev-' + Math.random().toString(36).substring(2, 10);
    localStorage.setItem(key, devId);
  }
  return devId;
}

// ~5 s of samples at 60 Hz
const MOTION_BUFFER = 300;

export const RiderAppPage: React.FC = () => {
  // Demo configuration state
  const [riderId, setRiderId] = useState('DEMO1');
  const [riderName, setRiderName] = useState('Ramesh Kumar');
  const [deviceId, setDeviceId] = useState(getOrCreateDeviceId());
  const [selectedCity, setSelectedCity] = useState(INDIAN_CITIES[0]);

  // Motion sensor collection
  const motionSamplesRef = useRef<MotionTelemetry[]>([]);
  const [sensorStatus, setSensorStatus] = useState<'idle' | 'listening' | 'unsupported'>('idle');

  // Session state
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Step-up camera verification modal
  const [showStepUpModal, setShowStepUpModal] = useState(false);

  // Device orientation / motion listener
  useEffect(() => {
    let motionListener: ((e: DeviceMotionEvent) => void) | null = null;
    let orientationListener: ((e: DeviceOrientationEvent) => void) | null = null;

    // null (not 0) until the sensor reports: a fake 0 would look like a real tilt to the engine
    let currentBeta: number | null = null;
    let currentGamma: number | null = null;

    if (window.DeviceOrientationEvent) {
      orientationListener = (e: DeviceOrientationEvent) => {
        currentBeta = e.beta === null ? null : Number(e.beta.toFixed(1));
        currentGamma = e.gamma === null ? null : Number(e.gamma.toFixed(1));
      };
      window.addEventListener('deviceorientation', orientationListener);
    }

    if (window.DeviceMotionEvent) {
      setSensorStatus('listening');
      motionListener = (e: DeviceMotionEvent) => {
        const acc = e.accelerationIncludingGravity;
        if (!acc || acc.x === null || acc.y === null || acc.z === null) return;
        // Rolling buffer: always the most recent ~5 s, so a login sends what happened WHILE typing.
        const buf = motionSamplesRef.current;
        buf.push({
          t: Number(performance.now().toFixed(1)),
          ax: Number(acc.x.toFixed(2)),
          ay: Number(acc.y.toFixed(2)),
          az: Number(acc.z.toFixed(2)),
          beta: currentBeta,
          gamma: currentGamma,
        });
        if (buf.length > MOTION_BUFFER) buf.splice(0, buf.length - MOTION_BUFFER);
      };
      window.addEventListener('devicemotion', motionListener);
    } else {
      setSensorStatus('unsupported');
    }

    return () => {
      if (motionListener) window.removeEventListener('devicemotion', motionListener);
      if (orientationListener) window.removeEventListener('deviceorientation', orientationListener);
    };
  }, []);

  // Motion samples since a performance.now() timestamp, thinned to <= 60 (the engine averages them).
  const motionSince = (t0: number): MotionTelemetry[] => {
    const recent = motionSamplesRef.current.filter((m) => m.t >= t0);
    const step = Math.max(1, Math.ceil(recent.length / 60));
    return recent.filter((_, i) => i % step === 0);
  };

  // Request iOS permission if needed
  const requestIosSensors = async () => {
    try {
      const DeviceMotionEventAny = window.DeviceMotionEvent as unknown as {
        requestPermission?: () => Promise<'granted' | 'denied'>;
      };
      if (typeof DeviceMotionEventAny.requestPermission === 'function') {
        const permission = await DeviceMotionEventAny.requestPermission();
        if (permission === 'granted') {
          setSensorStatus('listening');
        }
      }
      // iOS gates tilt (beta/gamma) separately from acceleration.
      const DeviceOrientationEventAny = window.DeviceOrientationEvent as unknown as {
        requestPermission?: () => Promise<'granted' | 'denied'>;
      };
      if (typeof DeviceOrientationEventAny.requestPermission === 'function') {
        await DeviceOrientationEventAny.requestPermission();
      }
    } catch {
      // ignore
    }
  };

  // Simulate new device
  const handleSimulateNewDevice = () => {
    const newId = 'dev-' + Math.random().toString(36).substring(2, 10);
    localStorage.setItem('trustpulse_demo_device_id', newId);
    setDeviceId(newId);
  };

  // Handle PIN completion & login
  const handlePinComplete = async (pin: string, keystrokes: KeyTelemetry[]) => {
    setIsLoggingIn(true);
    setLoginError(null);

    const payload: SessionStartPayload = {
      rider_id: riderId.trim() || 'DEMO1',
      name: riderName.trim() || 'Ramesh Kumar',
      pin, // Never logged or stored! Cleared after request
      device_id: deviceId,
      city: selectedCity.city,
      lat: selectedCity.lat,
      lon: selectedCity.lon,
      ts: Math.floor(Date.now() / 1000),
    };

    try {
      const session = await api.startSession(payload);

      // Now send behavioral keystrokes + the motion recorded while the PIN was being typed
      const motionData = motionSince(keystrokes.length ? keystrokes[0].down - 300 : performance.now() - 3000);

      const scoredSession = await api.sendSessionEvents(session.session_id, {
        keystrokes,
        motion: motionData.length > 0 ? motionData : undefined,
      });

      setCurrentSession(scoredSession);

      if (scoredSession.action === 'STEP_UP' || scoredSession.action === 'REVIEW') {
        setShowStepUpModal(true);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      setLoginError(msg);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const sessionId = currentSession?.session_id;
  const awaitingDecision =
    !!currentSession &&
    !showStepUpModal &&
    (currentSession.action === 'REVIEW' || currentSession.status === 'PENDING_REVIEW');
  useEffect(() => {
    if (!sessionId || !awaitingDecision) return;
    const t = window.setInterval(async () => {
      try {
        setCurrentSession(await api.getSession(sessionId));
      } catch {
        // retry on the next tick
      }
    }, 3000);
    return () => window.clearInterval(t);
  }, [sessionId, awaitingDecision]);

  const handleLogout = () => {
    setCurrentSession(null);
    setShowStepUpModal(false);
    setLoginError(null);
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col justify-between p-4 md:p-6 select-none font-mono">
      {/* Rider App Mobile Shell Header */}
      <div className="w-full max-w-sm mx-auto flex items-center justify-between pb-3 border-b border-[#1e2c47]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-cyan-950 border border-cyan-500/50 flex items-center justify-center text-cyan-400">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-xs tracking-wider text-slate-100">
              TRUST<span className="text-cyan-400">PULSE</span>
            </span>
            <span className="text-[10px] text-slate-400 block -mt-0.5">Rider Partner App</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {sensorStatus === 'listening' && (
            <span className="text-[10px] text-emerald-400 flex items-center gap-1 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
              <Compass className="w-3 h-3" /> Sensors Active
            </span>
          )}
          <a
            href="/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
          >
            Ops Console <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="w-full max-w-sm mx-auto my-auto py-4">
        {!currentSession ? (
          /* LOGIN SCREEN */
          <div className="space-y-4">
            <div className="text-center space-y-1">
              <h2 className="text-base font-bold text-slate-100">Partner Login</h2>
              <p className="text-xs text-slate-400">
                Enter your 4-digit security PIN to start session
              </p>
            </div>

            {/* Demo Simulation Controls */}
            <div className="p-3 rounded-xl bg-[#0c1322] border border-[#1e2c47] space-y-2 text-xs">
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold border-b border-slate-800 pb-1.5">
                <span className="flex items-center gap-1 text-cyan-400">
                  <Sparkles className="w-3.5 h-3.5" /> Hackathon Demo Controls
                </span>
                <div className="flex items-center gap-2">
                  {sensorStatus !== 'listening' && (
                    <button
                      type="button"
                      onClick={requestIosSensors}
                      className="text-cyan-400 hover:text-cyan-300 underline text-[10px]"
                    >
                      Enable Sensors
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleSimulateNewDevice}
                    className="text-slate-300 hover:text-white underline text-[10px]"
                  >
                    Simulate New Phone
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-400 block text-[10px]">RIDER ID</span>
                  <input
                    type="text"
                    value={riderId}
                    onChange={(e) => setRiderId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200"
                  />
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">NAME</span>
                  <input
                    type="text"
                    value={riderName}
                    onChange={(e) => setRiderName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] pt-1">
                <div className="flex items-center gap-1 text-slate-300">
                  <MapPin className="w-3 h-3 text-slate-500" />
                  <select
                    value={selectedCity.city}
                    onChange={(e) => {
                      const found = INDIAN_CITIES.find((c) => c.city === e.target.value);
                      if (found) setSelectedCity(found);
                    }}
                    className="bg-slate-900 border border-slate-700 text-slate-200 rounded px-1.5 py-0.5 text-xs"
                  >
                    {INDIAN_CITIES.map((c) => (
                      <option key={c.city} value={c.city}>
                        {c.city}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1 text-slate-400 text-[10px]">
                  <Smartphone className="w-3 h-3 text-slate-500" />
                  <span>{deviceId.slice(0, 8)}...</span>
                </div>
              </div>
            </div>

            {/* Error message */}
            {loginError && (
              <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-xs text-center flex items-center justify-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            {/* On-Screen Custom PIN Keypad */}
            {isLoggingIn ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-center">
                <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
                <span className="text-xs text-slate-300">
                  Analyzing keystroke dynamics & verifying identity...
                </span>
              </div>
            ) : (
              <PinPad onPinComplete={handlePinComplete} disabled={isLoggingIn} />
            )}
          </div>
        ) : (
          /* ACTIVE SESSION SCREEN */
          <div className="space-y-4">
            {/* Session Status Banner */}
            <div className="p-4 rounded-2xl bg-[#0c1322] border border-[#1e2c47] space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-sm text-slate-100">{currentSession.name}</h3>
                  <span className="text-[10px] text-slate-400">
                    Session {currentSession.session_id.slice(0, 8)} · {currentSession.city}
                  </span>
                </div>
                <StatusBadge type="action" value={currentSession.action} size="sm" />
              </div>

              {/* Action-Specific Experience */}
              {currentSession.action === 'ENROLLING' && (
                <div className="p-3 rounded-xl bg-blue-950/50 border border-blue-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-blue-300 font-semibold">Learning Your Normal Pattern</span>
                    <span className="text-blue-400 font-bold">
                      {currentSession.enroll_progress} / {currentSession.enroll_target} Logins
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-blue-950 border border-blue-900 overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all"
                      style={{
                        width: `${(currentSession.enroll_progress / currentSession.enroll_target) * 100}%`,
                      }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    TrustPulse is enrolling your unique PIN typing speed and sensor habits. Log in
                    a few more times to complete your personal behavioral profile.
                  </p>
                </div>
              )}

              {currentSession.action === 'ALLOW' && (
                <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{currentSession.status === 'VERIFIED' ? 'Identity Verified — Session Active' : 'Behavior Verified — Session Active'}</span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    {currentSession.status === 'VERIFIED'
                      ? 'The operations team confirmed it’s you. You are cleared for delivery orders.'
                      : 'Your typing and motion match your baseline. You are cleared for delivery orders.'}
                  </p>
                </div>
              )}

              {currentSession.action === 'SOFT_CHECK' && (
                <div className="p-3 rounded-xl bg-amber-950/50 border border-amber-800 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Soft Check: Quick selfie at next pickup</span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    Non-blocking check. Continue your delivery route normally.
                  </p>
                </div>
              )}

              {currentSession.action === 'STEP_UP' && (
                <div className="p-3 rounded-xl bg-orange-950/50 border border-orange-800 text-xs space-y-2">
                  <div className="flex items-center gap-1.5 text-orange-400 font-bold">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Verification Required</span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    {currentSession.verdict || 'A camera selfie is required to verify identity.'}
                  </p>
                  <button
                    onClick={() => setShowStepUpModal(true)}
                    className="w-full py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-semibold text-xs transition"
                  >
                    Open Camera Verification
                  </button>
                </div>
              )}

              {currentSession.status === 'BLOCKED' ? (
                <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-700 text-xs space-y-1 text-center">
                  <div className="flex items-center justify-center gap-1.5 text-rose-300 font-bold">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Account access blocked</span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    A reviewer confirmed this session wasn't the registered rider. Contact fleet support.
                  </p>
                </div>
              ) : (
                currentSession.action === 'REVIEW' && (
                  <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-800 text-xs space-y-2 text-center">
                    <div className="flex items-center justify-center gap-1.5 text-rose-400 font-bold">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Session Paused Under Review</span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      {currentSession.has_selfie
                        ? 'Your selfie is with the operations team. This screen updates as soon as they decide.'
                        : 'Send a verification selfie so the operations team can confirm it’s you.'}
                    </p>
                    {!currentSession.has_selfie && (
                      <button
                        onClick={() => setShowStepUpModal(true)}
                        className="w-full py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition"
                      >
                        Send Verification Selfie
                      </button>
                    )}
                  </div>
                )
              )}

              {/* Trust Score & Metrics summary */}
              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800">
                <span className="text-slate-400">Trust Score:</span>
                <TrustScore score={currentSession.trust} size="sm" showLabel />
              </div>
            </div>

            {/* Orders Screen for Allowed/Enrolling riders */}
            {(currentSession.action === 'ALLOW' ||
              currentSession.action === 'ENROLLING' ||
              currentSession.action === 'SOFT_CHECK') && (
              <DemoOrderScreen
                session={currentSession}
                motionSince={motionSince}
                onSessionUpdate={setCurrentSession}
                onTriggerStepUp={() => setShowStepUpModal(true)}
              />
            )}

            <button
              onClick={handleLogout}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 text-xs transition flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" /> End Shift / New Session
            </button>
          </div>
        )}
      </div>

      {/* Step-up camera verification modal */}
      {showStepUpModal && currentSession && (
        <StepUpCamera
          session={currentSession}
          onVerified={(updated) => {
            setCurrentSession(updated);
            setShowStepUpModal(false);
          }}
          onBlocked={(updated) => {
            setCurrentSession(updated);
            setShowStepUpModal(false);
          }}
          onClose={() => setShowStepUpModal(false)}
        />
      )}

      {/* Footer */}
      <div className="w-full max-w-sm mx-auto text-center text-[10px] text-slate-400 border-t border-slate-900 pt-2">
        TrustPulse Continuous Behavioral Biometrics · Team Braniacs
      </div>
    </div>
  );
};
