import React, { lazy, Suspense, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import type { BenchmarkResult, TradeoffMetrics } from '../types/api';
import { Wordmark } from '../components/ui/kit';

/**
 * Entry: who are you? Riders and the ops team are different people on different devices.
 * The 3D print only loads on wide screens: a rider on mobile data never downloads three.js.
 */
const IdentityField3D = lazy(() => import('../three/IdentityField3D'));

function useWide() {
  const q = '(min-width: 1024px) and (prefers-reduced-motion: no-preference)';
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const on = () => setWide(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return wide;
}

const DOORS = [
  { to: '/rider', no: '01', who: "I'm a delivery partner", what: 'Log in with your PIN and start your shift' },
  { to: '/dashboard', no: '02', who: 'Operations team', what: 'Watch the live fleet, review alerts and selfies' },
];

export const LandingPage: React.FC = () => {
  const wide = useWide();
  const [beat, setBeat] = useState<{ n: number; alarm: boolean }>({ n: 0, alarm: false });
  const [facts, setFacts] = useState<{ t?: TradeoffMetrics; b?: BenchmarkResult }>({});

  useEffect(() => {
    if (!wide) return;
    api.getTradeoffMetrics().then((t) => setFacts((f) => ({ ...f, t }))).catch(() => {});
    api.getBenchmark().then((b) => setFacts((f) => ({ ...f, b }))).catch(() => {});
  }, [wide]);

  const tp = facts.t?.baselines.trustpulse;

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-ink text-paper">
      {/* column guides */}
      <div aria-hidden className="pointer-events-none absolute inset-0 mx-auto hidden max-w-[1520px] grid-cols-12 px-10 lg:grid">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="border-l border-line/50 last:border-r" />
        ))}
      </div>

      {wide && (
        <div className="pointer-events-auto absolute inset-y-0 right-[-6%] w-[62%]">
          <Suspense fallback={null}>
            <IdentityField3D className="h-full w-full" onBeat={(n, alarm) => setBeat({ n, alarm })} />
          </Suspense>
        </div>
      )}

      <header className="relative z-10 mx-auto flex w-full max-w-[1520px] items-center justify-between px-5 py-6 md:px-10">
        <Wordmark />
        <div className="label hidden sm:block">HackForge 2026 · Team Braniacs</div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-[1520px] flex-1 flex-col justify-center px-5 pb-10 md:px-10">
        <div className="label animate-rise">Continuous rider identity</div>
        <h1 className="mt-5 animate-rise font-serif text-[46px] leading-[0.92] tracking-[-0.01em] [animation-delay:80ms] sm:text-[72px] lg:text-[88px]">
          Phone changed,
          <br />
          city changed: <em className="text-paper-2">fine.</em>
          <br />
          Person changed:
          <br />
          <em className="text-review">caught.</em>
        </h1>
        <p className="mt-6 max-w-[46ch] animate-rise text-[16px] leading-relaxed text-paper-2 [animation-delay:160ms]">
          TrustPulse checks every login and every swipe against the rider's own rhythm: how they type the PIN, swipe,
          and hold the phone. A new phone never locks anyone out. A different person never gets in.
        </p>

        <div className="mt-10 max-w-xl animate-rise [animation-delay:240ms]">
          <div className="label mb-3">Continue as</div>
          {DOORS.map((d) => (
            <Link
              key={d.to}
              to={d.to}
              className="group relative grid grid-cols-[2.2rem_1fr_auto] items-center gap-x-4 overflow-hidden border-t border-line py-5 last:border-b"
            >
              <span className="absolute inset-0 origin-left scale-x-0 bg-paper transition-transform duration-300 ease-out group-hover:scale-x-100" />
              <span className="relative font-mono text-[11px] text-dim group-hover:text-ink">{d.no}</span>
              <span className="relative">
                <span className="block font-serif text-[30px] leading-none text-paper group-hover:text-ink md:text-[36px]">{d.who}</span>
                <span className="mt-1.5 block text-[13px] text-mute group-hover:text-ink/70">{d.what}</span>
              </span>
              <span className="relative pr-2 text-2xl text-mute transition group-hover:translate-x-1 group-hover:text-ink">→</span>
            </Link>
          ))}
          <div className="mt-6 flex flex-wrap gap-x-8 gap-y-2 text-[13px]">
            <Link to="/play" className="text-paper-2 underline decoration-line-2 underline-offset-4 hover:text-paper hover:decoration-paper">
              Can you fool TrustPulse? Take the challenge
            </Link>
            <Link to="/stage" className="text-mute underline decoration-line-2 underline-offset-4 hover:text-paper hover:decoration-paper">
              Presenting? Open the demo stage
            </Link>
          </div>
        </div>
      </main>

      {wide && (
        <div className="pointer-events-none absolute bottom-24 right-10 z-10 w-72 text-right">
          <div className="label">Login {String(beat.n + 1).padStart(3, '0')}</div>
          <div className="mt-1 font-serif text-[26px] leading-tight" style={{ color: beat.alarm ? '#e11d48' : '#edebe6' }}>
            {beat.alarm ? 'Same PIN. Different person.' : 'Same rhythm. Same rider.'}
          </div>
        </div>
      )}

      <footer className="relative z-10 border-t border-line">
        <div className="mx-auto grid max-w-[1520px] grid-cols-2 gap-y-4 px-5 py-5 md:grid-cols-4 md:px-10">
          {(tp
            ? [
                [`${tp.false_lockout}%`, 'honest sessions stopped'],
                [`${tp.takeover_caught}%`, 'rented sessions caught'],
                [`${tp.takeover_caught_same_device}%`, 'caught on the owner’s own phone'],
                [facts.b ? `${facts.b.latency_ms.median} ms` : '<1 ms', 'to score a session'],
              ]
            : [
                ['4', 'signals per login'],
                ['0', 'lockouts for a new phone'],
                ['1', 'person per account'],
                ['<1 ms', 'to score a session'],
              ]
          ).map(([v, l]) => (
            <div key={l} className="flex items-baseline gap-3">
              <span className="tnum font-mono text-[20px] text-paper">{v}</span>
              <span className="text-[12px] text-mute">{l}</span>
            </div>
          ))}
        </div>
      </footer>
    </div>
  );
};
