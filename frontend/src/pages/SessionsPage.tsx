import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import type { ActionType, Session, SessionStatusType } from '../types/api';
import { StatusBadge } from '../components/common/StatusBadge';
import { TrustScore } from '../components/common/TrustScore';
import { RiskIndicator } from '../components/common/RiskIndicator';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { EmptyState } from '../components/common/EmptyState';
import { useTrustPulseSocket } from '../hooks/useTrustPulseSocket';
import { formatCoords, formatDateTime, formatRelativeTime } from '../utils/formatting';
import {
  Search,
  MapPin,
  X,
  ExternalLink,
  ArrowUpDown,
  Filter,
} from 'lucide-react';

export const SessionsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialRiderId = searchParams.get('rider_id') || '';

  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState(initialRiderId);
  const [actionFilter, setActionFilter] = useState<ActionType | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<SessionStatusType | 'ALL'>('ALL');
  const [sortBy, setSortBy] = useState<'time' | 'risk' | 'trust'>('time');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

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
    let result = sessions.filter((s) => {
      const q = search.toLowerCase();
      const matchesSearch =
        search === '' ||
        s.name.toLowerCase().includes(q) ||
        s.rider_id.toLowerCase().includes(q) ||
        s.session_id.toLowerCase().includes(q) ||
        (s.city && s.city.toLowerCase().includes(q));

      const matchesAction = actionFilter === 'ALL' || s.action === actionFilter;
      const matchesStatus = statusFilter === 'ALL' || s.status === statusFilter;

      return matchesSearch && matchesAction && matchesStatus;
    });

    result = result.sort((a, b) => {
      let valA = 0;
      let valB = 0;
      if (sortBy === 'time') {
        valA = a.received_at || a.ts;
        valB = b.received_at || b.ts;
      } else if (sortBy === 'risk') {
        valA = a.risk;
        valB = b.risk;
      } else if (sortBy === 'trust') {
        valA = a.trust;
        valB = b.trust;
      }
      return sortOrder === 'desc' ? valB - valA : valA - valB;
    });

    return result;
  }, [sessions, search, actionFilter, statusFilter, sortBy, sortOrder]);

  const toggleSort = (field: 'time' | 'risk' | 'trust') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  if (isLoading) {
    return <LoadingState message="Streaming active sessions..." />;
  }

  if (error) {
    return (
      <ErrorState
        title="Could Not Load Sessions"
        message={error}
        onRetry={fetchSessions}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="bg-[#0a0a0a] border border-[#1e2c47] rounded-xl p-3 md:p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs font-mono">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by ID, name, session or city..."
            className="w-full pl-9 pr-3 py-2 bg-neutral-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value as ActionType | 'ALL')}
              className="bg-neutral-900 border border-slate-700 text-slate-200 py-1.5 px-2.5 rounded-lg focus:outline-none focus:border-cyan-500"
            >
              <option value="ALL">All Actions</option>
              <option value="ALLOW">ALLOW</option>
              <option value="SOFT_CHECK">SOFT_CHECK</option>
              <option value="STEP_UP">STEP_UP</option>
              <option value="REVIEW">REVIEW</option>
              <option value="ENROLLING">ENROLLING</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as SessionStatusType | 'ALL')}
              className="bg-neutral-900 border border-slate-700 text-slate-200 py-1.5 px-2.5 rounded-lg focus:outline-none focus:border-cyan-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="PENDING_REVIEW">PENDING_REVIEW</option>
              <option value="VERIFIED">VERIFIED</option>
              <option value="BLOCKED">BLOCKED</option>
            </select>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => toggleSort('time')}
              className={`px-2.5 py-1.5 rounded-lg border text-xs flex items-center gap-1 transition ${
                sortBy === 'time'
                  ? 'bg-cyan-950/80 text-cyan-300 border-cyan-800'
                  : 'bg-neutral-900 text-slate-400 border-slate-700 hover:text-slate-200'
              }`}
            >
              Time <ArrowUpDown className="w-3 h-3" />
            </button>
            <button
              onClick={() => toggleSort('risk')}
              className={`px-2.5 py-1.5 rounded-lg border text-xs flex items-center gap-1 transition ${
                sortBy === 'risk'
                  ? 'bg-cyan-950/80 text-cyan-300 border-cyan-800'
                  : 'bg-neutral-900 text-slate-400 border-slate-700 hover:text-slate-200'
              }`}
            >
              Risk <ArrowUpDown className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Sessions Table */}
      {filteredSessions.length === 0 ? (
        <EmptyState
          title="No sessions found"
          description="No recent sessions match the search and filter query."
        />
      ) : (
        <div className="bg-[#0a0a0a] border border-[#1e2c47] rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#0f0f0f] border-b border-[#1e2c47] text-slate-400 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-3">Session</th>
                  <th className="py-3 px-3">Rider</th>
                  <th className="py-3 px-3">City / GPS</th>
                  <th className="py-3 px-3">Trust</th>
                  <th className="py-3 px-3">Risk Breakdown</th>
                  <th className="py-3 px-3">Decision</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Verdict / Reason</th>
                  <th className="py-3 px-3 text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2c47]/50">
                {filteredSessions.map((session) => (
                  <tr
                    key={session.session_id}
                    onClick={() => setSelectedSession(session)}
                    className="hover:bg-neutral-800/40 transition cursor-pointer group"
                  >
                    <td className="py-3 px-3 text-cyan-400 font-semibold">
                      {session.session_id.slice(0, 8)}
                    </td>

                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-200">{session.name}</div>
                      <div className="text-[10px] text-slate-400">{session.rider_id}</div>
                    </td>

                    <td className="py-3 px-3 text-slate-300">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        <span>{session.city || 'Unknown'}</span>
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <TrustScore score={session.trust} size="sm" />
                    </td>

                    <td className="py-3 px-3">
                      <RiskIndicator
                        risk={session.risk}
                        behaviourRisk={session.behaviour_risk}
                        contextRisk={session.context_risk}
                        compact
                      />
                    </td>

                    <td className="py-3 px-3">
                      <StatusBadge type="action" value={session.action} size="sm" />
                    </td>

                    <td className="py-3 px-3">
                      <StatusBadge type="status" value={session.status} size="sm" />
                    </td>

                    <td className="py-3 px-3 text-slate-300 max-w-xs truncate" title={session.verdict}>
                      {session.verdict}
                    </td>

                    <td className="py-3 px-3 text-right text-slate-400 whitespace-nowrap">
                      {formatRelativeTime(session.received_at || session.ts)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Session Details Drawer Modal */}
      {selectedSession && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-xs animate-fade-in"
          onClick={() => setSelectedSession(null)}
        >
          <div
            className="w-full max-w-lg bg-[#0a0a0a] border-l border-[#1e2c47] h-full p-6 flex flex-col justify-between overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-5 text-xs font-mono">
              <div className="flex items-start justify-between pb-4 border-b border-[#1e2c47]">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                    Session Inspection
                  </span>
                  <h3 className="text-base font-bold text-slate-100 mt-0.5">
                    ID: {selectedSession.session_id}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedSession(null)}
                  className="p-1 rounded text-slate-400 hover:text-slate-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Identity & Status */}
              <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-neutral-900 border border-slate-800">
                <div>
                  <span className="text-slate-400 text-[10px] block">Rider</span>
                  <span className="text-slate-100 font-semibold">{selectedSession.name}</span>
                  <div className="text-[10px] text-slate-400">{selectedSession.rider_id}</div>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">Decision & Status</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <StatusBadge type="action" value={selectedSession.action} size="sm" />
                    <StatusBadge type="status" value={selectedSession.status} size="sm" />
                  </div>
                </div>
              </div>

              {/* Trust & Risk Breakdown */}
              <div className="p-4 rounded-lg bg-neutral-900 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-semibold">Trust Similarity:</span>
                  <TrustScore score={selectedSession.trust} size="md" />
                </div>
                <RiskIndicator
                  risk={selectedSession.risk}
                  behaviourRisk={selectedSession.behaviour_risk}
                  contextRisk={selectedSession.context_risk}
                />
              </div>

              {/* Verdict & Reasons */}
              <div className="p-3.5 rounded-lg bg-neutral-900/60 border border-slate-800 space-y-2">
                <span className="text-slate-400 uppercase text-[10px] tracking-wider block font-semibold">
                  Explainable Verdict
                </span>
                <div className="text-slate-200 font-semibold text-xs leading-relaxed">
                  {selectedSession.verdict}
                </div>
                {selectedSession.reasons && selectedSession.reasons.length > 0 && (
                  <ul className="space-y-1 text-slate-300 text-xs list-disc pl-4 pt-1">
                    {selectedSession.reasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Telemetry Context */}
              <div className="p-3.5 rounded-lg bg-neutral-900/60 border border-slate-800 space-y-2">
                <span className="text-slate-400 uppercase text-[10px] tracking-wider block font-semibold">
                  Environment Context
                </span>
                <div className="grid grid-cols-2 gap-2 text-slate-300 text-[11px]">
                  <div>City: <strong>{selectedSession.city || '-'}</strong></div>
                  <div>GPS: <strong>{formatCoords(selectedSession.lat, selectedSession.lon)}</strong></div>
                  <div>Device ID: <span className="font-mono text-slate-400">{selectedSession.device_id?.slice(0, 10)}...</span></div>
                  <div>Enrolling: <strong>{selectedSession.enrolling ? 'Yes' : 'No'}</strong></div>
                  <div>Received: <span>{formatDateTime(selectedSession.received_at)}</span></div>
                  <div>Timestamp: <span>{formatDateTime(selectedSession.ts)}</span></div>
                </div>
              </div>

              {/* Signal Deviations */}
              {selectedSession.signals && Object.keys(selectedSession.signals).length > 0 && (
                <div className="space-y-2">
                  <span className="text-slate-400 uppercase text-[10px] tracking-wider block font-semibold">
                    Signal Group Telemetry Deviations
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {Object.entries(selectedSession.signals).map(([grp, info]) => (
                      <div key={grp} className="p-2.5 rounded bg-neutral-900 border border-slate-800">
                        <div className="flex items-center justify-between text-xs">
                          <span className="capitalize font-semibold text-slate-200">{grp}</span>
                          <span className="text-cyan-400 font-bold">{info.match}% match</span>
                        </div>
                        {info.top && info.top.length > 0 && (
                          <div className="text-[10px] text-slate-400 mt-1">
                            Anomalies: {info.top.map(([feat, dist]) => `${feat} (${dist}σ)`).join(', ')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-[#1e2c47] mt-6">
              <Link
                to={`/riders/${selectedSession.rider_id}`}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-mono font-medium rounded-lg bg-cyan-950/80 text-cyan-300 border border-cyan-800/80 hover:bg-cyan-900/60 transition"
              >
                <span>Go to Rider Details & Full History</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
