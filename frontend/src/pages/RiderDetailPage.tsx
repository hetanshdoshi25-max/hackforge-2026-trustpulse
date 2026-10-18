import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../services/api';
import type { RiderDetail, Session } from '../types/api';
import { useTrustPulseSocket } from '../hooks/useTrustPulseSocket';
import { AccountTimeMachine } from '../components/rider/AccountTimeMachine';
import { formatDateTime, formatRelativeTime } from '../utils/formatting';
import { getActionHex, getActionMeta } from '../utils/status';
import { ActionTag, Btn, Confirm, ErrorBlock, KV, Label, Loading, SignalReadout, Stat, StatusTag, TrustCell } from '../components/ui/kit';

export const RiderDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [rider, setRider] = useState<RiderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const fetchRider = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      setRider(await api.getRider(id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load rider details');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useTrustPulseSocket(
    useCallback(
      (msg) => {
        if (msg.type === 'rider_reset' && (msg.data as { rider_id?: string })?.rider_id === id) fetchRider();
        else if (msg.type === 'session' && (msg.data as Session)?.rider_id === id) fetchRider();
      },
      [id, fetchRider],
    ),
  );

  useEffect(() => {
    fetchRider();
  }, [fetchRider]);

  const handleReset = async () => {
    if (!id) return;
    setIsResetting(true);
    try {
      await api.resetRider(id);
      setResetOpen(false);
      await fetchRider();
    } catch (err: unknown) {
      window.alert(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setIsResetting(false);
    }
  };

  const chartData = useMemo(
    () =>
      (rider?.history ?? []).map((s, i) => ({
        n: i + 1,
        time: formatDateTime(s.received_at || s.ts),
        trust: s.trust,
        action: s.action,
        city: s.city || 'Unknown',
      })),
    [rider],
  );

  if (isLoading) return <Loading message="Loading the rider profile" />;
  if (error || !rider) return <ErrorBlock title="Rider not found" message={error || 'No rider exists with this identifier.'} onRetry={fetchRider} />;

  const latest: Session | undefined = rider.history[rider.history.length - 1];
  const hex = latest ? getActionHex(latest.action) : 'var(--color-paper)';

  return (
    <div className="space-y-14">
      <div>
        <Link to="/riders" className="font-mono text-[11px] text-mute hover:text-paper">
          ← riders
        </Link>
        <header className="mt-6 grid grid-cols-1 gap-8 border-b border-line pb-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="animate-rise">
            <div className="label flex flex-wrap items-center gap-3">
              <span className="text-paper">{rider.rider_id}</span>
              <span className="h-px w-8 bg-line-2" />
              <span className={rider.enrolled ? '' : 'text-enroll'}>{rider.enrolled ? 'Enrolled profile' : `Enrolling ${rider.enroll_progress}/8`}</span>
            </div>
            <h1 className="mt-4 font-serif text-[56px] leading-[0.92] md:text-[84px]">{rider.name}</h1>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 font-mono text-[12px] text-mute">
              <span>{rider.known_cities.join(', ') || 'no cities yet'}</span>
              <span>
                {rider.known_devices.length} trusted phone{rider.known_devices.length === 1 ? '' : 's'}
              </span>
              <span>{rider.sessions} sessions</span>
            </div>
          </div>
          <div className="flex items-end gap-8">
            {latest && (
              <div>
                <Label>Current trust</Label>
                <div className="tnum mt-1 font-mono text-[96px] font-light leading-[0.8]" style={{ color: hex }}>
                  {latest.trust}
                </div>
                <div className="mt-2">
                  <ActionTag action={latest.action} size="md" />
                </div>
              </div>
            )}
            <Btn variant="danger" onClick={() => setResetOpen(true)} className="!py-2 text-[12px]">
              Reset profile
            </Btn>
          </div>
        </header>
      </div>

      {latest && (
        <section className="grid grid-cols-1 gap-10 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <Label>Latest decision · {formatRelativeTime(latest.received_at)}</Label>
            <p className="mt-3 font-serif text-[30px] leading-[1.15]">{latest.verdict}</p>
            {latest.reasons.length > 0 && (
              <ul className="mt-4 space-y-1.5 font-mono text-[12px] text-paper-2">
                {latest.reasons.map((r, i) => (
                  <li key={i}>· {r}</li>
                ))}
              </ul>
            )}
            <KV
              className="mt-6"
              rows={[
                ['Behaviour risk', latest.behaviour_risk ?? '-'],
                ['Context risk', latest.context_risk],
                ['Status', <StatusTag key="s" status={latest.status} />],
                ['City · phone', `${latest.city ?? '-'} · ${latest.device_id?.slice(0, 10) ?? '-'}`],
              ]}
            />
          </div>
          <div>
            <Label>Behaviour match by signal</Label>
            <div className="mt-4">
              <SignalReadout signals={latest.signals} />
            </div>
          </div>
        </section>
      )}

      <section className="border-t border-line pt-6">
        <AccountTimeMachine history={rider.history} />
      </section>

      <section className="border-t border-line pt-6">
        <div className="mb-6 grid grid-cols-2 gap-6 md:grid-cols-4">
          <Stat label="Sessions" value={rider.sessions} />
          <Stat label="Trusted phones" value={rider.known_devices.length} />
          <Stat label="Cities" value={rider.known_cities.length} />
          <Stat label="Baseline samples" value={Object.values(rider.baseline_samples ?? {}).reduce((a, b) => a + b, 0)} />
        </div>
        <Label>Trust over every session</Label>
        {chartData.length > 0 ? (
          <div className="mt-4 h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 8, left: -24, bottom: 0 }}>
                <CartesianGrid stroke="#1d1d1b" vertical={false} />
                <XAxis dataKey="n" stroke="#3a3936" tick={{ fill: '#8a877f', fontSize: 10, fontFamily: 'Geist Mono' }} tickLine={false} />
                <YAxis domain={[0, 100]} stroke="#3a3936" tick={{ fill: '#8a877f', fontSize: 10, fontFamily: 'Geist Mono' }} tickLine={false} />
                <ReferenceLine y={50} stroke="#3a3936" strokeDasharray="2 4" />
                <Tooltip
                  cursor={{ stroke: '#3a3936' }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="border border-line-2 bg-ink-2 px-3 py-2 font-mono text-[11px]">
                        <div className="text-mute">
                          #{d.n} · {d.time} · {d.city}
                        </div>
                        <div className="mt-1 text-paper">
                          trust {d.trust} · <span style={{ color: getActionHex(d.action) }}>{getActionMeta(d.action).label}</span>
                        </div>
                      </div>
                    );
                  }}
                />
                <Line
                  type="linear"
                  dataKey="trust"
                  stroke="#bdbab2"
                  strokeWidth={1.5}
                  isAnimationActive={false}
                  dot={(p: { cx?: number; cy?: number; index?: number; payload?: { action: string } }) => (
                    <circle key={p.index} cx={p.cx} cy={p.cy} r={3} fill={getActionHex(p.payload?.action ?? '')} stroke="none" />
                  )}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="py-8 text-[13px] text-mute">No sessions recorded yet.</div>
        )}
      </section>

      <section className="border-t border-line pt-6">
        <Label>Full history</Label>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[860px] border-t border-line">
            <thead className="border-b border-line">
              <tr className="text-left">
                {['Session', 'City', 'Trust', 'Decision', 'Status', 'Why', 'When'].map((h, i) => (
                  <th key={h} className={`label py-3 pr-4 font-normal ${i === 6 ? 'text-right' : ''}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rider.history
                .slice()
                .reverse()
                .map((s) => (
                  <tr key={s.session_id} className="border-b border-line">
                    <td className="py-3 pr-4 font-mono text-[11.5px] text-paper-2">{s.session_id.slice(0, 8)}</td>
                    <td className="py-3 pr-4 text-[13px] text-paper-2">{s.city || '-'}</td>
                    <td className="py-3 pr-4">
                      <TrustCell trust={s.trust} action={s.action} />
                    </td>
                    <td className="py-3 pr-4">
                      <ActionTag action={s.action} />
                    </td>
                    <td className="py-3 pr-4">
                      <StatusTag status={s.status} />
                    </td>
                    <td className="max-w-xs truncate py-3 pr-4 text-[12.5px] text-mute" title={s.verdict}>
                      {s.verdict}
                    </td>
                    <td className="whitespace-nowrap py-3 text-right font-mono text-[11px] text-dim">{formatRelativeTime(s.received_at || s.ts)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      <Confirm
        open={resetOpen}
        title={`Reset ${rider.name}?`}
        message="This erases the rider's behavioural baseline, every enrolled sample and all session history. The rider starts enrolling again from zero."
        confirmLabel="Erase and reset"
        destructive
        busy={isResetting}
        onConfirm={handleReset}
        onCancel={() => setResetOpen(false)}
      />
    </div>
  );
};
