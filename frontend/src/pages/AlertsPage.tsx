import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import type { Alert, AlertType } from '../types/api';
import { StatusBadge } from '../components/common/StatusBadge';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { EmptyState } from '../components/common/EmptyState';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { useTrustPulseSocket } from '../hooks/useTrustPulseSocket';
import { formatDateTime, formatRelativeTime } from '../utils/formatting';
import {
  BellRing,
  Camera,
  CheckCircle2,
  XCircle,
  Eye,
  X,
  AlertTriangle,
  User,
  MapPin,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';

export const AlertsPage: React.FC = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter
  const [typeFilter, setTypeFilter] = useState<AlertType | 'ALL'>('ALL');

  // Active selfie review modal state
  const [activeAlert, setActiveAlert] = useState<Alert | null>(null);
  const [selfieImage, setSelfieImage] = useState<string | null>(null);
  const [loadingSelfie, setLoadingSelfie] = useState(false);
  const [selfieError, setSelfieError] = useState<string | null>(null);

  // Resolution confirmation state
  const [resolveAction, setResolveAction] = useState<'approve' | 'reject' | null>(null);
  const [isResolving, setIsResolving] = useState(false);

  const fetchAlerts = useCallback(async () => {
    try {
      setError(null);
      const data = await api.getAlerts(50);
      setAlerts(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch alerts');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useTrustPulseSocket(
    useCallback(() => {
      fetchAlerts();
    }, [fetchAlerts])
  );

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  // When opening review modal, fetch selfie if applicable
  const handleOpenReview = async (alert: Alert) => {
    setActiveAlert(alert);
    setSelfieImage(null);
    setSelfieError(null);

    if (alert.has_selfie || alert.alert_type === 'SELFIE_SUBMITTED') {
      setLoadingSelfie(true);
      try {
        const res = await api.getSessionSelfie(alert.session_id);
        setSelfieImage(res.image);
      } catch {
        setSelfieError('Selfie frame not stored or unavailable on server.');
      } finally {
        setLoadingSelfie(false);
      }
    }
  };

  const handleResolveConfirm = async () => {
    if (!activeAlert || !resolveAction) return;
    setIsResolving(true);
    try {
      await api.resolveSession(activeAlert.session_id, resolveAction);
      setResolveAction(null);
      setActiveAlert(null);
      await fetchAlerts();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Resolution failed');
    } finally {
      setIsResolving(false);
    }
  };

  const filteredAlerts = useMemo(() => {
    if (typeFilter === 'ALL') return alerts;
    return alerts.filter((a) => a.alert_type === typeFilter);
  }, [alerts, typeFilter]);

  if (isLoading) {
    return <LoadingState message="Loading review and alert queue..." />;
  }

  if (error) {
    return (
      <ErrorState
        title="Could Not Load Alerts"
        message={error}
        onRetry={fetchAlerts}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Alert Header & Filter */}
      <div className="bg-[#0a0a0a] border border-[#1e2c47] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center gap-2">
          <BellRing className="w-5 h-5 text-rose-400" />
          <div>
            <h2 className="text-base font-bold text-slate-100">Escalation & Review Queue</h2>
            <p className="text-xs text-slate-400">
              Human-in-the-loop review for behavioral step-ups and submitted selfies
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400">Filter:</span>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as AlertType | 'ALL')}
            className="bg-neutral-900 border border-slate-700 text-slate-200 py-1.5 px-3 rounded-lg focus:outline-none focus:border-cyan-500"
          >
            <option value="ALL">All Alert Types</option>
            <option value="SELFIE_SUBMITTED">SELFIE_SUBMITTED</option>
            <option value="REVIEW">REVIEW</option>
            <option value="STEP_UP">STEP_UP</option>
            <option value="SOFT_CHECK">SOFT_CHECK</option>
          </select>
        </div>
      </div>

      {/* Alerts Queue List */}
      {filteredAlerts.length === 0 ? (
        <EmptyState
          title="Alert Queue Clear"
          description="There are currently no escalations or selfies awaiting review."
          icon={<ShieldAlert className="w-6 h-6 text-emerald-400" />}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filteredAlerts.map((alert, idx) => (
            <div
              key={`${alert.session_id}-${idx}`}
              className="bg-[#0a0a0a] border border-[#1e2c47] hover:border-slate-700 rounded-xl p-4 transition flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-3.5 min-w-0">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                    alert.alert_type === 'SELFIE_SUBMITTED'
                      ? 'bg-purple-950/80 text-purple-400 border-purple-800'
                      : alert.alert_type === 'REVIEW'
                      ? 'bg-rose-950/80 text-rose-400 border-rose-800'
                      : 'bg-orange-950/80 text-orange-400 border-orange-800'
                  }`}
                >
                  {alert.alert_type === 'SELFIE_SUBMITTED' ? (
                    <Camera className="w-5 h-5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5" />
                  )}
                </div>

                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-bold text-sm text-slate-100">
                      {alert.name}
                    </span>
                    <span className="text-xs font-mono text-slate-400">
                      ({alert.rider_id})
                    </span>
                    <StatusBadge type="alert" value={alert.alert_type} size="sm" />
                    <StatusBadge type="status" value={alert.status} size="sm" />
                  </div>

                  <p className="text-xs font-mono text-slate-300 leading-relaxed">
                    {alert.verdict || alert.reasons[0] || 'Behavioral mismatch crossed threshold'}
                  </p>

                  <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-slate-400 pt-0.5">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-500" />
                      {alert.city || 'Unknown city'}
                    </span>
                    <span>·</span>
                    <span>
                      Triggered {formatRelativeTime(alert.alert_at || alert.received_at)} ({formatDateTime(alert.alert_at || alert.received_at)})
                    </span>
                  </div>
                </div>
              </div>

              {/* Action buttons and score summary */}
              <div className="flex items-center gap-3 self-end md:self-center shrink-0">
                <div className="text-right font-mono hidden sm:block">
                  <div className="text-[10px] text-slate-400 uppercase">Trust / Risk</div>
                  <div className="text-xs font-bold text-slate-200">
                    <span className="text-emerald-400">{alert.trust}</span> /{' '}
                    <span className="text-rose-400">{alert.risk}%</span>
                  </div>
                </div>

                <button
                  onClick={() => handleOpenReview(alert)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium rounded-lg bg-cyan-950/80 text-cyan-300 border border-cyan-800/80 hover:bg-cyan-900/60 transition shadow-sm"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Inspect & Review</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Review Modal Dialog */}
      {activeAlert && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
          onClick={() => setActiveAlert(null)}
        >
          <div
            className="relative w-full max-w-2xl bg-[#0a0a0a] border border-[#1e2c47] rounded-xl p-6 shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setActiveAlert(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 pb-4 border-b border-[#1e2c47] mb-4">
              <div className="w-10 h-10 rounded-lg bg-neutral-800 border border-slate-700 flex items-center justify-center text-cyan-400">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-mono font-bold text-base text-slate-100">
                  Reviewing Session {activeAlert.session_id}
                </h3>
                <span className="text-xs font-mono text-slate-400">
                  Rider: {activeAlert.name} ({activeAlert.rider_id})
                </span>
              </div>
            </div>

            <div className="space-y-4 text-xs font-mono">
              {/* Selfie Frame Display */}
              <div className="p-4 rounded-xl bg-neutral-900/90 border border-slate-800 flex flex-col items-center justify-center">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-2 font-semibold">
                  Submitted Live Selfie Verification Frame
                </div>

                {loadingSelfie ? (
                  <div className="py-12 flex flex-col items-center gap-2 text-slate-400">
                    <span className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                    <span>Retrieving camera frame from server...</span>
                  </div>
                ) : selfieImage ? (
                  <div className="relative rounded-lg overflow-hidden border border-slate-700 max-h-72 shadow-lg">
                    <img
                      src={selfieImage}
                      alt="Rider step-up selfie"
                      className="object-contain max-h-72"
                    />
                    <div className="absolute bottom-2 left-2 bg-black/70 px-2 py-0.5 rounded text-[10px] text-slate-300">
                      Live Camera Frame (0.6 JPEG)
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center text-slate-500 flex flex-col items-center gap-1">
                    <Camera className="w-8 h-8 text-slate-600 mb-1" />
                    <span>{selfieError || 'No selfie was submitted for this alert type.'}</span>
                    <span className="text-[10px] text-slate-600">
                      (Alert triggered on behavioral/contextual threshold crossing)
                    </span>
                  </div>
                )}
              </div>

              {/* Behavioral Anomaly Explanation */}
              <div className="p-3.5 rounded-lg bg-neutral-900/60 border border-slate-800 space-y-2">
                <span className="text-slate-400 uppercase text-[10px] tracking-wider block font-semibold">
                  Decision Reasoning
                </span>
                <div className="text-slate-200 font-semibold">{activeAlert.verdict}</div>
                {activeAlert.reasons && (
                  <ul className="space-y-1 text-slate-300 list-disc pl-4 pt-1">
                    {activeAlert.reasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Signals breakdown */}
              {activeAlert.signals && Object.keys(activeAlert.signals).length > 0 && (
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  {Object.entries(activeAlert.signals).map(([grp, info]) => (
                    <div key={grp} className="p-2.5 rounded bg-neutral-900 border border-slate-800">
                      <div className="flex items-center justify-between font-semibold text-slate-200 capitalize">
                        <span>{grp} Rhythm</span>
                        <span className="text-cyan-400">{info.match}% match</span>
                      </div>
                      {info.top && info.top.length > 0 && (
                        <div className="text-[10px] text-slate-400 mt-1">
                          Max drift: {info.top[0][0]} ({info.top[0][1]}σ)
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Resolution buttons */}
            <div className="flex items-center justify-between pt-5 border-t border-[#1e2c47] mt-5">
              <Link
                to={`/riders/${activeAlert.rider_id}`}
                className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
              >
                Inspect Rider Profile <ExternalLink className="w-3.5 h-3.5" />
              </Link>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setResolveAction('reject')}
                  className="px-4 py-2 text-xs font-mono font-medium rounded-lg bg-rose-950/80 text-rose-300 border border-rose-800 hover:bg-rose-900/80 transition flex items-center gap-1.5"
                >
                  <XCircle className="w-4 h-4 text-rose-400" />
                  <span>Reject & Block</span>
                </button>

                <button
                  type="button"
                  onClick={() => setResolveAction('approve')}
                  className="px-4 py-2 text-xs font-mono font-medium rounded-lg bg-emerald-950/80 text-emerald-300 border border-emerald-800 hover:bg-emerald-900/80 transition flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Approve & Verify</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog for Resolution */}
      <ConfirmDialog
        isOpen={resolveAction !== null}
        title={
          resolveAction === 'approve'
            ? 'Confirm Rider Verification'
            : 'Confirm Account Suspension / Block'
        }
        message={
          resolveAction === 'approve'
            ? `You are confirming that ${activeAlert?.name} is verified. This will update the session status to VERIFIED, ALLOW continuation, and reinforce the rider baseline.`
            : `You are blocking this session for ${activeAlert?.name}. This will set the session status to BLOCKED and mark the account handoff as confirmed.`
        }
        confirmLabel={resolveAction === 'approve' ? 'Confirm Approval' : 'Confirm Block'}
        isDestructive={resolveAction === 'reject'}
        isLoading={isResolving}
        onConfirm={handleResolveConfirm}
        onCancel={() => setResolveAction(null)}
      />
    </div>
  );
};
