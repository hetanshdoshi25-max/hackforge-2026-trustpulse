import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { socketService } from '../services/websocket';
import type { Session, TimelineEntry, WebSocketMessage } from '../types/api';
import { Fingerprint3D, FingerprintLegend } from '../three/Fingerprint3D';
import { getActionHex, getActionMeta } from '../utils/status';
import { ActionTag, Label, SignalReadout, Wordmark } from '../components/ui/kit';
import { useAnimatedNumber } from '../hooks/useAnimatedNumber';
import { PulseStrip } from '../components/ui/PulseStrip';

/**
 * Projector view for the live demo. Follows one rider (default DEMO1) or "any live
 * phone" (sessions without a simulator label) and reacts in real time.
 */

const ESCALATED = new Set(['STEP_UP', 'REVIEW']);

type Banner = { kind: 'caught' | 'same-person'; text: string; sub: string } | null;

function bannerFor(s: Session): Banner {
  if (ESCALATED.has(s.action)) {
    return { kind: 'caught', text: 'Person changed.', sub: s.verdict };
  }
  if (s.action === 'ALLOW' && s.context_risk >= 30) {
    return { kind: 'same-person', text: 'Context changed. Same person.', sub: 'New phone or city, behaviour matches: no lockout' };
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
  const alarm = ESCALATED.has(action);
  const timeline = useMemo(() => session?.timeline ?? [], [session]);

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-ink text-paper">
      {/* the room reacts: a faint wash in the decision colour */}
      <div
        className="pointer-events-none absolute inset-0 transition-[background] duration-1000"
        style={{ background: `radial-gradient(60% 70% at 28% 50%, ${hex}${alarm ? '26' : '12'} 0%, transparent 70%)` }}
      />

      <header className="relative z-10 flex items-center justify-between border-b border-line px-8 py-4">
        <div className="flex items-center gap-6">
          <Link to="/dashboard" aria-label="Back to dashboard">
            <Wordmark />
          </Link>
          <Label className="hidden md:block">Demo stage · live identity</Label>
        </div>
        <div className="flex items-center gap-6">
          <span className="flex items-center gap-2 font-mono text-[12px]">
            <span className={`h-2 w-2 rounded-full ${connected ? 'animate-pulse bg-allow' : 'bg-dim'}`} />
            <span className={connected ? 'text-paper-2' : 'text-dim'}>{connected ? 'LIVE' : 'LINKING'}</span>
          </span>
          <select value={follow} onChange={(e) => setParams({ rider: e.target.value })} className="field !text-[13px]" aria-label="Rider to follow">
            <option value="DEMO1">Follow DEMO1</option>
            <option value="DEMO2">Follow DEMO2</option>
            <option value="*">Any live phone</option>
            {!['DEMO1', 'DEMO2', '*'].includes(follow) && <option value={follow}>Follow {follow}</option>}
          </select>
        </div>
      </header>

      <main className="relative z-10 grid flex-1 grid-cols-1 lg:grid-cols-[1.25fr_1fr]">
        {/* the fingerprint */}
        <section className="relative flex min-h-[460px] flex-col border-line lg:border-r">
          <div className="absolute left-8 top-7 z-10">
            <Label>{session ? `Login ${session.session_id.slice(0, 8)}` : 'No session yet'}</Label>
            <div className="mt-2 font-serif text-[22px] italic text-paper-2">this login's behavioural fingerprint</div>
          </div>
          <div className="relative flex-1">
            <Fingerprint3D signals={session?.signals} action={action} height="100%" distance={4.8} className="absolute inset-0" />
            {!session && (
              <div className="absolute inset-x-0 bottom-10 z-10 text-center">
                <div className="font-serif text-[30px] text-paper">Waiting for {anyLive ? 'a live phone' : follow} to log in</div>
                <div className="mt-2 font-mono text-[12px] text-mute">open /rider on the phone and type the PIN</div>
              </div>
            )}
          </div>
          <FingerprintLegend className="justify-center px-6 pb-5" />
        </section>

        {/* the readout */}
        <section className="flex flex-col gap-5 px-8 py-6 xl:px-12">
          <div>
            <Label>{session ? session.rider_id : 'Following'}</Label>
            <div className="mt-1.5 font-serif text-[46px] leading-[0.95]">{session?.name ?? follow}</div>
            {session && (
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[12px] text-mute">
                <span>{session.city ?? 'unknown city'}</span>
                <span>phone {session.device_id?.slice(0, 10)}</span>
                <span>context risk {session.context_risk}</span>
              </div>
            )}
          </div>

          <div className="flex items-end gap-8 border-y border-line py-5">
            <div>
              <Label>Trust</Label>
              <div
                className="tnum mt-1 font-mono text-[112px] font-light leading-[0.8] tracking-tighter xl:text-[132px]"
                style={{ color: session ? hex : 'var(--color-dim)' }}
              >
                {session ? trust : '--'}
              </div>
            </div>
            <div className="pb-2">
              {session ? <ActionTag action={action} size="lg" /> : <span className="label">waiting</span>}
              <div className="mt-2 font-serif text-[24px] italic text-paper-2">{session ? getActionMeta(action).plain : ''}</div>
            </div>
          </div>

          <p className="font-serif text-[23px] leading-snug text-paper">
            {session?.verdict || "Every login and swipe is compared with this rider's own baseline."}
          </p>

          <SignalReadout signals={session?.signals} large />

          {session && session.reasons.length > 0 && (
            <ul className="space-y-1 border-t border-line pt-3 font-mono text-[12px] text-paper-2">
              {session.reasons.slice(0, 3).map((r) => (
                <li key={r} className="flex gap-3">
                  <span className="text-dim">·</span>
                  {r}
                </li>
              ))}
            </ul>
          )}

          {timeline.length > 1 && <SessionTrace timeline={timeline} />}
        </section>
      </main>

      <div className="relative z-10 border-t border-line">
        <div className="flex items-center gap-4 px-8">
          <span className="label shrink-0">fleet heartbeat</span>
          <PulseStrip height={40} className="flex-1" />
        </div>
      </div>

      {/* the moment */}
      {banner && (
        <div className="pointer-events-none absolute inset-x-0 top-1/2 z-30 -translate-y-1/2">
          <div
            className={`origin-center animate-[stagebanner_.55s_cubic-bezier(.2,.8,.2,1)] border-y px-8 py-8 text-center backdrop-blur-sm ${
              banner.kind === 'caught' ? 'border-review bg-review/90 text-white' : 'border-allow/70 bg-ink/85 text-allow'
            }`}
          >
            <div className="font-serif text-[64px] italic leading-none md:text-[88px]">{banner.text}</div>
            <div className={`mt-3 font-mono text-[15px] ${banner.kind === 'caught' ? 'text-white/85' : 'text-paper-2'}`}>{banner.sub}</div>
          </div>
        </div>
      )}
      <style>{'@keyframes stagebanner{from{opacity:0;transform:scaleY(.2)}to{opacity:1;transform:none}}'}</style>
    </div>
  );
};

/** Trust through this session as an ECG trace: one vertex per scored event. */
const SessionTrace: React.FC<{ timeline: TimelineEntry[] }> = ({ timeline }) => {
  const W = 600;
  const H = 70;
  const pts = timeline.map((p, i) => [(i / Math.max(1, timeline.length - 1)) * (W - 12) + 6, H - 6 - (p.trust / 100) * (H - 12)] as const);
  return (
    <div className="mt-auto">
      <Label>Trust through this session</Label>
      <div className="relative mt-2 h-[70px] w-full">
        <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
          <line x1="0" x2={W} y1={H / 2} y2={H / 2} stroke="#252523" strokeDasharray="2 4" vectorEffect="non-scaling-stroke" />
          {pts.slice(1).map(([x, y], i) => (
            <line
              key={i}
              x1={pts[i][0]}
              y1={pts[i][1]}
              x2={x}
              y2={y}
              stroke={getActionHex(timeline[i + 1].action)}
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
        {pts.map(([x, y], i) => (
          <span
            key={i}
            title={`${getActionMeta(timeline[i].action).label} · trust ${timeline[i].trust}`}
            className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%`, background: getActionHex(timeline[i].action) }}
          />
        ))}
      </div>
    </div>
  );
};
