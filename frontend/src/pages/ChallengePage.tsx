import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { socketService } from '../services/websocket';
import type { ChallengeAttempt, ChallengeBoard, Session, WebSocketMessage } from '../types/api';
import { Fingerprint3D } from '../three/Fingerprint3D';
import { getActionHex } from '../utils/status';
import { ActionTag, Btn, Empty, Label, Wordmark } from '../components/ui/kit';

/**
 * Projector view of "Can you fool TrustPulse?". Everyone gets the rider's PIN; the
 * leaderboard shows how close anyone's behaviour got. Attempts never change the profile.
 */
export const ChallengePage: React.FC = () => {
  const [board, setBoard] = useState<ChallengeBoard | null>(null);
  const [latest, setLatest] = useState<{ attempt: ChallengeAttempt; session: Session } | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [targetInput, setTargetInput] = useState('');
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
      setBoard(await api.setChallenge(targetInput.trim() || board.target, pinInput.trim() || null));
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
    <div className="min-h-screen bg-ink text-paper">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-8 py-4">
        <Link to="/dashboard" aria-label="Back to dashboard">
          <Wordmark />
        </Link>
        <div className="flex items-baseline gap-3">
          <span className="label">Join on your phone</span>
          {joinUrl ? (
            <span className="font-mono text-[15px] text-paper">{joinUrl}</span>
          ) : (
            <span className="text-[13px] text-paper-2">
              the /play address that <code className="font-mono">python start.py --phone</code> printed
            </span>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-[1520px] px-8 pb-10 pt-10">
        <div className="grid grid-cols-1 items-end gap-8 border-b border-line pb-8 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <Label>The challenge · {board?.target_name ?? 'the rider'}'s PIN is public</Label>
            <h1 className="mt-4 font-serif text-[64px] leading-[0.9] md:text-[96px]">
              Can you fool <em>TrustPulse?</em>
            </h1>
            <p className="mt-4 max-w-xl text-[16px] text-paper-2">
              Everyone gets the PIN. Log in as {board?.target_name ?? 'them'}. The engine has to notice it isn't them.
            </p>
          </div>
          <div className="grid grid-cols-3 divide-x divide-line border-x border-line">
            {[
              ['Attempts', board?.attempts ?? 0, 'var(--color-paper)'],
              ['Caught', caught, '#34d399'],
              ['Fooled it', board?.fooled ?? 0, board?.fooled ? '#e11d48' : 'var(--color-paper)'],
            ].map(([l, v, c]) => (
              <div key={l as string} className="px-5 py-2">
                <div className="label">{l}</div>
                <div className="tnum mt-2 font-mono text-[64px] font-light leading-none" style={{ color: c as string }}>
                  {v}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_1.1fr]">
          <section>
            <div className="flex items-baseline justify-between">
              <Label>Leaderboard · closest to {board?.target_name ?? '-'}</Label>
              <span className="font-mono text-[11px] text-dim">best behaviour match</span>
            </div>
            {board && board.leaderboard.length > 0 ? (
              <ol className="mt-3 border-t border-line">
                {board.leaderboard.map((e, i) => (
                  <li key={e.challenger} className="grid grid-cols-[2.5rem_1fr_auto_6.5rem] items-center gap-4 border-b border-line py-3.5 animate-rise">
                    <span className="tnum font-mono text-[13px] text-dim">{String(i + 1).padStart(2, '0')}</span>
                    <span className="min-w-0">
                      <span className="block truncate font-serif text-[28px] leading-none">{e.challenger}</span>
                      <span className="mt-1 block font-mono text-[11px] text-mute">
                        {e.attempts} {e.attempts === 1 ? 'try' : 'tries'}
                      </span>
                    </span>
                    <span className="tnum font-mono text-[34px] font-light leading-none">
                      {e.best_match ?? '-'}
                      <span className="text-[16px] text-mute">%</span>
                    </span>
                    <span
                      className="justify-self-end font-mono text-[11px] uppercase tracking-[0.14em]"
                      style={{ color: e.fooled ? '#e11d48' : '#34d399' }}
                    >
                      ■ {e.fooled ? 'fooled' : 'caught'}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <Empty title="No attempts yet">Be the first. Open /play on your phone.</Empty>
            )}
            <p className="mt-4 font-mono text-[11px] text-dim">% = how close your typing rhythm, thumb position and grip got to the real rider.</p>
          </section>

          <section className="border-line lg:border-l lg:pl-10">
            <Label>Latest attempt</Label>
            {latest ? (
              <>
                <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
                  <span className="font-serif text-[40px] leading-none">{latest.attempt.challenger}</span>
                  <span className="flex items-center gap-4">
                    <ActionTag action={latest.attempt.action} size="lg" />
                    <span className="tnum font-mono text-[22px]" style={{ color: getActionHex(latest.attempt.action) }}>
                      {latest.attempt.behaviour_match ?? '-'}% match
                    </span>
                  </span>
                </div>
                <Fingerprint3D signals={latest.session.signals} action={latest.attempt.action} height={380} />
                <p className="text-center font-serif text-[20px] italic text-paper-2">{latest.session.verdict}</p>
              </>
            ) : (
              <div className="flex h-[420px] items-center justify-center font-serif text-[28px] text-dim">Waiting for the first challenger</div>
            )}
          </section>
        </div>

        {/* presenter controls */}
        <div className="mt-12 flex flex-wrap items-end gap-6 border-t border-line pt-5">
          <span className="label self-center">Presenter</span>
          <label>
            <span className="label">Target rider</span>
            <input
              value={targetInput}
              onChange={(e) => setTargetInput(e.target.value.slice(0, 40))}
              placeholder={board?.target ?? 'DEMO1'}
              className="field mt-1 block w-32"
              aria-label="Challenge target rider ID"
            />
          </label>
          <label>
            <span className="label">Their PIN</span>
            <input
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder={board?.pin ?? 'PIN'}
              className="field mt-1 block w-24"
              aria-label="Challenge PIN"
            />
          </label>
          <Btn variant="line" onClick={savePin} className="!py-2">
            Publish
          </Btn>
          <Btn variant="ghost" onClick={() => api.resetChallenge().then(setBoard)} className="!py-2">
            Reset leaderboard
          </Btn>
          {msg && <span className="self-center font-mono text-[12px] text-paper-2">{msg}</span>}
        </div>
      </div>
    </div>
  );
};
