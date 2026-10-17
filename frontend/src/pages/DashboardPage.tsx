import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../services/api';
import type { Alert, AppConfig, RiderListItem, Session } from '../types/api';
import { MetricsGrid } from '../components/dashboard/MetricsGrid';
import { RecentSessions } from '../components/dashboard/RecentSessions';
import { RecentAlerts } from '../components/dashboard/RecentAlerts';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { useTrustPulseSocket } from '../hooks/useTrustPulseSocket';
import { Fingerprint } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Constellation3D, ConstellationLegend } from '../three/Constellation3D';

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
      const [ridersData, sessionsData, alertsData, configData] = await Promise.all([
        api.getRiders(),
        api.getSessions(25),
        api.getAlerts(20),
        api.getConfig(),
      ]);
      setRiders(ridersData);
      setSessions(sessionsData);
      setAlerts(alertsData);
      setConfig(configData);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to connect to TrustPulse API';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useTrustPulseSocket(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const heroSessions = useMemo(() => riders.map((r) => r.last).filter((s): s is Session => !!s), [riders]);

  if (isLoading) {
    return <LoadingState message="Connecting to TrustPulse Engine & telemetry stream..." />;
  }

  if (error) {
    return (
      <ErrorState
        title="Operations Dashboard Disconnected"
        message={error}
        onRetry={fetchData}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Live hero: the fleet as a city constellation */}
      <section className="relative overflow-hidden rounded-2xl border border-slate-800 bg-[#05080f]">
        <Constellation3D sessions={heroSessions} height={440} />
        <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col gap-1 bg-gradient-to-b from-[#05080f] via-[#05080f]/70 to-transparent p-5 pb-12">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.25em] text-cyan-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" /> Live fleet · {heroSessions.length} riders
          </div>
          <h2 className="text-2xl font-semibold text-slate-50 md:text-3xl">Phone changed, city changed: fine.</h2>
          <h2 className="-mt-1 text-2xl font-semibold text-rose-400 md:text-3xl">Person changed: caught.</h2>
        </div>
        <div className="pointer-events-auto absolute right-4 top-4">
          <Link
            to="/stage"
            className="flex items-center gap-2 rounded-xl border border-cyan-500/50 bg-cyan-950/70 px-3 py-2 text-xs font-semibold text-cyan-200 backdrop-blur transition hover:bg-cyan-900/70"
          >
            <Fingerprint className="h-4 w-4" /> Open Demo Stage
          </Link>
        </div>
        <ConstellationLegend className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#05080f] to-transparent px-5 pb-3 pt-8" />
      </section>

      {/* KPI Cards */}
      <MetricsGrid
        riders={riders}
        sessions={sessions}
        alerts={alerts}
        threshold={config?.threshold ?? null}
      />

      {/* Activity and alerts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RecentSessions sessions={sessions} />
        </div>
        <div className="lg:col-span-1">
          <RecentAlerts alerts={alerts} />
        </div>
      </div>
    </div>
  );
};
