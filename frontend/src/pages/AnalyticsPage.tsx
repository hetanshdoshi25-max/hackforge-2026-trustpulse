import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../services/api';
import type { AppConfig, TradeoffCurvePoint, TradeoffMetrics } from '../types/api';
import { ScaleCard } from '../components/analytics/ScaleCard';
import { Btn, ErrorBlock, Label, Loading, PageHead, Stat } from '../components/ui/kit';
import { formatPercent } from '../utils/formatting';

const POLICY_ROWS = [
  { key: 'open_gate', label: 'Open gate', note: 'verify once at signup', ours: false },
  { key: 'strict_gate', label: 'Strict gate', note: 'verify every login', ours: false },
  { key: 'context_rules', label: 'Context rules', note: 'flag new phone or city', ours: false },
  { key: 'trustpulse', label: 'TrustPulse', note: 'behaviour vs own baseline', ours: true },
] as const;

const C = {
  caught: '#34d399',
  same: '#edebe6',
  stopped: '#f97316',
  honest: '#8a877f',
  rented: '#e11d48',
  grid: '#1d1d1b',
  axis: '#3a3936',
  tick: { fill: '#8a877f', fontSize: 10, fontFamily: 'Geist Mono' },
};

const Key: React.FC<{ color: string; dashed?: boolean; children: React.ReactNode }> = ({ color, dashed, children }) => (
  <span className="flex items-center gap-2">
    <span className="inline-block w-5 border-t-2" style={{ borderColor: color, borderStyle: dashed ? 'dashed' : 'solid' }} />
    {children}
  </span>
);

