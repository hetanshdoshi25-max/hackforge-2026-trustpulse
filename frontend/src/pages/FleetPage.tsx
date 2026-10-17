import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import type { ActionType, Session } from '../types/api';
import { FleetScene } from '../components/fleet/FleetScene';
import { FleetFallback } from '../components/fleet/FleetFallback';
import { FleetFilters } from '../components/fleet/FleetFilters';
import { StatusBadge } from '../components/common/StatusBadge';
import { TrustScore } from '../components/common/TrustScore';
import { RiskIndicator } from '../components/common/RiskIndicator';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { useTrustPulseSocket } from '../hooks/useTrustPulseSocket';
import { formatCoords, formatRelativeTime } from '../utils/formatting';
import { User, MapPin, X, ExternalLink } from 'lucide-react';

export const FleetPage: React.FC = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedAction, setSelectedAction] = useState<ActionType | 'ALL'>('ALL');
  const [minRisk, setMinRisk] = useState(0);
  const [viewMode, setViewMode] = useState<'3d' | '2d'>('3d');

  const fetchSessions = useCallback(async () => {
    try {
      setError(null);
      const data = await api.getSessions(100);
      setSessions(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch sessions');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useTrustPulseSocket(
    useCallback(() => {
      fetchSessions();
    }, [fetchSessions])
  );

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      const matchesSearch =
        search === '' ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.rider_id.toLowerCase().includes(search.toLowerCase()) ||
        (s.city && s.city.toLowerCase().includes(search.toLowerCase()));

      const matchesAction = selectedAction === 'ALL' || s.action === selectedAction;
      const matchesRisk = s.risk >= minRisk;

      return matchesSearch && matchesAction && matchesRisk;
    });
  }, [sessions, search, selectedAction, minRisk]);

  if (isLoading) {
    return <LoadingState message="Loading fleet spatial telemetry..." />;
  }

  if (error) {
    return (
      <ErrorState
        title="Fleet Telemetry Unavailable"
        message={error}
        onRetry={fetchSessions}
      />
    );
  }

  return (
    <div className="space-y-4 flex flex-col h-full">
      {/* Filters bar */}
      <FleetFilters
        search={search}
        onSearchChange={setSearch}
        selectedAction={selectedAction}
        onActionChange={setSelectedAction}
        minRisk={minRisk}
        onMinRiskChange={setMinRisk}
        viewMode={viewMode}
        onViewModeToggle={() => setViewMode(viewMode === '3d' ? '2d' : '3d')}
      />

      {/* Main visualization container */}
      <div className="relative flex-1 min-h-[500px] flex flex-col lg:flex-row gap-4">
        <div className="flex-1 relative min-h-[460px] h-full">
          {viewMode === '3d' ? (
            <FleetScene
              sessions={filteredSessions}
              selectedSession={selectedSession}
              onSelectSession={setSelectedSession}
            />
          ) : (
            <FleetFallback
              sessions={filteredSessions}
              selectedSession={selectedSession}
              onSelectSession={setSelectedSession}
            />
          )}

          {/* Color Legend */}
          <div className="absolute bottom-3 left-3 bg-slate-900/80 backdrop-blur-sm border border-slate-800 rounded-lg p-2.5 text-[11px] font-mono text-slate-300 flex flex-wrap items-center gap-3 shadow-lg pointer-events-none">
            <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
              Legend:
            </span>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <span>Allow (&lt;25% Risk)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <span>Soft Check (25-50%)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-400" />
              <span>Step-Up (50-75%)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
              <span>Review (&gt;75%)</span>
            </div>
          </div>
        </div>

        {/* Selected rider details side panel */}
        {selectedSession && (
          <div className="w-full lg:w-80 bg-[#0c1322] border border-[#1e2c47] rounded-xl p-4 flex flex-col justify-between shrink-0 animate-fade-in shadow-2xl">
            <div>
              <div className="flex items-start justify-between pb-3 border-b border-[#1e2c47] mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-mono font-bold text-sm text-slate-100">
                      {selectedSession.name}
                    </h3>
                    <span className="text-xs font-mono text-slate-400">
                      {selectedSession.rider_id}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedSession(null)}
                  className="p-1 rounded text-slate-400 hover:text-slate-200"
                  aria-label="Close panel"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">City / Location:</span>
                  <span className="text-slate-200 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                    {selectedSession.city || 'Unknown'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Coordinates:</span>
                  <span className="text-slate-300 text-[11px]">
                    {formatCoords(selectedSession.lat, selectedSession.lon)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Decision:</span>
                  <StatusBadge type="action" value={selectedSession.action} size="sm" />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Session Status:</span>
                  <StatusBadge type="status" value={selectedSession.status} size="sm" />
                </div>

                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Trust Score:</span>
                    <TrustScore score={selectedSession.trust} size="sm" />
                  </div>
                  <RiskIndicator
                    risk={selectedSession.risk}
                    behaviourRisk={selectedSession.behaviour_risk}
                    contextRisk={selectedSession.context_risk}
                  />
                </div>

                {selectedSession.verdict && (
                  <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-[11px] text-slate-300">
                    <span className="text-slate-400 font-semibold block mb-0.5">Verdict:</span>
                    {selectedSession.verdict}
                  </div>
                )}

                <div className="text-[11px] text-slate-400">
                  Last verified: {formatRelativeTime(selectedSession.received_at || selectedSession.ts)}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-[#1e2c47] mt-4">
              <Link
                to={`/riders/${selectedSession.rider_id}`}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-mono font-medium rounded-lg bg-cyan-950/80 text-cyan-300 border border-cyan-800/80 hover:bg-cyan-900/60 transition"
              >
                <span>View Full Rider History</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
