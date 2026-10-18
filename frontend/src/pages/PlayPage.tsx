import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import type { ChallengeBoard, KeyTelemetry, Session } from '../types/api';
import { PinPad } from '../components/rider-app/PinPad';
import { useMotionBuffer } from '../hooks/useMotionBuffer';
import { getActionHex } from '../utils/status';
import { Btn, Label, Meter, Wordmark } from '../components/ui/kit';

/**
 * Phone side of "Can you fool TrustPulse?": you know the rider's PIN; can you type it
 * like them? Attempts are scored on a copy of the profile and never change it.
 */
function getDeviceId() {
  try {
    const k = 'trustpulse_demo_device_id';
    const id = localStorage.getItem(k) || `dev-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(k, id);
    return id;
  } catch {
    return 'challenge-device';
  }
}

export const PlayPage: React.FC = () => {
  const [board, setBoard] = useState<ChallengeBoard | null>(null);
  const [name, setName] = useState(() => {
    try {
      return localStorage.getItem('trustpulse_challenger') || '';
    } catch {
      return '';
    }
  });
  const [stage, setStage] = useState<'name' | 'pin' | 'scoring' | 'result'>('name');
  const [result, setResult] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const motion = useMotionBuffer();

  useEffect(() => {
    api.getChallenge().then(setBoard).catch(() => setError('TrustPulse server not reachable'));
  }, []);

  const begin = async () => {
    try {
      localStorage.setItem('trustpulse_challenger', name.trim());
    } catch {
      // private mode: fine
    }
    await motion.requestPermission();
    setError(null);
    setStage('pin');
  };

  const submit = async (pin: string, keystrokes: KeyTelemetry[]) => {
    if (!board) return;
    setStage('scoring');
    try {
      const s = await api.startSession({
        rider_id: board.target,
        pin,
        device_id: getDeviceId(),
        city: 'Mumbai',
        lat: 19.07,
        lon: 72.87,
        challenger: name.trim(),
      });
      const m = motion.since(keystrokes.length ? keystrokes[0].down - 300 : performance.now() - 3000);
      setResult(await api.sendSessionEvents(s.session_id, { keystrokes, ...(m.length ? { motion: m } : {}) }));
      setStage('result');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Attempt failed');
      setStage('pin');
    }
  };

  const match = result?.behaviour_risk == null ? null : 100 - result.behaviour_risk;
  const fooled = result?.action === 'ALLOW';

  const hex = result ? getActionHex(result.action) : '#edebe6';

  return (
    <div className="flex min-h-[100dvh] flex-col bg-ink text-paper">
      <header className="border-b border-line">
        <div className="mx-auto flex h-14 w-full max-w-md items-center justify-between px-5">
          <Link to="/" aria-label="TrustPulse home">
            <Wordmark size="sm" />
          </Link>
          <span className="label">The challenge</span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 py-7">
        <Label>You know the PIN</Label>
        <h1 className="mt-3 font-serif text-[44px] leading-[0.94]">
          Can you fool <em>TrustPulse?</em>
        </h1>
        <p className="mt-3 text-[14.5px] leading-relaxed text-paper-2">
          You have {board?.target_name ?? 'the rider'}'s PIN. Now type it <em>like them</em>.
        </p>

        {error && <div className="mt-5 border-l-2 border-review pl-3 font-mono text-[12px] text-[#ff6b86]">{error}</div>}

        {board && !board.target_enrolled && (
          <div className="mt-8 border-l-2 border-line-2 pl-4 text-[14px] text-paper-2">
            The challenge opens once {board.target} has enrolled. Ask the presenter.
          </div>
        )}

        {board?.target_enrolled && stage === 'name' && (
          <div className="mt-10 animate-rise">
            <label className="label" htmlFor="challenger">
              Your name, for the leaderboard
            </label>
            <input
              id="challenger"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 40))}
              placeholder="Priya, Team Rocket"
              className="field mt-2 w-full !py-3 !font-sans !text-[22px]"
            />
            <p className="mt-4 text-[12.5px] leading-relaxed text-mute">
              Your typing rhythm and grip are compared with the rider's for this attempt only, then discarded. Only your name and score
              reach the leaderboard.
            </p>
            <Btn variant="solid" onClick={begin} disabled={!name.trim()} className="mt-6 w-full py-3.5 text-[14px]">
              Start
            </Btn>
          </div>
        )}

        {board?.target_enrolled && stage === 'pin' && (
          <div className="mt-7 animate-rise">
            <div className="mb-7 flex items-end justify-between border-y border-line py-3">
              <div>
                <div className="label">Log in as</div>
                <div className="mt-1 text-[16px] text-paper">{board.target_name}</div>
              </div>
              <div className="text-right">
                <div className="label">PIN</div>
                <div className="mt-1 font-mono text-[24px] tracking-[0.3em] text-paper">{board.pin ?? 'ask'}</div>
              </div>
            </div>
            <PinPad onPinComplete={submit} />
          </div>
        )}

        {stage === 'scoring' && (
          <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
            <div className="font-serif text-[28px]">Comparing you with {board?.target_name}</div>
            <div className="relative h-px w-48 overflow-hidden bg-line">
              <span className="absolute inset-y-0 w-1/3 animate-sweep bg-paper" />
            </div>
          </div>
        )}

        {stage === 'result' && result && (
          <div className="mt-10 animate-rise">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.14em]" style={{ color: hex }}>
              ■ {fooled ? 'Let in' : 'Not let in'}
            </div>
            <div className="mt-3 font-serif text-[64px] leading-[0.9]">{fooled ? <em>You fooled it.</em> : 'Caught.'}</div>
            <div className="mt-8 flex items-end justify-between">
              <span className="label">Your behaviour matched {board?.target_name}</span>
              <span className="tnum font-mono text-[40px] leading-none" style={{ color: hex }}>
                {match ?? '-'}
                <span className="text-[18px] text-mute">%</span>
              </span>
            </div>
            <Meter value={match} color={hex} thick className="mt-3" />
            <p className="mt-5 text-[13.5px] leading-relaxed text-paper-2">{result.verdict}</p>
            <Btn
              variant="line"
              className="mt-8 w-full py-3"
              onClick={() => {
                setResult(null);
                setStage('pin');
              }}
            >
              Try again
            </Btn>
          </div>
        )}
      </main>
    </div>
  );
};
