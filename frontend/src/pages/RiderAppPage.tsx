import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import type { KeyTelemetry, MotionTelemetry, Session, SessionStartPayload } from '../types/api';
import { PinPad } from '../components/rider-app/PinPad';
import { ConsentScreen } from '../components/rider-app/ConsentScreen';
import { hasConsent } from '../components/rider-app/consent';
import { StepUpCamera } from '../components/rider-app/StepUpCamera';
import { DemoOrderScreen } from '../components/rider-app/DemoOrderScreen';
import { Btn, Label, Meter, PulseMark, Wordmark } from '../components/ui/kit';
import { getActionHex } from '../utils/status';

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
  // "listening" only means the API exists; this says whether motion data is actually arriving
  const [motionLive, setMotionLive] = useState(false);
  useEffect(() => {
    const t = window.setInterval(() => {
      const buf = motionSamplesRef.current;
      setMotionLive(buf.length > 0 && performance.now() - buf[buf.length - 1].t < 2000);
    }, 1000);
    return () => window.clearInterval(t);
  }, []);

  // Session state
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [consented, setConsented] = useState(hasConsent);
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
        await DeviceMotionEventAny.requestPermission();
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

  const firstName = (riderName.trim() || 'Ramesh').split(/\s+/)[0];
  const hour = new Date().getHours();
  const greeting = hour < 5 ? 'Late shift' : hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="flex min-h-[100dvh] select-none flex-col bg-ink text-paper">
      {/* phone header */}
      <header className="border-b border-line">
        <div className="mx-auto flex h-14 w-full max-w-md items-center justify-between px-5">
          <Wordmark size="sm" />
          <div className="flex items-center gap-4">
            <span
              className="flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.12em]"
              title={motionLive ? 'Phone grip is being read' : "No motion data: phone grip won't be scored"}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${motionLive ? 'bg-allow' : 'bg-soft'}`} />
              <span className={motionLive ? 'text-paper-2' : 'text-soft'}>{motionLive ? 'grip on' : 'no grip'}</span>
            </span>
            <a href="/dashboard" target="_blank" rel="noopener noreferrer" className="font-mono text-[11px] text-mute hover:text-paper">
              ops ↗
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 py-7">
        {!consented ? (
          /* ONE-TIME CONSENT, before any behavioural data is used */
          <ConsentScreen onAccept={() => setConsented(true)} />
        ) : !currentSession ? (
          /* LOGIN */
          <div className="flex flex-1 flex-col">
            <div className="animate-rise">
              <Label>Partner login · {selectedCity.city}</Label>
              <h1 className="mt-3 font-serif text-[42px] leading-[0.95] text-paper">
                {greeting},<br />
                <em>{firstName}.</em>
              </h1>
              <p className="mt-3 text-[14px] text-paper-2">Type your PIN the way you always do.</p>
            </div>

            {loginError && (
              <div className="mt-5 border-l-2 border-review pl-3 font-mono text-[12px] text-[#ff6b86]">{loginError}</div>
            )}

            <div className="mt-8">
              {isLoggingIn ? (
                <div className="flex h-[360px] flex-col items-center justify-center gap-5 text-center">
                  <PulseMark size={44} className="animate-pulse text-paper" />
                  <div className="font-serif text-[26px] text-paper">Reading your rhythm</div>
                  <div className="relative h-px w-48 overflow-hidden bg-line">
                    <span className="absolute inset-y-0 w-1/3 animate-sweep bg-paper" />
                  </div>
                </div>
              ) : (
                <PinPad onPinComplete={handlePinComplete} disabled={isLoggingIn} />
              )}
            </div>

            {!motionLive && (
              <p className="mt-6 text-[12px] leading-relaxed text-mute">
                <span className="text-soft">No motion data.</span>{' '}
                {window.isSecureContext
                  ? 'Tap "Enable sensors" below (iPhone) or allow motion sensors in the browser.'
                  : 'This page is not on https://, so the phone blocks motion sensors and grip is not scored. Open the https:// address that python start.py --phone prints.'}
              </p>
            )}

            {/* demo controls, out of the rider's way */}
            <details className="group mt-auto border-t border-line pt-4 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between pt-6">
                <span className="label">Demo controls</span>
                <span className="font-mono text-[13px] text-mute transition group-open:rotate-45">+</span>
              </summary>
              <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4">
                <label className="block">
                  <span className="label">Rider ID</span>
                  <input value={riderId} onChange={(e) => setRiderId(e.target.value)} className="field mt-1 w-full" />
                </label>
                <label className="block">
                  <span className="label">Name</span>
                  <input value={riderName} onChange={(e) => setRiderName(e.target.value)} className="field mt-1 w-full" />
                </label>
                <label className="block">
                  <span className="label">City</span>
                  <select
                    value={selectedCity.city}
                    onChange={(e) => {
                      const found = INDIAN_CITIES.find((c) => c.city === e.target.value);
                      if (found) setSelectedCity(found);
                    }}
                    className="field mt-1 w-full"
                  >
                    {INDIAN_CITIES.map((c) => (
                      <option key={c.city} value={c.city}>
                        {c.city}
                      </option>
                    ))}
                  </select>
                </label>
                <div>
                  <span className="label">Phone</span>
                  <div className="mt-1 border-b border-line-2 py-1.5 font-mono text-[13px] text-paper-2">{deviceId.slice(0, 11)}</div>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <Btn variant="line" className="flex-1 !py-2 text-[12px]" onClick={handleSimulateNewDevice}>
                  Simulate new phone
                </Btn>
                {!motionLive && (
                  <Btn variant="line" className="flex-1 !py-2 text-[12px]" onClick={requestIosSensors}>
                    Enable sensors
                  </Btn>
                )}
              </div>
            </details>
          </div>
        ) : (
          /* ACTIVE SESSION */
          <div className="flex flex-1 flex-col">
            <SessionVerdict session={currentSession} onOpenCamera={() => setShowStepUpModal(true)} />

            {(currentSession.action === 'ALLOW' ||
              currentSession.action === 'ENROLLING' ||
              currentSession.action === 'SOFT_CHECK') &&
              currentSession.status !== 'BLOCKED' && (
                <div className="mt-9">
                  <DemoOrderScreen
                    session={currentSession}
                    motionSince={motionSince}
                    onSessionUpdate={setCurrentSession}
                    onTriggerStepUp={() => setShowStepUpModal(true)}
                  />
                </div>
              )}

            <button
              onClick={handleLogout}
              className="mt-auto pt-10 text-center font-mono text-[11px] uppercase tracking-[0.16em] text-mute hover:text-paper"
            >
              End shift · new login
            </button>
          </div>
        )}
      </main>

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
    </div>
  );
};

/** What the rider sees after a login: one sentence, never a score sheet. */
const SessionVerdict: React.FC<{ session: Session; onOpenCamera: () => void }> = ({ session: s, onOpenCamera }) => {
  const hex = getActionHex(s.status === 'BLOCKED' ? 'REVIEW' : s.action);
  let kicker: string;
  let title: React.ReactNode;
  let body: React.ReactNode;
  let cta: React.ReactNode = null;

  if (s.status === 'BLOCKED') {
    kicker = 'Account access blocked';
    title = (
      <>
        This login was <em>not you.</em>
      </>
    );
    body = "A reviewer confirmed this session wasn't the registered rider. Contact fleet support.";
  } else if (s.action === 'ENROLLING') {
    kicker = `Learning you · ${s.enroll_progress} of ${s.enroll_target}`;
    title = (
      <>
        Getting to <em>know you.</em>
      </>
    );
    body = 'TrustPulse is learning how you type and hold your phone. A few more logins and your profile is complete.';
  } else if (s.action === 'ALLOW') {
    kicker = s.status === 'VERIFIED' ? 'Verified by the ops team' : 'Same rhythm · same rider';
    title = (
      <>
        You're <em>in.</em>
      </>
    );
    body =
      s.status === 'VERIFIED'
        ? "The operations team confirmed it's you. You're cleared for orders."
        : "Your typing and grip match you. You're cleared for orders.";
  } else if (s.action === 'SOFT_CHECK') {
    kicker = 'Soft check';
    title = (
      <>
        Ride on. <em>Quick check later.</em>
      </>
    );
    body = 'Nothing is blocked. You may be asked for a selfie at your next pickup.';
  } else if (s.action === 'STEP_UP') {
    kicker = 'Verification needed';
    title = (
      <>
        One more <em>step.</em>
      </>
    );
    body = s.verdict || 'A quick selfie confirms it is you.';
    cta = (
      <Btn variant="solid" className="mt-5 w-full py-3.5" onClick={onOpenCamera}>
        Open camera
      </Btn>
    );
  } else {
    kicker = 'Paused for review';
    title = (
      <>
        Hold on, <em>a person will check.</em>
      </>
    );
    body = s.has_selfie
      ? 'Your selfie is with the operations team. This screen updates the moment they decide.'
      : "Send a selfie so the operations team can confirm it's you.";
    cta = !s.has_selfie && (
      <Btn variant="solid" className="mt-5 w-full py-3.5" onClick={onOpenCamera}>
        Send a selfie
      </Btn>
    );
  }

  return (
    <div className="animate-rise">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.14em]" style={{ color: hex }}>
          ■ {kicker}
        </span>
        <span className="tnum font-mono text-[11px] text-mute">trust {s.trust}</span>
      </div>
      <h2 className="mt-4 font-serif text-[46px] leading-[0.95] text-paper">{title}</h2>
      <p className="mt-4 text-[14.5px] leading-relaxed text-paper-2">{body}</p>
      {s.action === 'ENROLLING' ? (
        <div className="mt-5 flex gap-1">
          {Array.from({ length: s.enroll_target }).map((_, i) => (
            <span key={i} className="h-1 flex-1" style={{ background: i < s.enroll_progress ? hex : 'var(--color-line)' }} />
          ))}
        </div>
      ) : (
        <Meter value={s.trust} color={hex} className="mt-5" />
      )}
      {cta}
      <div className="mt-4 font-mono text-[10.5px] text-dim">
        session {s.session_id.slice(0, 8)} · {s.city ?? 'unknown city'}
      </div>
    </div>
  );
};
