import React, { useEffect, useState } from 'react';
import { Cpu, Gauge } from 'lucide-react';
import { api } from '../../services/api';
import type { BenchmarkResult } from '../../types/api';

/**
 * "Tens of thousands of riders, millions of sessions": the measured engine
 * throughput (python -m ml.benchmark) next to what this server is doing right now.
 */
export const ScaleCard: React.FC = () => {
  const [bench, setBench] = useState<BenchmarkResult | null>(null);
  const [live, setLive] = useState<{ total: number; minute: number } | null>(null);

  useEffect(() => {
    api.getBenchmark().then(setBench).catch(() => setBench(null));
    const poll = () =>
      api
        .health()
        .then((h) => setLive({ total: h.scored_total ?? 0, minute: h.scored_last_minute ?? 0 }))
        .catch(() => {});
    poll();
    const t = window.setInterval(poll, 5000);
    return () => window.clearInterval(t);
  }, []);

  if (!bench) return null;
  const perHourAllCores = bench.sessions_per_hour_one_core * bench.cores_on_this_machine;

  return (
    <div className="space-y-4 rounded-xl border border-[#1e2c47] bg-[#0a0a0a] p-5">
      <div className="flex items-center justify-between border-b border-[#1e2c47] pb-3">
        <div className="flex items-center gap-2">
          <Cpu className="h-5 w-5 text-cyan-400" />
          <h3 className="font-mono text-sm font-bold text-slate-100">Engine capacity (measured)</h3>
        </div>
        <span className="font-mono text-xs text-slate-500">{bench.machine}</span>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Sessions / second, one core" value={bench.sessions_per_second_one_core.toLocaleString()} />
        <Stat label="Sessions / hour, one core" value={`${(bench.sessions_per_hour_one_core / 1e6).toFixed(1)} M`} />
        <Stat
          label={`Projected, all ${bench.cores_on_this_machine} cores`}
          value={`${Math.round(perHourAllCores / 1e6)} M / hr`}
        />
        <Stat label="Latency median · p99" value={`${bench.latency_ms.median} · ${bench.latency_ms.p99} ms`} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
        <span className="flex items-center gap-1.5">
          <Gauge className="h-4 w-4 text-slate-500" />
          Live on this server: <strong className="text-slate-200">{live ? live.minute.toLocaleString() : '-'}</strong> batches scored in the last minute ·{' '}
          <strong className="text-slate-200">{live ? live.total.toLocaleString() : '-'}</strong> since start
        </span>
        <span className="text-slate-500">{bench.note}</span>
      </div>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-lg border border-slate-800 bg-neutral-900/60 p-3">
    <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
    <div className="mt-1 font-mono text-xl font-bold text-slate-100">{value}</div>
  </div>
);
