import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, RotateCcw, ShieldCheck, Smartphone, Trophy } from 'lucide-react';
import { api } from '../services/api';
import { socketService } from '../services/websocket';
import type { ChallengeAttempt, ChallengeBoard, Session, WebSocketMessage } from '../types/api';
import { Fingerprint3D } from '../three/Fingerprint3D';
import { getActionHex, getActionMeta } from '../utils/status';

/**
 * Projector view of "Can you fool TrustPulse?". Everyone gets the rider's PIN; the
 * leaderboard shows how close anyone's behaviour got. Attempts never change the profile.
 */
export const ChallengePage: React.FC = () => {
  const [board, setBoard] = useState<ChallengeBoard | null>(null);
  const [latest, setLatest] = useState<{ attempt: ChallengeAttempt; session: Session } | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const shownId = useRef<string | null>(null);

  const load = useCallback(
    () =>
      api
        .getChallenge()
        .then((b) => {
          setBoard(b);
          // show the last attempt straight away, not only after the next one arrives
          const attempt = b.latest;
          if (!attempt) {
            shownId.current = null;
            setLatest(null);
          } else if (attempt.session_id !== shownId.current) {
            shownId.current = attempt.session_id;
            api.getSession(attempt.session_id).then((session) => setLatest({ attempt, session })).catch(() => {});
          }
        })
        .catch(() => setMsg('Server not reachable')),
    [],
  );

  useEffect(() => {
    load();
    socketService.connect();
    return socketService.onMessage((m: WebSocketMessage) => {
      if (m.type !== 'challenge') return;
      const data = m.data as { attempt?: ChallengeAttempt; session?: Session; reset?: boolean };
      if (data.attempt && data.session) {
        shownId.current = data.attempt.session_id;
        setLatest({ attempt: data.attempt, session: data.session });
      }
      if (data.reset) setLatest(null);
      load();
    });
  }, [load]);

  const savePin = async () => {
    if (!board) return;
    try {
      setBoard(await api.setChallenge(board.target, pinInput.trim() || null));
      setMsg('PIN published to challengers');
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Could not set PIN');
    }
  };

  // On a phone "localhost" is the phone itself: point people at the laptop's address.
  const local = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const joinUrl = local ? null : `${window.location.origin}/play`;
  const caught = (board?.attempts ?? 0) - (board?.fooled ?? 0);

  return (
    <div className="min-h-screen bg-black px-8 py-6 text-slate-100">
      <header className="flex items-center justify-between">
        <Link to="/dashboard" className="flex items-center gap-2 text-slate-500 hover:text-slate-200">
          <ArrowLeft className="h-5 w-5" /> <span className="text-lg font-bold tracking-[0.2em] text-slate-100">TRUST<span className="text-cyan-400">PULSE</span></span>
        </Link>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Smartphone className="h-4 w-4" /> Join on your phone:{' '}
          {joinUrl ? (
            <span className="font-mono text-cyan-300">{joinUrl}</span>
          ) : (
            <span className="text-cyan-300">the /play address that <code className="font-mono">python start.py --phone</code> printed</span>
          )}
        </div>
      </header>

      <h1 className="mt-8 text-center text-5xl font-black tracking-tight">Can you fool TrustPulse?</h1>
      <p className="mt-3 text-center text-lg text-slate-400">
        Here's {board?.target_name ?? 'the rider'}'s PIN. Log in as them. The engine has to tell it isn't them.
      </p>

      <div className="mx-auto mt-8 grid max-w-6xl grid-cols-3 gap-4 text-center">
        <BigStat label="Attempts" value={board?.attempts ?? 0} />
        <BigStat label="Caught" value={caught} color="#34d399" />
        <BigStat label="Fooled TrustPulse" value={board?.fooled ?? 0} color={board?.fooled ? '#e11d48' : undefined} />
      </div>

      <div className="mx-auto mt-8 grid max-w-6xl grid-cols-1 gap-6 lg:grid-cols-[1fr_1.1fr]">
        <section className="rounded-2xl border border-slate-800 bg-[#0a0a0a] p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm uppercase tracking-widest text-slate-400">
            <Trophy className="h-4 w-4 text-cyan-400" /> Leaderboard: closest to {board?.target_name ?? '-'}
          </h2>
          {board && board.leaderboard.length > 0 ? (
            <ol className="space-y-2">
              {board.leaderboard.map((e, i) => (
                <li key={e.challenger} className="flex items-center gap-3 rounded-xl border border-slate-800 bg-neutral-900/60 px-4 py-3">
                  <span className="w-6 text-right font-mono text-slate-500">{i + 1}</span>
                  <span className="flex-1 truncate text-lg">{e.challenger}</span>
                  <span className="text-xs text-slate-500">{e.attempts} {e.attempts === 1 ? 'try' : 'tries'}</span>
                  <span className="w-20 text-right font-mono text-2xl font-bold">{e.best_match ?? '-'}%</span>
                  <span
                    className="w-20 rounded-md border px-2 py-0.5 text-center text-xs font-semibold"
                    style={{ color: e.fooled ? '#e11d48' : '#34d399', borderColor: e.fooled ? '#e11d4888' : '#34d39988' }}
                  >
                    {e.fooled ? 'FOOLED' : 'CAUGHT'}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="py-10 text-center text-slate-500">No attempts yet. Be the first.</p>
          )}
          <p className="mt-3 text-xs text-slate-500">% = how close your typing rhythm, thumb position and grip got to the real rider.</p>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-[#0a0a0a] p-5">
          <h2 className="mb-1 text-sm uppercase tracking-widest text-slate-400">Latest attempt</h2>
          {latest ? (
            <>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-semibold">{latest.attempt.challenger}</span>
                <span className="flex items-center gap-2 text-lg font-bold" style={{ color: getActionHex(latest.attempt.action) }}>
                  <ShieldCheck className="h-5 w-5" /> {getActionMeta(latest.attempt.action).label} · {latest.attempt.behaviour_match ?? '-'}% match
                </span>
              </div>
              <Fingerprint3D signals={latest.session.signals} action={latest.attempt.action} height={340} />
              <p className="text-center text-sm text-slate-400">{latest.session.verdict}</p>
            </>
          ) : (
            <div className="flex h-[360px] items-center justify-center text-slate-600">Waiting for the first challenger…</div>
          )}
        </section>
      </div>

      {/* presenter controls */}
      <div className="mx-auto mt-8 flex max-w-6xl flex-wrap items-center gap-3 border-t border-slate-900 pt-4 text-sm text-slate-500">
        <span>Presenter: publish {board?.target ?? 'DEMO1'}'s PIN</span>
        <input
          value={pinInput}
          onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
          placeholder={board?.pin ?? 'PIN'}
          className="w-24 rounded-lg border border-slate-700 bg-neutral-900 px-3 py-1.5 font-mono text-slate-100"
          aria-label="Challenge PIN"
        />
        <button onClick={savePin} className="rounded-lg border border-cyan-700 px-3 py-1.5 text-cyan-300 hover:bg-cyan-950/40">
          Publish
        </button>
        <button
          onClick={() => api.resetChallenge().then(setBoard)}
          className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 hover:bg-neutral-900"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Reset leaderboard
        </button>
        {msg && <span className="text-slate-400">{msg}</span>}
      </div>
    </div>
  );
};

const BigStat: React.FC<{ label: string; value: number; color?: string }> = ({ label, value, color }) => (
  <div className="rounded-2xl border border-slate-800 bg-[#0a0a0a] py-5">
    <div className="font-mono text-5xl font-black" style={{ color: color ?? '#f1f5f9' }}>
      {value}
    </div>
    <div className="mt-1 text-xs uppercase tracking-widest text-slate-500">{label}</div>
  </div>
);
