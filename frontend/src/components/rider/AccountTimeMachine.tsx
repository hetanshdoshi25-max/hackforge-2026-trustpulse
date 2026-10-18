import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Session } from '../../types/api';
import { Fingerprint3D, FingerprintLegend } from '../../three/Fingerprint3D';
import { getActionHex, getActionMeta } from '../../utils/status';
import { ActionTag, Btn, Label } from '../ui/kit';

const ESCALATED = new Set(['STEP_UP', 'REVIEW']);

/**
 * Scrub through an account's history and watch its behavioural fingerprint session by
 * session: weeks of the owner inside the shell, then the day someone else took over.
 */
export const AccountTimeMachine: React.FC<{ history: Session[] }> = ({ history }) => {
  const frames = useMemo(() => history.filter((s) => !s.enrolling && s.signals && Object.keys(s.signals).length > 0), [history]);
  const [idx, setIdx] = useState(Math.max(0, frames.length - 1));
  const [playing, setPlaying] = useState(false);

  // follow new sessions while sitting on the latest one
  const [lastLen, setLastLen] = useState(frames.length);
  if (frames.length !== lastLen) {
    setLastLen(frames.length);
    if (idx >= lastLen - 1) setIdx(Math.max(0, frames.length - 1));
  }

  // first escalation after at least one clean login: the moment the person changed
  const changeAt = useMemo(() => {
    const firstAllow = frames.findIndex((s) => s.action === 'ALLOW');
    if (firstAllow < 0) return -1;
    return frames.findIndex((s, i) => i > firstAllow && ESCALATED.has(s.action));
  }, [frames]);

  useEffect(() => {
    if (!playing) return;
    const t = window.setInterval(() => {
      setIdx((i) => {
        if (i >= frames.length - 1) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, 650);
    return () => window.clearInterval(t);
  }, [playing, frames.length]);

  if (frames.length === 0) return null;
  const s = frames[Math.min(idx, frames.length - 1)];
  const day0 = frames[0].ts;
  const dayOf = (ts: number) => Math.floor((ts - day0) / 86400) + 1;
  const hex = getActionHex(s.action);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Label>Account time machine · {frames.length} scored sessions</Label>
          <h2 className="mt-1.5 font-serif text-[30px] leading-none">
            Watch the account, <em>login by login.</em>
          </h2>
        </div>
        <Link to={`/stage?rider=${encodeURIComponent(s.rider_id)}`} className="font-mono text-[11px] text-paper-2 underline underline-offset-4 hover:text-paper">
          open on demo stage →
        </Link>
      </div>

      {/* one tick per session: height = trust, colour = decision */}
      <div className="relative mt-8">
        <div className="flex h-20 items-end gap-[2px] border-b border-line" role="listbox" aria-label="Sessions">
          {frames.map((f, i) => (
            <button
              key={f.session_id}
              role="option"
              aria-selected={i === idx}
              title={`Day ${dayOf(f.ts)} · ${getActionMeta(f.action).label} · trust ${f.trust}`}
              onClick={() => {
                setPlaying(false);
                setIdx(i);
              }}
              className="group relative flex h-full min-w-[3px] flex-1 items-end justify-center"
            >
              <span
                className="block w-full max-w-[8px] transition-opacity group-hover:opacity-100"
                style={{ height: `${Math.max(8, f.trust)}%`, background: getActionHex(f.action), opacity: i === idx ? 1 : i < idx ? 0.55 : 0.28 }}
              />
              {i === idx && <span className="absolute -bottom-3 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-paper" />}
            </button>
          ))}
        </div>
        {changeAt >= 0 && (
          <div className="pointer-events-none absolute -top-6 bottom-0 border-l border-dashed border-review" style={{ left: `${(changeAt / frames.length) * 100}%` }}>
            <span className="absolute -top-1 left-2 whitespace-nowrap font-mono text-[10.5px] text-[#ff6b86]">
              day {dayOf(frames[changeAt].ts)}: person changed
            </span>
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center gap-3">
        <Btn
          variant="solid"
          className="!py-2"
          onClick={() => {
            if (idx >= frames.length - 1) setIdx(0);
            setPlaying((p) => !p);
          }}
        >
          {playing ? 'Pause' : 'Play history'}
        </Btn>
        <Btn variant="line" className="!px-3 !py-2" aria-label="Previous session" onClick={() => setIdx((i) => Math.max(0, i - 1))}>
          ←
        </Btn>
        <Btn variant="line" className="!px-3 !py-2" aria-label="Next session" onClick={() => setIdx((i) => Math.min(frames.length - 1, i + 1))}>
          →
        </Btn>
        <input
          type="range"
          min={0}
          max={frames.length - 1}
          value={idx}
          onChange={(e) => {
            setPlaying(false);
            setIdx(Number(e.target.value));
          }}
          className="hair flex-1"
          aria-label="Session"
        />
        <span className="tnum w-16 text-right font-mono text-[11px] text-mute">
          {idx + 1}/{frames.length}
        </span>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-8 border-t border-line pt-6 md:grid-cols-[1.4fr_1fr]">
        <Fingerprint3D signals={s.signals} action={s.action} height={360} />
        <div className="flex flex-col justify-center">
          <Label>
            Day {dayOf(s.ts)} · {new Date(s.ts * 1000).toLocaleString()}
          </Label>
          <div className="mt-3 flex items-end gap-5">
            <span className="tnum font-mono text-[84px] font-light leading-[0.8]" style={{ color: hex }}>
              {s.trust}
            </span>
            <span className="pb-1">
              <ActionTag action={s.action} size="md" />
            </span>
          </div>
          <p className="mt-5 font-serif text-[21px] leading-snug">{s.verdict}</p>
          <div className="mt-3 font-mono text-[11px] text-dim">
            {s.city ?? 'unknown city'} · {s.device_id?.slice(0, 14)}
          </div>
        </div>
      </div>
      <FingerprintLegend className="mt-4" />
    </div>
  );
};
