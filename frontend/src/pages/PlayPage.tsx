import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, RotateCcw, ShieldAlert, Trophy } from 'lucide-react';
import { api } from '../services/api';
import type { ChallengeBoard, KeyTelemetry, Session } from '../types/api';
import { PinPad } from '../components/rider-app/PinPad';
import { useMotionBuffer } from '../hooks/useMotionBuffer';
import { getActionHex } from '../utils/status';

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

  return (
    <div className="flex min-h-screen flex-col bg-black px-4 py-6 text-slate-100">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col">
        <Link to="/" className="mb-6 flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300">
          <ArrowLeft className="h-4 w-4" /> TrustPulse
        </Link>
        <h1 className="text-2xl font-bold">Can you fool TrustPulse?</h1>
        <p className="mt-1 text-sm text-slate-400">
          You know {board?.target_name ?? 'the rider'}'s PIN. Can you type it <em>like them</em>?
        </p>

        {error && <div className="mt-4 rounded-lg border border-rose-800 bg-rose-950/40 p-3 text-sm text-rose-300">{error}</div>}

        {board && !board.target_enrolled && (
          <div className="mt-6 rounded-lg border border-slate-700 p-4 text-sm text-slate-400">
            The challenge opens once {board.target} has enrolled. Ask the presenter.
          </div>
        )}

        {board?.target_enrolled && stage === 'name' && (
          <div className="mt-8 space-y-3">
            <label className="block text-xs uppercase tracking-wider text-slate-500" htmlFor="challenger">
              Your name (for the leaderboard)
            </label>
            <input
              id="challenger"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 40))}
              placeholder="e.g. Priya, Team Rocket"
              className="w-full rounded-xl border border-slate-700 bg-neutral-900 px-4 py-3 text-base text-slate-100 outline-none focus:border-cyan-500"
            />
            <button
              onClick={begin}
              disabled={!name.trim()}
              className="w-full rounded-xl bg-cyan-500 py-3 font-semibold text-black transition hover:bg-cyan-400 disabled:opacity-40"
            >
              Start
            </button>
          </div>
        )}

        {board?.target_enrolled && stage === 'pin' && (
          <div className="mt-6">
            <div className="mb-4 rounded-xl border border-slate-800 bg-neutral-900/60 p-3 text-center text-sm">
              Log in as <strong>{board.target_name}</strong> · PIN{' '}
              <strong className="font-mono text-lg tracking-[0.3em] text-cyan-300">{board.pin ?? 'ask the presenter'}</strong>
            </div>
            <PinPad onPinComplete={submit} />
          </div>
        )}

        {stage === 'scoring' && <div className="mt-16 text-center text-slate-400">Comparing you with {board?.target_name}…</div>}

        {stage === 'result' && result && (
          <div className="mt-8 space-y-5 text-center">
            <div
              className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-2"
              style={{ borderColor: getActionHex(result.action), color: getActionHex(result.action) }}
            >
              {fooled ? <Trophy className="h-9 w-9" /> : <ShieldAlert className="h-9 w-9" />}
            </div>
            <div className="text-3xl font-bold">{fooled ? 'You fooled it!' : 'Caught.'}</div>
            <div className="text-slate-300">
              Your behaviour matched {board?.target_name} <strong className="text-slate-100">{match ?? '-'}%</strong>
            </div>
            <div className="text-sm text-slate-500">{result.verdict}</div>
            <button
              onClick={() => {
                setResult(null);
                setStage('pin');
              }}
              className="mx-auto flex items-center gap-2 rounded-xl border border-slate-700 px-5 py-2.5 text-sm hover:bg-neutral-900"
            >
              <RotateCcw className="h-4 w-4" /> Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
