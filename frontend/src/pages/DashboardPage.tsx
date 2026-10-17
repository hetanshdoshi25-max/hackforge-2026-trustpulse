import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import type { Alert, AppConfig, RiderListItem, Session } from '../types/api';
import { MetricsGrid } from '../components/dashboard/MetricsGrid';
import { RecentSessions } from '../components/dashboard/RecentSessions';
import { RecentAlerts } from '../components/dashboard/RecentAlerts';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { useTrustPulseSocket } from '../hooks/useTrustPulseSocket';
import { ShieldCheck, Info } from 'lucide-react';

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
      {/* Banner */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-cyan-950/40 via-slate-900/60 to-violet-950/40 border border-cyan-800/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-cyan-900/40 border border-cyan-500/50 text-cyan-400 shrink-0 mt-0.5">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold font-mono tracking-wider text-slate-100">
                CONTINUOUS RIDER IDENTITY ENGINE
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono border border-cyan-500/30">
                HackForge 2026
              </span>
            </div>
            <p className="text-xs text-slate-300 font-mono mt-1">
              "Phone changed, city changed: fine. Person changed: caught."
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-slate-400 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800">
          <Info className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>Behavioral differences dominate; contextual shifts alone never lockout honest riders.</span>
        </div>
      </div>

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
