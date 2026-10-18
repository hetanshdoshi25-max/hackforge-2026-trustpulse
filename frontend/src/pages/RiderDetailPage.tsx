import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { api } from '../services/api';
import type { RiderDetail, Session } from '../types/api';
import { StatusBadge } from '../components/common/StatusBadge';
import { TrustScore } from '../components/common/TrustScore';
import { RiskIndicator } from '../components/common/RiskIndicator';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { useTrustPulseSocket } from '../hooks/useTrustPulseSocket';
import { AccountTimeMachine } from '../components/rider/AccountTimeMachine';
import { formatDateTime, formatRelativeTime } from '../utils/formatting';
import {
  User,
  ArrowLeft,
  Trash2,
  MapPin,
  Smartphone,
  ShieldCheck,
  TrendingUp,
  Activity,
} from 'lucide-react';

export const RiderDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  const [rider, setRider] = useState<RiderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reset confirmation dialog state
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const fetchRider = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      const data = await api.getRider(id);
      setRider(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load rider details');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useTrustPulseSocket(
    useCallback(
      (msg) => {
        if (msg.type === 'rider_reset' && (msg.data as { rider_id?: string })?.rider_id === id) {
          fetchRider();
        } else if (msg.type === 'session') {
          const session = msg.data as Session;
          if (session && session.rider_id === id) {
            fetchRider();
          }
        }
      },
      [id, fetchRider]
    )
  );

  useEffect(() => {
    fetchRider();
  }, [fetchRider]);

  const handleResetConfirm = async () => {
    if (!id) return;
    setIsResetting(true);
    try {
      await api.resetRider(id);
      setIsResetDialogOpen(false);
      // Re-fetch or navigate
      await fetchRider();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setIsResetting(false);
    }
  };

  // Prepare chart data (oldest to newest)
  const chartData = useMemo(() => {
    if (!rider || !rider.history) return [];
    return rider.history.map((s, index) => ({
      index: index + 1,
      time: formatDateTime(s.received_at || s.ts),
      trust: s.trust,
      risk: s.risk,
      action: s.action,
      city: s.city || 'Unknown',
    }));
  }, [rider]);

  const latestSession: Session | undefined = rider?.history[rider.history.length - 1];

  if (isLoading) {
    return <LoadingState message="Loading rider profile & session timeline..." />;
  }

  if (error || !rider) {
    return (
      <ErrorState
        title="Rider Profile Not Found"
        message={error || 'No rider exists with this identifier.'}
        onRetry={fetchRider}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Top action row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Link
          to="/riders"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-cyan-400 hover:text-cyan-300 transition"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Riders Directory
        </Link>

        <button
          onClick={() => setIsResetDialogOpen(true)}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-mono font-medium rounded-lg bg-rose-950/60 text-rose-300 border border-rose-800/80 hover:bg-rose-900/60 transition self-start sm:self-auto"
        >
          <Trash2 className="w-3.5 h-3.5 text-rose-400" />
          Reset Baseline & History
        </button>
      </div>

      {/* Rider Header Card */}
      <div className="p-5 rounded-xl bg-[#0a0a0a] border border-[#1e2c47] flex flex-col lg:flex-row lg:items-center justify-between gap-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-neutral-800 border border-slate-700 flex items-center justify-center text-cyan-400 shrink-0 shadow-md">
            <User className="w-6 h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-xl font-bold font-mono text-slate-100">{rider.name}</h2>
              <span className="text-xs font-mono text-slate-400 bg-neutral-900 px-2 py-0.5 rounded border border-slate-800">
                {rider.rider_id}
              </span>
              {rider.enrolled ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono bg-emerald-950/70 text-emerald-400 border border-emerald-800">
                  <ShieldCheck className="w-3.5 h-3.5" /> Enrolled (8/8)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono bg-blue-950/70 text-blue-400 border border-blue-800">
                  Enrolling ({rider.enroll_progress}/8 Logins)
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-slate-400 mt-2">
              <span className="flex items-center gap-1 text-slate-300">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                {rider.known_cities.join(', ') || 'None recorded'}
              </span>
              <span>·</span>
              <span className="flex items-center gap-1 text-slate-300">
                <Smartphone className="w-3.5 h-3.5 text-slate-400" />
                {rider.known_devices.length} verified device(s)
              </span>
              <span>·</span>
              <span>{rider.sessions} total sessions</span>
            </div>
          </div>
        </div>

        {/* Latest Scores Quick View */}
        {latestSession && (
          <div className="flex items-center gap-4 bg-neutral-900/80 p-3 rounded-lg border border-slate-800">
            <div>
              <span className="text-[10px] font-mono uppercase text-slate-400 block mb-0.5">
                Current Trust
              </span>
              <TrustScore score={latestSession.trust} size="md" />
            </div>
            <div className="h-8 w-px bg-neutral-800" />
            <div>
              <span className="text-[10px] font-mono uppercase text-slate-400 block mb-0.5">
                Current Decision
              </span>
              <StatusBadge type="action" value={latestSession.action} size="md" />
            </div>
          </div>
        )}
      </div>

      {/* Latest Session Analysis & Reason Breakdown */}
      {latestSession && (
        <div className="p-5 rounded-xl bg-[#0a0a0a] border border-[#1e2c47] space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#1e2c47]">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <h3 className="font-mono font-bold text-sm text-slate-100">
                Latest Evaluation Breakdown
              </h3>
            </div>
            <span className="text-xs font-mono text-slate-400">
              Verified {formatRelativeTime(latestSession.received_at)}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3.5 rounded-lg bg-neutral-900/60 border border-slate-800 space-y-2 text-xs font-mono">
              <span className="text-slate-400 uppercase text-[10px] tracking-wider block">
                Risk Attribution
              </span>
              <RiskIndicator
                risk={latestSession.risk}
                behaviourRisk={latestSession.behaviour_risk}
                contextRisk={latestSession.context_risk}
              />
              <div className="text-[11px] text-slate-400 pt-1">
                Status: <strong className="text-slate-200">{latestSession.status}</strong>
              </div>
            </div>

            <div className="md:col-span-2 p-3.5 rounded-lg bg-neutral-900/60 border border-slate-800 space-y-2 text-xs font-mono">
              <span className="text-slate-400 uppercase text-[10px] tracking-wider block">
                Decision Verdict & Explanations
              </span>
              <div className="text-slate-200 font-semibold text-sm">
                {latestSession.verdict}
              </div>
              <ul className="space-y-1 text-slate-300 text-xs list-disc pl-4 pt-1">
                {latestSession.reasons.map((reason, i) => (
                  <li key={i}>{reason}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Account time machine: every session's fingerprint, scrub or play */}
          {rider && <AccountTimeMachine history={rider.history} />}

          {/* Behavioral Signal Breakdown */}
          {latestSession.signals && Object.keys(latestSession.signals).length > 0 && (
            <div className="pt-2">
              <span className="text-xs font-mono text-slate-400 uppercase tracking-wider block mb-2">
                Signal Group Baselines Match
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
                {Object.entries(latestSession.signals).map(([group, data]) => (
                  <div
                    key={group}
                    className="p-3 rounded-lg bg-neutral-900/80 border border-slate-800 flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="capitalize text-slate-300 font-semibold">{group}</span>
                      <span className="text-cyan-400 font-bold">{data.match}% match</span>
                    </div>
                    {data.top && data.top.length > 0 && (
                      <div className="text-[10px] text-slate-400 truncate">
                        Biggest variance: {data.top[0][0]} ({data.top[0][1]}σ)
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Trust & Risk Chronological Timeline Chart */}
      <div className="p-5 rounded-xl bg-[#0a0a0a] border border-[#1e2c47] space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#1e2c47]">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-cyan-400" />
            <h3 className="font-mono font-bold text-sm text-slate-100">
              Chronological Trust & Risk Evolution
            </h3>
          </div>
          <span className="text-xs font-mono text-slate-400">
            {chartData.length} recorded session(s)
          </span>
        </div>

        {chartData.length > 0 ? (
          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2c47" opacity={0.6} />
                <XAxis
                  dataKey="index"
                  stroke="#64748b"
                  tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'monospace' }}
                  tickFormatter={(val) => `S#${val}`}
                />
                <YAxis
                  domain={[0, 100]}
                  stroke="#64748b"
                  tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'monospace' }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div className="bg-neutral-900 border border-slate-700 p-2.5 rounded-lg text-xs font-mono text-slate-200 shadow-xl">
                          <div className="text-slate-400 mb-1">{d.time} · {d.city}</div>
                          <div className="text-emerald-400">Trust Score: {d.trust}</div>
                          <div className="text-rose-400">Risk Score: {d.risk}%</div>
                          <div className="text-cyan-400">Decision: {d.action}</div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="trust"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  dot={{ fill: '#10b981', r: 4 }}
                  activeDot={{ r: 6 }}
                  name="Trust Score"
                />
                <Line
                  type="monotone"
                  dataKey="risk"
                  stroke="#ef4444"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={{ fill: '#ef4444', r: 3 }}
                  name="Risk Score"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="text-center py-8 text-xs font-mono text-slate-500">
            No session history recorded yet.
          </div>
        )}
      </div>

      {/* Session History Table */}
      <div className="p-5 rounded-xl bg-[#0a0a0a] border border-[#1e2c47] space-y-4">
        <h3 className="font-mono font-bold text-sm text-slate-100">
          Full Historical Sessions
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-[#0f0f0f] border-b border-[#1e2c47] text-slate-400 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-2.5 px-3">Session ID</th>
                <th className="py-2.5 px-3">Location</th>
                <th className="py-2.5 px-3">Trust</th>
                <th className="py-2.5 px-3">Risk</th>
                <th className="py-2.5 px-3">Decision</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Verdict / Reason</th>
                <th className="py-2.5 px-3 text-right">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2c47]/50">
              {rider.history.slice().reverse().map((session) => (
                <tr key={session.session_id} className="hover:bg-neutral-800/40 transition">
                  <td className="py-3 px-3 font-semibold text-slate-200">
                    {session.session_id.slice(0, 8)}...
                  </td>
                  <td className="py-3 px-3 text-slate-300">
                    {session.city || 'Unknown'}
                  </td>
                  <td className="py-3 px-3">
                    <TrustScore score={session.trust} size="sm" />
                  </td>
                  <td className="py-3 px-3">
                    <RiskIndicator risk={session.risk} compact />
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

      {/* Confirmation Dialog for Destructive Reset */}
      <ConfirmDialog
        isOpen={isResetDialogOpen}
        title={`Reset Baseline & History for ${rider.name}?`}
        message="This operation is destructive. It completely erases the rider's behavioral baseline, all enrolled keystroke/touch/motion samples, and historical sessions. The rider will return to the initial 0/8 enrollment state."
        confirmLabel="Erase & Reset Rider"
        cancelLabel="Cancel"
        isDestructive={true}
        isLoading={isResetting}
        onConfirm={handleResetConfirm}
        onCancel={() => setIsResetDialogOpen(false)}
      />
    </div>
  );
};
