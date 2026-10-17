import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import type { ActionType, RiderListItem } from '../types/api';
import { StatusBadge } from '../components/common/StatusBadge';
import { TrustScore } from '../components/common/TrustScore';
import { RiskIndicator } from '../components/common/RiskIndicator';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { EmptyState } from '../components/common/EmptyState';
import { useTrustPulseSocket } from '../hooks/useTrustPulseSocket';
import { formatRelativeTime } from '../utils/formatting';
import { Search, User, Smartphone, MapPin, ArrowUpDown, ChevronRight, ShieldCheck } from 'lucide-react';

export const RidersPage: React.FC = () => {
  const [riders, setRiders] = useState<RiderListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<ActionType | 'ALL'>('ALL');
  const [sortField, setSortField] = useState<'time' | 'trust' | 'risk' | 'sessions'>('time');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const fetchRiders = useCallback(async () => {
    try {
      setError(null);
      const data = await api.getRiders();
      setRiders(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch riders list');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useTrustPulseSocket(
    useCallback(() => {
      fetchRiders();
    }, [fetchRiders])
  );

  useEffect(() => {
    fetchRiders();
  }, [fetchRiders]);

  const filteredRiders = useMemo(() => {
    let result = riders.filter((r) => {
      const query = search.toLowerCase();
      const matchesSearch =
        search === '' ||
        r.name.toLowerCase().includes(query) ||
        r.rider_id.toLowerCase().includes(query) ||
        r.known_cities.some((c) => c.toLowerCase().includes(query));

      const matchesAction =
        actionFilter === 'ALL' || (r.last && r.last.action === actionFilter);

      return matchesSearch && matchesAction;
    });

    result = result.sort((a, b) => {
      let valA = 0;
      let valB = 0;

      if (sortField === 'time') {
        valA = a.last?.received_at || 0;
        valB = b.last?.received_at || 0;
      } else if (sortField === 'trust') {
        valA = a.last?.trust ?? -1;
        valB = b.last?.trust ?? -1;
      } else if (sortField === 'risk') {
        valA = a.last?.risk ?? -1;
        valB = b.last?.risk ?? -1;
      } else if (sortField === 'sessions') {
        valA = a.sessions;
        valB = b.sessions;
      }

      return sortOrder === 'desc' ? valB - valA : valA - valB;
    });

    return result;
  }, [riders, search, actionFilter, sortField, sortOrder]);

  const toggleSort = (field: 'time' | 'trust' | 'risk' | 'sessions') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  if (isLoading) {
    return <LoadingState message="Loading registered rider profiles..." />;
  }

  if (error) {
    return (
      <ErrorState
        title="Could Not Load Riders"
        message={error}
        onRetry={fetchRiders}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Filter toolbar */}
      <div className="bg-[#0c1322] border border-[#1e2c47] rounded-xl p-3 md:p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs font-mono">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search rider by name, ID or city..."
            className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Action:</span>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value as ActionType | 'ALL')}
              className="bg-slate-900 border border-slate-700 text-slate-200 py-1.5 px-2.5 rounded-lg focus:outline-none focus:border-cyan-500"
            >
              <option value="ALL">All Actions</option>
              <option value="ALLOW">ALLOW</option>
              <option value="SOFT_CHECK">SOFT_CHECK</option>
              <option value="STEP_UP">STEP_UP</option>
              <option value="REVIEW">REVIEW</option>
              <option value="ENROLLING">ENROLLING</option>
            </select>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => toggleSort('time')}
              className={`px-2.5 py-1.5 rounded-lg border text-xs flex items-center gap-1 transition ${
                sortField === 'time'
                  ? 'bg-cyan-950/80 text-cyan-300 border-cyan-800'
                  : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-slate-200'
              }`}
            >
              Time <ArrowUpDown className="w-3 h-3" />
            </button>
            <button
              onClick={() => toggleSort('trust')}
              className={`px-2.5 py-1.5 rounded-lg border text-xs flex items-center gap-1 transition ${
                sortField === 'trust'
                  ? 'bg-cyan-950/80 text-cyan-300 border-cyan-800'
                  : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-slate-200'
              }`}
            >
              Trust <ArrowUpDown className="w-3 h-3" />
            </button>
            <button
              onClick={() => toggleSort('risk')}
              className={`px-2.5 py-1.5 rounded-lg border text-xs flex items-center gap-1 transition ${
                sortField === 'risk'
                  ? 'bg-cyan-950/80 text-cyan-300 border-cyan-800'
                  : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-slate-200'
              }`}
            >
              Risk <ArrowUpDown className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Rider List or Empty State */}
      {filteredRiders.length === 0 ? (
        <EmptyState
          title="No riders match your criteria"
          description="Try loosening your search query or action filter."
        />
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block bg-[#0c1322] border border-[#1e2c47] rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#0e1628] border-b border-[#1e2c47] text-slate-400 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Rider</th>
                  <th className="py-3 px-4">Enrollment</th>
                  <th className="py-3 px-4">Known Context</th>
                  <th className="py-3 px-4">Latest Trust</th>
                  <th className="py-3 px-4">Latest Risk</th>
                  <th className="py-3 px-4">Current Decision</th>
                  <th className="py-3 px-4">Last Activity</th>
                  <th className="py-3 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2c47]/50">
                {filteredRiders.map((rider) => (
                  <tr
                    key={rider.rider_id}
                    className="hover:bg-slate-800/40 transition group"
                  >
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-bold">
                          <User className="w-4 h-4" />
                        </div>
                        <div>
                          <Link
                            to={`/riders/${rider.rider_id}`}
                            className="font-semibold text-slate-100 hover:text-cyan-400 transition"
                          >
                            {rider.name}
                          </Link>
                          <div className="text-[10px] text-slate-400">{rider.rider_id}</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      {rider.enrolled ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] bg-emerald-950/60 text-emerald-400 border border-emerald-800/80">
                          <ShieldCheck className="w-3 h-3" />
                          Enrolled ({rider.enroll_progress}/8)
                        </span>
                      ) : (
                        <div className="space-y-1">
                          <span className="text-[11px] text-blue-400">
                            Enrolling ({rider.enroll_progress}/8)
                          </span>
                          <div className="w-24 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full"
                              style={{ width: `${(rider.enroll_progress / 8) * 100}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="space-y-0.5 text-[11px]">
                        <div className="flex items-center gap-1 text-slate-300">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          <span>{rider.known_cities.join(', ') || 'No cities recorded'}</span>
                        </div>
                        <div className="flex items-center gap-1 text-slate-400">
                          <Smartphone className="w-3 h-3 text-slate-500" />
                          <span>{rider.known_devices} device(s)</span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <TrustScore score={rider.last?.trust} size="sm" />
                    </td>

                    <td className="py-3.5 px-4">
                      <RiskIndicator
                        risk={rider.last?.risk}
                        behaviourRisk={rider.last?.behaviour_risk}
                        contextRisk={rider.last?.context_risk}
                        compact
                      />
                    </td>

                    <td className="py-3.5 px-4">
                      {rider.last ? (
                        <StatusBadge type="action" value={rider.last.action} size="sm" />
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-slate-400 whitespace-nowrap">
                      {formatRelativeTime(rider.last?.received_at || rider.last?.ts)}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <Link
                        to={`/riders/${rider.rider_id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition"
                      >
                        Inspect <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {filteredRiders.map((rider) => (
              <Link
                key={rider.rider_id}
                to={`/riders/${rider.rider_id}`}
                className="bg-[#0c1322] border border-[#1e2c47] rounded-xl p-4 flex flex-col gap-3 active:bg-slate-800/60"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-100 font-mono text-sm">{rider.name}</h4>
                      <span className="text-xs font-mono text-slate-400">{rider.rider_id}</span>
                    </div>
                  </div>
                  {rider.last && <StatusBadge type="action" value={rider.last.action} size="sm" />}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Trust Score</span>
                    <TrustScore score={rider.last?.trust} size="sm" />
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Risk Score</span>
                    <span className="font-bold text-slate-200">{rider.last?.risk ?? '—'}%</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-1 border-t border-slate-800">
                  <span>{rider.known_cities[0] || 'Unknown City'}</span>
                  <span>{formatRelativeTime(rider.last?.received_at)}</span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
