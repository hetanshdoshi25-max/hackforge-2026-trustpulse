import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Activity, AlertOctagon, ArrowLeft, CheckCircle2, Fingerprint, MapPin, ShieldAlert, Smartphone, Sparkles } from 'lucide-react';
import { api } from '../services/api';
import { socketService } from '../services/websocket';
import type { Session, WebSocketMessage } from '../types/api';
import { Fingerprint3D, FingerprintLegend } from '../three/Fingerprint3D';
import { SIGNAL_GROUPS } from '../three/features';
import { getActionHex, getActionMeta } from '../utils/status';

/**
 * Projector view for the live demo. Follows one rider (default DEMO1) or "any live
 * phone" (sessions without a simulator label) and reacts in real time.
 */

const ESCALATED = new Set(['STEP_UP', 'REVIEW']);

function useAnimatedNumber(target: number, ms = 700) {
  const [value, setValue] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(a + (target - a) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return value;
}

type Banner = { kind: 'caught' | 'same-person'; text: string; sub: string } | null;

function bannerFor(s: Session): Banner {
  if (ESCALATED.has(s.action)) {
    return { kind: 'caught', text: 'PERSON CHANGED', sub: s.verdict };
  }
  if (s.action === 'ALLOW' && s.context_risk >= 30) {
    return { kind: 'same-person', text: 'CONTEXT CHANGED · SAME PERSON', sub: 'New phone or city, behaviour matches: no lockout' };
  }
  return null;
}

export const StagePage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const follow = params.get('rider') || 'DEMO1';
  const anyLive = follow === '*';
  const [session, setSession] = useState<Session | null>(null);
  const [banner, setBanner] = useState<Banner>(null);
  const [connected, setConnected] = useState(socketService.getStatus() === 'connected');
  const lastKey = useRef('');

  const accept = (s: Session) => (anyLive ? !s.label : s.rider_id === follow);

  const show = (s: Session) => {
    setSession(s);
    const key = `${s.session_id}:${s.action}:${s.timeline.length}`;
    if (key === lastKey.current) return;
    lastKey.current = key;
    const b = bannerFor(s);
    if (b) {
      setBanner(b);
      window.setTimeout(() => setBanner((cur) => (cur === b ? null : cur)), 6000);
    }
  };

  useEffect(() => {
    setSession(null);
    setBanner(null);
    if (!anyLive) {
      api.getSessions(1, follow).then((list) => list[0] && setSession(list[0])).catch(() => {});
    }
    socketService.connect();
    const offStatus = socketService.onStatusChange((st) => setConnected(st === 'connected'));
    const offMsg = socketService.onMessage((msg: WebSocketMessage) => {
      if (msg.type === 'session' && accept(msg.data as Session)) show(msg.data as Session);
      if (msg.type === 'rider_reset' && (msg.data as { rider_id: string }).rider_id === follow) setSession(null);
    });
    return () => {
      offStatus();
      offMsg();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [follow]);

  const trust = useAnimatedNumber(session?.trust ?? 100);
  const action = session?.action ?? 'ENROLLING';
  const hex = getActionHex(action);
  const meta = getActionMeta(action);
  const alarm = ESCALATED.has(action);
  const timeline = useMemo(() => session?.timeline ?? [], [session]);

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#05080f] text-slate-100">
      {/* ambient vignette in the status colour */}
      <div
        className="pointer-events-none absolute inset-0 transition-[background] duration-700"
        style={{ background: `radial-gradient(ellipse at 35% 50%, ${hex}1f 0%, transparent 60%)` }}
      />
      {alarm && <div className="pointer-events-none absolute inset-0 animate-pulse bg-rose-900/10" />}

      {/* header */}
      <header className="relative z-10 flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-4">
          <Link to="/dashboard" className="text-slate-500 transition hover:text-slate-200" aria-label="Back to dashboard">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="text-lg font-bold tracking-[0.2em]">
            TRUST<span className="text-cyan-400">PULSE</span>
          </div>
          <span className="hidden text-sm text-slate-500 md:inline">Continuous identity · live</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className={`flex items-center gap-2 ${connected ? 'text-emerald-400' : 'text-slate-500'}`}>
            <span className={`h-2 w-2 rounded-full ${connected ? 'animate-pulse bg-emerald-400' : 'bg-slate-600'}`} />
            {connected ? 'LIVE' : 'connecting'}
          </span>
          <select
            value={follow}
            onChange={(e) => setParams({ rider: e.target.value })}
            className="rounded-lg border border-slate-700 bg-slate-900/80 px-2 py-1 text-slate-200"
            aria-label="Rider to follow"
          >
            <option value="DEMO1">Follow DEMO1</option>
            <option value="DEMO2">Follow DEMO2</option>
            <option value="*">Any live phone</option>
            {!['DEMO1', 'DEMO2', '*'].includes(follow) && <option value={follow}>Follow {follow}</option>}
          </select>
        </div>
      </header>

      <main className="relative z-10 grid flex-1 grid-cols-1 gap-6 px-8 pb-8 lg:grid-cols-[1.35fr_1fr]">
        {/* fingerprint */}
        <section className="flex flex-col">
          <div className="relative flex-1 min-h-[420px]">
            <Fingerprint3D signals={session?.signals} action={action} height="100%" className="absolute inset-0" />
            {!session && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
                <Smartphone className="h-10 w-10 text-slate-600" />
                <p className="text-lg text-slate-400">Waiting for {anyLive ? 'a live phone' : follow} to log in…</p>
                <p className="text-sm text-slate-600">Open /rider on the phone and enter the PIN</p>
              </div>
            )}
          </div>
          <FingerprintLegend className="mt-2 justify-center" />
        </section>

        {/* readout */}
        <section className="flex flex-col gap-5">
          <div>
            <div className="text-sm uppercase tracking-widest text-slate-500">{session ? session.rider_id : 'No session'}</div>
            <div className="text-3xl font-semibold">{session?.name ?? '—'}</div>
            {session && (
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-400">
                <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" />{session.city ?? 'Unknown city'}</span>
                <span className="flex items-center gap-1.5"><Smartphone className="h-4 w-4" />{session.device_id?.slice(0, 10)}</span>
                <span>Context risk {session.context_risk}</span>
              </div>
            )}
          </div>

          <div className="flex items-end gap-6">
            <div>
              <div className="text-sm uppercase tracking-widest text-slate-500">Trust</div>
              <div className="text-[7rem] font-bold leading-none tabular-nums" style={{ color: hex, textShadow: `0 0 40px ${hex}55` }}>
                {trust}
              </div>
            </div>
            <div
              className="mb-4 flex items-center gap-2 rounded-xl border px-4 py-2 text-lg font-semibold"
              style={{ borderColor: `${hex}88`, background: `${hex}14`, color: hex }}
            >
              {alarm ? <ShieldAlert className="h-5 w-5" /> : action === 'ENROLLING' ? <Sparkles className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
              {meta.label}
            </div>
          </div>

          <p className="text-xl leading-snug text-slate-200">
            {session?.verdict || 'Behaviour is compared with this rider’s own baseline on every login and swipe.'}
          </p>

          {/* per-signal match */}
          <div className="space-y-2.5">
            {SIGNAL_GROUPS.map((g) => {
              const sig = session?.signals?.[g.id];
              const match = sig?.match;
              return (
                <div key={g.id}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-slate-300">{g.label}</span>
                    <span className="tabular-nums text-slate-400">{match === undefined ? 'no data' : `${match}% match`}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-800/80">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${match ?? 0}%`, background: match === undefined ? 'transparent' : match >= 50 ? '#34d399' : match >= 25 ? '#fde047' : '#e11d48' }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {session && session.reasons.length > 0 && (
            <ul className="space-y-1.5 border-t border-slate-800 pt-4 text-[15px] text-slate-300">
              {session.reasons.slice(0, 5).map((r) => (
                <li key={r} className="flex gap-2">
                  <Activity className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                  {r}
                </li>
              ))}
            </ul>
          )}

          {timeline.length > 1 && (
            <div className="mt-auto">
              <div className="mb-1 text-xs uppercase tracking-widest text-slate-500">Trust through this session</div>
              <div className="flex h-12 items-end gap-1">
                {timeline.map((p, i) => (
                  <div
                    key={i}
                    title={`${getActionMeta(p.action).label} · trust ${p.trust}`}
                    className="flex-1 rounded-t transition-all duration-500"
                    style={{ height: `${Math.max(6, p.trust)}%`, background: getActionHex(p.action) }}
                  />
                ))}
              </div>
            </div>
          )}
        </section>
      </main>

      {/* the moment */}
      {banner && (
        <div className="pointer-events-none absolute inset-x-0 top-20 z-20 flex justify-center px-8 lg:right-auto lg:w-[57%]">
          <div
            className={`animate-[stagebanner_0.5s_ease-out] rounded-2xl border px-10 py-5 text-center shadow-2xl backdrop-blur-md ${
              banner.kind === 'caught' ? 'border-rose-500/70 bg-rose-950/70' : 'border-emerald-500/60 bg-emerald-950/60'
            }`}
          >
            <div className={`flex items-center justify-center gap-3 text-4xl font-black tracking-wider ${banner.kind === 'caught' ? 'text-rose-300' : 'text-emerald-300'}`}>
              {banner.kind === 'caught' ? <AlertOctagon className="h-9 w-9" /> : <Fingerprint className="h-9 w-9" />}
              {banner.text}
            </div>
            <div className="mt-1 text-base text-slate-200">{banner.sub}</div>
          </div>
        </div>
      )}
    </div>
  );
};
