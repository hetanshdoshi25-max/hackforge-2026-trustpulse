import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import type { Alert, AppConfig, RiderListItem, Session } from '../types/api';
import { useTrustPulseSocket } from '../hooks/useTrustPulseSocket';
import { Constellation3D, ConstellationLegend } from '../three/Constellation3D';
import { ActionTag, AlertTag, Arrow, Empty, ErrorBlock, Label, LinkBtn, Loading, PageHead, Stat, TrustCell } from '../components/ui/kit';
import { formatRelativeTime } from '../utils/formatting';

export const DashboardPage: React.FC = () => {
  const [riders, setRiders] = useState<RiderListItem[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [r, s, a, c] = await Promise.all([api.getRiders(), api.getSessions(25), api.getAlerts(20), api.getConfig()]);
      setRiders(r);
      setSessions(s);
      setAlerts(a);
      setConfig(c);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to connect to TrustPulse API');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useTrustPulseSocket(fetchData);
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const latest = useMemo(() => riders.map((r) => r.last).filter((s): s is Session => !!s), [riders]);

  if (isLoading) return <Loading message="Connecting to the engine" />;
  if (error) return <ErrorBlock title="Console disconnected" message={error} onRetry={fetchData} />;

  const enrolled = riders.filter((r) => r.enrolled).length;
  const enrolling = riders.length - enrolled;
  const active = sessions.filter((s) => s.status === 'ACTIVE').length;
  const awaiting = alerts.filter((a) => a.alert_type === 'SELFIE_SUBMITTED' || a.alert_type === 'REVIEW').length;
  const stepUps = sessions.filter((s) => s.action === 'STEP_UP').length;
  const cities = new Set(latest.map((s) => s.city).filter(Boolean)).size;

  return (
    <div className="space-y-12">
      <PageHead
        no="01"
        kicker="Fleet operations · live"
        title={
          <>
            The fleet, <em>right now.</em>
          </>
        }
        lede="Every rider's latest login, scored against their own rhythm. New phones and new cities pass quietly; a different person does not."
        right={
          <div className="flex flex-wrap gap-2">
            <LinkBtn to="/stage" variant="solid">
              Open demo stage
            </LinkBtn>
            <LinkBtn to="/challenge" variant="line">
              Challenge board
            </LinkBtn>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-y-8 md:grid-cols-3 xl:grid-cols-6 xl:divide-x xl:divide-line">
        <Stat className="xl:pr-6" label="Enrolled riders" value={enrolled} sub={`${riders.length} profiles`} />
        <Stat className="xl:px-6" label="Active sessions" value={active} sub={`of ${sessions.length} recent`} />
        <Stat className="xl:px-6" label="Still enrolling" value={enrolling} sub="building a baseline" color={enrolling ? '#818cf8' : undefined} />
        <Stat className="xl:px-6" label="Awaiting a human" value={awaiting} sub="selfies and reviews" color={awaiting ? '#e11d48' : undefined} />
        <Stat className="xl:px-6" label="Step-ups" value={stepUps} sub="selfie asked" color={stepUps ? '#f97316' : undefined} />
        <Stat className="xl:pl-6" label="Threshold" value={config?.threshold ?? '-'} sub={config && config.threshold <= 50 ? 'strict, demo mode' : 'balanced'} />
      </div>

      <section className="relative -mx-5 border-y border-line md:-mx-10">
        <Constellation3D sessions={latest} height={520} />
        <div className="pointer-events-none absolute left-5 top-5 md:left-10">
          <Label>City constellation</Label>
          <div className="mt-2 font-serif text-[30px] leading-none text-paper">
            {latest.length} riders · {cities} {cities === 1 ? 'city' : 'cities'}
          </div>
          <div className="mt-2 max-w-xs text-[12.5px] text-mute">Each pillar is one rider's latest login. Drag to orbit.</div>
        </div>
        <Link to="/fleet" className="absolute right-5 top-5 font-mono text-[11px] text-paper-2 underline underline-offset-4 hover:text-paper md:right-10">
          full map →
        </Link>
        <ConstellationLegend className="pointer-events-none absolute bottom-4 left-5 right-5 md:left-10" />
      </section>

      <div className="grid grid-cols-1 gap-12 xl:grid-cols-[1.7fr_1fr]">
        <section>
          <div className="mb-4 flex items-end justify-between">
            <div>
              <Label>Live feed</Label>
              <h2 className="mt-1.5 font-serif text-[30px] leading-none">Every login, scored</h2>
            </div>
            <Arrow to="/sessions">All sessions</Arrow>
          </div>
          {sessions.length === 0 ? (
            <Empty title="Quiet so far">Log in from /rider or run the simulator to see sessions stream in.</Empty>
          ) : (
            <div className="border-t border-line">
              {sessions.slice(0, 10).map((s) => (
                <Link
                  key={s.session_id}
                  to={`/riders/${s.rider_id}`}
                  className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-x-4 gap-y-1 border-b border-line py-3 transition-colors hover:bg-ink-2 md:grid-cols-[4.5rem_1.3fr_1fr_8rem_7rem]"
                >
                  <span className="font-mono text-[11px] text-dim">{formatRelativeTime(s.received_at || s.ts)}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] text-paper">{s.name}</span>
                    <span className="block font-mono text-[10.5px] text-dim">{s.rider_id}</span>
                  </span>
                  <span className="hidden truncate text-[13px] text-paper-2 md:block">{s.city ?? 'unknown'}</span>
                  <span className="hidden md:block">
                    <TrustCell trust={s.trust} action={s.action} />
                  </span>
                  <span className="justify-self-end">
                    <ActionTag action={s.action} />
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="mb-4 flex items-end justify-between">
            <div>
              <Label>Escalations</Label>
              <h2 className="mt-1.5 font-serif text-[30px] leading-none">
                {alerts.length ? (
                  <>
                    {alerts.length} need <em>a look</em>
                  </>
                ) : (
                  'Queue clear'
                )}
              </h2>
            </div>
            <Arrow to="/alerts">Open queue</Arrow>
          </div>
          {alerts.length === 0 ? (
            <div className="border-t border-line py-8 text-[13px] text-mute">Nobody is waiting on a human decision.</div>
          ) : (
            <div className="border-t border-line">
              {alerts.slice(0, 6).map((a, i) => (
                <Link key={`${a.session_id}-${i}`} to="/alerts" className="block border-b border-line py-3.5 transition-colors hover:bg-ink-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-[14px] text-paper">
                      {a.name} <span className="font-mono text-[10.5px] text-dim">{a.rider_id}</span>
                    </span>
                    <AlertTag type={a.alert_type} />
                  </div>
                  <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-paper-2">{a.verdict || a.reasons?.[0] || 'Risk threshold crossed'}</p>
                  <div className="mt-1.5 flex gap-4 font-mono text-[10.5px] text-dim">
                    <span>risk {a.risk}</span>
                    {a.has_selfie && <span className="text-paper-2">selfie attached</span>}
                    <span className="ml-auto">{formatRelativeTime(a.alert_at || a.received_at)}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
