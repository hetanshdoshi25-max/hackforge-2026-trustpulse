import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import type { BenchmarkResult } from '../../types/api';
import { Label, Stat } from '../ui/kit';

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
    <section className="border-t border-line pt-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Label>Engine capacity · measured</Label>
          <h2 className="mt-1.5 font-serif text-[30px] leading-none">
            Fast enough for <em>a whole fleet.</em>
          </h2>
        </div>
        <span className="font-mono text-[11px] text-dim">{bench.machine}</span>
      </div>
      <div className="grid grid-cols-2 gap-y-8 md:grid-cols-4 md:divide-x md:divide-line">
        <Stat className="md:pr-6" label="Sessions / second · 1 core" value={bench.sessions_per_second_one_core.toLocaleString()} />
        <Stat className="md:px-6" label="Sessions / hour · 1 core" value={(bench.sessions_per_hour_one_core / 1e6).toFixed(1)} unit="M" />
        <Stat className="md:px-6" label={`Projected · ${bench.cores_on_this_machine} cores`} value={Math.round(perHourAllCores / 1e6)} unit="M / hr" />
        <Stat className="md:pl-6" label="Latency median · p99" value={`${bench.latency_ms.median} · ${bench.latency_ms.p99}`} unit="ms" />
      </div>
      <div className="mt-6 flex flex-wrap justify-between gap-2 font-mono text-[11px] text-mute">
        <span>
          live on this server: <span className="text-paper">{live ? live.minute.toLocaleString() : '-'}</span> batches in the last minute ·{' '}
          <span className="text-paper">{live ? live.total.toLocaleString() : '-'}</span> since start
        </span>
        <span className="text-dim">{bench.note}</span>
      </div>
    </section>
  );
};
