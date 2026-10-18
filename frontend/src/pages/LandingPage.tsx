import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Bike, MonitorPlay, ShieldCheck, Trophy } from 'lucide-react';

/**
 * Entry point: who are you? Riders and the ops team are different people on
 * different devices, so nobody should land on the wrong side by default.
 * Deliberately no three.js here: a rider on mobile data shouldn't download it.
 */
export const LandingPage: React.FC = () => (
  <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#000000] px-4 py-10 text-slate-100">
    <div className="relative z-10 flex w-full max-w-3xl flex-col items-center text-center">
      <div className="relative mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-500/50 bg-cyan-950/70 text-cyan-300 shadow-lg shadow-cyan-950">
        {/* pulse rings: the "TrustPulse" mark, pure CSS, centred on the shield */}
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 block h-40 w-40 rounded-full border border-cyan-400/40"
            style={{ animation: `landingpulse 3.6s ease-out ${i * 1.2}s infinite` }}
          />
        ))}
        <ShieldCheck className="relative h-7 w-7" />
      </div>
      <h1 className="text-3xl font-bold tracking-[0.2em] md:text-4xl">
        TRUST<span className="text-cyan-400">PULSE</span>
      </h1>
      <p className="mt-3 text-base text-slate-300 md:text-lg">
        Phone changed, city changed: fine.
        <br />
        <span className="text-rose-400">Person changed: caught.</span>
      </p>

      <h2 className="mt-12 text-sm uppercase tracking-[0.25em] text-slate-500">Continue as</h2>

      <div className="mt-4 grid w-full grid-cols-1 gap-4 md:grid-cols-2">
        <Link
          to="/rider"
          className="group flex flex-col items-start gap-3 rounded-2xl border border-slate-700 bg-[#0a0a0a] p-6 text-left transition hover:-translate-y-0.5 hover:border-emerald-500/70 hover:bg-[#141414] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-600/60 bg-emerald-950/60 text-emerald-300">
            <Bike className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xl font-semibold text-slate-50">I'm a delivery partner</div>
            <div className="mt-1 text-sm text-slate-400">Log in with your PIN and start your shift</div>
          </div>
          <span className="mt-auto flex items-center gap-1.5 text-sm font-medium text-emerald-300">
            Rider app <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
          </span>
        </Link>

        <Link
          to="/dashboard"
          className="group flex flex-col items-start gap-3 rounded-2xl border border-slate-700 bg-[#0a0a0a] p-6 text-left transition hover:-translate-y-0.5 hover:border-cyan-500/70 hover:bg-[#141414] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-cyan-600/60 bg-cyan-950/60 text-cyan-300">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xl font-semibold text-slate-50">Operations team</div>
            <div className="mt-1 text-sm text-slate-400">Monitor the live fleet, review alerts and selfies</div>
          </div>
          <span className="mt-auto flex items-center gap-1.5 text-sm font-medium text-cyan-300">
            Ops dashboard <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
          </span>
        </Link>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
        <Link to="/play" className="flex items-center gap-2 text-cyan-300 transition hover:text-cyan-200">
          <Trophy className="h-4 w-4" /> Take the challenge: can you fool TrustPulse?
        </Link>
        <Link to="/stage" className="flex items-center gap-2 text-slate-500 transition hover:text-slate-200">
          <MonitorPlay className="h-4 w-4" /> Presenting? Open the Demo Stage
        </Link>
      </div>
    </div>

    <div className="absolute bottom-4 text-xs text-slate-600">HackForge 2026 · Team Braniacs</div>
  </div>
);
