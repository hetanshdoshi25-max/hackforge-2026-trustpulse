import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, History, Pause, Play } from 'lucide-react';
import type { Session } from '../../types/api';
import { Fingerprint3D, FingerprintLegend } from '../../three/Fingerprint3D';
import { getActionHex, getActionMeta } from '../../utils/status';

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

  return (
    <div className="space-y-3 rounded-xl border border-slate-800 bg-black p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-400">
          <History className="h-4 w-4 text-cyan-400" /> Account time machine · {frames.length} scored sessions
        </span>
        <Link to={`/stage?rider=${encodeURIComponent(s.rider_id)}`} className="text-xs text-cyan-400 hover:text-cyan-300">
          Open on Demo Stage →
        </Link>
      </div>

      {/* one bar per session: height = trust, colour = decision */}
      <div className="relative">
        <div className="flex h-14 items-end gap-[2px]" role="listbox" aria-label="Sessions">
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
              className={`min-w-[3px] flex-1 rounded-t-sm transition-opacity ${i === idx ? 'opacity-100 ring-1 ring-white' : 'opacity-60 hover:opacity-100'}`}
              style={{ height: `${Math.max(8, f.trust)}%`, background: getActionHex(f.action) }}
            />
          ))}
        </div>
        {changeAt >= 0 && (
          <div
            className="pointer-events-none absolute -top-1 bottom-0 border-l-2 border-dashed border-rose-500"
            style={{ left: `${(changeAt / frames.length) * 100}%` }}
          >
            <span className="absolute -top-5 left-1 whitespace-nowrap text-[11px] font-semibold text-rose-300">
              Day {dayOf(frames[changeAt].ts)}: person changed
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            if (idx >= frames.length - 1) setIdx(0);
            setPlaying((p) => !p);
          }}
          className="flex items-center gap-1.5 rounded-lg border border-cyan-700 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-950/40"
        >
          {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />} {playing ? 'Pause' : 'Play history'}
        </button>
        <button aria-label="Previous session" onClick={() => setIdx((i) => Math.max(0, i - 1))} className="rounded-lg border border-slate-700 p-1.5 hover:bg-neutral-900">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button aria-label="Next session" onClick={() => setIdx((i) => Math.min(frames.length - 1, i + 1))} className="rounded-lg border border-slate-700 p-1.5 hover:bg-neutral-900">
          <ChevronRight className="h-4 w-4" />
        </button>
        <input
          type="range"
          min={0}
          max={frames.length - 1}
          value={idx}
          onChange={(e) => {
            setPlaying(false);
            setIdx(Number(e.target.value));
          }}
          className="flex-1 accent-cyan-400"
          aria-label="Session"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1.4fr_1fr]">
        <Fingerprint3D signals={s.signals} action={s.action} height={320} />
        <div className="flex flex-col justify-center gap-2 text-sm">
          <div className="text-xs uppercase tracking-wider text-slate-500">
            Day {dayOf(s.ts)} · {new Date(s.ts * 1000).toLocaleString()}
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-4xl font-bold" style={{ color: getActionHex(s.action) }}>
              {s.trust}
            </span>
            <span
              className="rounded-md border px-2 py-0.5 text-xs font-semibold"
              style={{ color: getActionHex(s.action), borderColor: `${getActionHex(s.action)}88` }}
            >
              {getActionMeta(s.action).label}
            </span>
          </div>
          <div className="text-slate-200">{s.verdict}</div>
          <div className="text-xs text-slate-500">
            {s.city ?? 'Unknown city'} · {s.device_id?.slice(0, 14)}
          </div>
        </div>
      </div>
      <FingerprintLegend className="justify-center" />
    </div>
  );
};