export const AnalyticsPage: React.FC = () => {
  const [metrics, setMetrics] = useState<TradeoffMetrics | null>(null);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedThreshold, setSelectedThreshold] = useState(70);
  const [isApplying, setIsApplying] = useState(false);
  const [applySuccess, setApplySuccess] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [t, c] = await Promise.all([api.getTradeoffMetrics(), api.getConfig()]);
      setMetrics(t);
      setConfig(c);
      setSelectedThreshold(c.threshold);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load tradeoff analytics');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const point: TradeoffCurvePoint | undefined = useMemo(() => {
    if (!metrics?.curve) return undefined;
    return metrics.curve.find((c) => c.threshold === selectedThreshold) || metrics.curve[Math.floor(metrics.curve.length / 2)];
  }, [metrics, selectedThreshold]);

  const apply = async () => {
    setIsApplying(true);
    setApplySuccess(false);
    try {
      setConfig(await api.setConfig(selectedThreshold));
      setApplySuccess(true);
      setTimeout(() => setApplySuccess(false), 3000);
    } catch (err: unknown) {
      window.alert(err instanceof Error ? err.message : 'Failed to update threshold');
    } finally {
      setIsApplying(false);
    }
  };

  const histogram = useMemo(() => {
    if (!metrics?.risk_histogram) return [];
    const { genuine, takeover, bin_size } = metrics.risk_histogram;
    const g = genuine.reduce((a, b) => a + b, 0) || 1;
    const t = takeover.reduce((a, b) => a + b, 0) || 1;
    return Array.from({ length: Math.min(genuine.length, takeover.length) }, (_, i) => ({
      range: `${i * bin_size}`,
      label: `${i * bin_size}-${(i + 1) * bin_size}`,
      genuine: genuine[i] || 0,
      takeover: takeover[i] || 0,
      genuinePct: Number((((genuine[i] || 0) / g) * 100).toFixed(1)),
      takeoverPct: Number((((takeover[i] || 0) / t) * 100).toFixed(1)),
    }));
  }, [metrics]);

  if (isLoading) return <Loading message="Loading the evaluation" />;
  if (error || !metrics) return <ErrorBlock title="Evaluation unavailable" message={error || 'Trade-off data could not be retrieved.'} onRetry={fetchData} />;

  const applied = config?.threshold === selectedThreshold;
  const f = metrics.fleet;

  return (
    <div className="space-y-14">
      <PageHead
        no="09"
        kicker="Offline evaluation · synthetic fleet"
        title={
          <>
            The trade-off, <em>measured.</em>
          </>
        }
        lede={`${f.riders} riders, ${f.scored_sessions.toLocaleString()} scored sessions, ${f.life_change_sessions.toLocaleString()} of them honest life changes (new phone, new city), ${f.takeover_sessions.toLocaleString()} rented sessions on ${f.takeover_accounts} rented accounts.`}
      />

      {/* the comparison that matters */}
      <section>
        <Label>Four ways to guard an account</Label>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[920px] border-t border-line">
            <thead className="border-b border-line">
              <tr className="text-left">
                <th className="label py-3 pr-4 font-normal">Policy</th>
                <th className="label py-3 pr-4 font-normal">Honest sessions stopped</th>
                <th className="label py-3 pr-4 font-normal">Honest riders ever stopped</th>
                <th className="label py-3 pr-4 font-normal">Rented sessions caught</th>
                <th className="label py-3 pr-4 font-normal">On the same phone</th>
                <th className="label py-3 pr-4 font-normal">Rented accounts caught</th>
                <th className="label py-3 font-normal">Shifts to catch</th>
              </tr>
            </thead>
            <tbody>
              {POLICY_ROWS.map(({ key, label, note, ours }) => {
                const b = metrics.baselines[key];
                const pct = (v: number) => `${Number(v.toFixed(2))}%`;
                const shifts = b.median_sessions_to_catch;
                const cell = `tnum py-4 pr-4 font-mono ${ours ? 'text-[17px] text-ink' : 'text-[14px] text-paper-2'}`;
                return (
                  <tr key={key} className={ours ? 'bg-paper' : 'border-b border-line'}>
                    <td className="py-4 pl-3 pr-4">
                      <div className={ours ? 'font-serif text-[26px] italic leading-none text-ink' : 'font-serif text-[22px] leading-none text-paper'}>{label}</div>
                      <div className={`mt-1 font-mono text-[10.5px] ${ours ? 'text-ink/60' : 'text-dim'}`}>
                        {note}
                        {ours ? ` · threshold ${metrics.default_threshold}` : ''}
                      </div>
                    </td>
                    <td className={cell}>{pct(b.false_lockout)}</td>
                    <td className={cell}>{pct(b.honest_riders_ever_stopped)}</td>
                    <td className={cell}>{pct(b.takeover_caught)}</td>
                    <td className={cell}>{pct(b.takeover_caught_same_device)}</td>
                    <td className={cell}>{pct(b.accounts_caught)}</td>
                    <td className={cell}>{shifts == null ? '-' : `${shifts}`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 font-mono text-[11px] text-dim">
          Context rules catch some renters only because renters often use their own phone; on the owner's phone they see nothing. Behaviour does.
        </p>
      </section>

      {/* threshold explorer */}
      <section className="border-t border-line pt-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Label>Strictness · move it and watch the cost</Label>
            <h2 className="mt-1.5 font-serif text-[30px] leading-none">
              Threshold <span className="tnum font-mono text-[34px]">{selectedThreshold}</span>
            </h2>
          </div>
          <div className="flex items-center gap-4">
            {applySuccess && <span className="font-mono text-[11.5px] text-allow">applied to the live engine</span>}
            <span className="font-mono text-[11px] text-mute">live: {config?.threshold}</span>
            <Btn variant={applied ? 'line' : 'solid'} onClick={apply} disabled={isApplying || applied}>
              {applied ? 'Applied' : `Apply ${selectedThreshold}`}
            </Btn>
          </div>
        </div>
        <div className="mt-6">
          <input
            type="range"
            min="20"
            max="95"
            step="5"
            value={selectedThreshold}
            onChange={(e) => setSelectedThreshold(Number(e.target.value))}
            className="hair"
            aria-label="Threshold"
          />
          <div className="mt-1 flex justify-between font-mono text-[10.5px] text-dim">
            <span>20 · strict, more selfies</span>
            <span>default {metrics.default_threshold}</span>
            <span>95 · open, fewer catches</span>
          </div>
        </div>
        {point && (
          <div className="mt-8 grid grid-cols-2 gap-y-8 md:grid-cols-4 md:divide-x md:divide-line">
            <Stat className="md:pr-6" label="Honest sessions stopped" value={formatPercent(point.false_lockout, 2)} color={C.stopped} />
            <Stat className="md:px-6" label="Honest riders ever stopped" value={formatPercent(point.honest_riders_ever_stopped)} color={C.stopped} />
            <Stat className="md:px-6" label="Rented sessions caught" value={formatPercent(point.takeover_caught)} color={C.caught} />
            <Stat className="md:pl-6" label="Caught on the same phone" value={formatPercent(point.takeover_caught_same_device)} />
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-12 xl:grid-cols-2">
        <section className="border-t border-line pt-6">
          <Label>Trade-off curve</Label>
          <h2 className="mt-1.5 font-serif text-[26px] leading-none">Catch rate against friction</h2>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[10.5px] text-paper-2">
            <Key color={C.caught}>rented caught</Key>
            <Key color={C.same} dashed>caught on same phone</Key>
            <Key color={C.stopped}>honest sessions stopped</Key>
          </div>
          <div className="mt-4 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics.curve} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid stroke={C.grid} vertical={false} />
                <XAxis dataKey="threshold" stroke={C.axis} tick={C.tick} tickLine={false} />
                <YAxis domain={[0, 100]} stroke={C.axis} tick={C.tick} tickLine={false} tickFormatter={(v) => `${v}%`} />
                <ReferenceLine x={selectedThreshold} stroke="#edebe6" strokeDasharray="2 3" />
                <Tooltip
                  cursor={{ stroke: C.axis }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload as TradeoffCurvePoint;
                    return (
                      <div className="border border-line-2 bg-ink-2 px-3 py-2 font-mono text-[11px] leading-relaxed">
                        <div className="text-paper">threshold {d.threshold}</div>
                        <div style={{ color: C.caught }}>caught {d.takeover_caught}%</div>
                        <div className="text-paper-2">same phone {d.takeover_caught_same_device}%</div>
                        <div style={{ color: C.stopped }}>honest stopped {d.false_lockout}%</div>
                      </div>
                    );
                  }}
                />
                <Line type="monotone" dataKey="takeover_caught" stroke={C.caught} strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="takeover_caught_same_device" stroke={C.same} strokeWidth={1.5} strokeDasharray="4 4" dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="false_lockout" stroke={C.stopped} strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="border-t border-line pt-6">
          <Label>Separation</Label>
          <h2 className="mt-1.5 font-serif text-[26px] leading-none">Where honest and rented sessions land</h2>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[10.5px] text-paper-2">
            <Key color={C.honest}>honest (% of honest)</Key>
            <Key color={C.rented}>rented (% of rented)</Key>
            <span className="text-dim">x = risk score</span>
          </div>
          <div className="mt-4 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={histogram} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barGap={1}>
                <CartesianGrid stroke={C.grid} vertical={false} />
                <XAxis dataKey="range" stroke={C.axis} tick={C.tick} tickLine={false} />
                <YAxis stroke={C.axis} tick={C.tick} tickLine={false} tickFormatter={(v: number) => `${v}%`} />
                <Tooltip
                  cursor={{ fill: '#ffffff08' }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="border border-line-2 bg-ink-2 px-3 py-2 font-mono text-[11px] leading-relaxed">
                        <div className="text-paper">risk {d.label}</div>
                        <div className="text-paper-2">
                          honest {d.genuinePct}% ({d.genuine.toLocaleString()})
                        </div>
                        <div style={{ color: C.rented }}>
                          rented {d.takeoverPct}% ({d.takeover.toLocaleString()})
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="genuinePct" fill={C.honest} isAnimationActive={false} />
                <Bar dataKey="takeoverPct" fill={C.rented} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <ScaleCard />
    </div>
  );
};
