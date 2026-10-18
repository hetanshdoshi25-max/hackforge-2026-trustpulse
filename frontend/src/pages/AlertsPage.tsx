import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import type { Alert, AlertType } from '../types/api';
import { useTrustPulseSocket } from '../hooks/useTrustPulseSocket';
import { formatDateTime, formatRelativeTime } from '../utils/formatting';
import { getAlertMeta } from '../utils/status';
import { Fingerprint3D } from '../three/Fingerprint3D';
import { ActionTag, AlertTag, Btn, Confirm, Empty, ErrorBlock, KV, Label, Loading, Modal, PageHead, SignalReadout, StatusTag } from '../components/ui/kit';

const FILTERS: (AlertType | 'ALL')[] = ['ALL', 'SELFIE_SUBMITTED', 'REVIEW', 'STEP_UP', 'SOFT_CHECK', 'PIN_LOCKOUT'];

export const AlertsPage: React.FC = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<AlertType | 'ALL'>('ALL');

  // review modal
  const [activeAlert, setActiveAlert] = useState<Alert | null>(null);
  const [selfieImage, setSelfieImage] = useState<string | null>(null);
  const [loadingSelfie, setLoadingSelfie] = useState(false);
  const [selfieError, setSelfieError] = useState<string | null>(null);

  // resolution
  const [resolveAction, setResolveAction] = useState<'approve' | 'reject' | null>(null);
  const [isResolving, setIsResolving] = useState(false);

  const fetchAlerts = useCallback(async () => {
    try {
      setError(null);
      setAlerts(await api.getAlerts(50));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch alerts');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useTrustPulseSocket(fetchAlerts);
  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const handleOpenReview = async (alert: Alert) => {
    setActiveAlert(alert);
    setSelfieImage(null);
    setSelfieError(null);
    if (alert.has_selfie || alert.alert_type === 'SELFIE_SUBMITTED') {
      setLoadingSelfie(true);
      try {
        setSelfieImage((await api.getSessionSelfie(alert.session_id)).image);
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
      window.alert(err instanceof Error ? err.message : 'Resolution failed');
    } finally {
      setIsResolving(false);
    }
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: alerts.length };
    for (const a of alerts) c[a.alert_type] = (c[a.alert_type] ?? 0) + 1;
    return c;
  }, [alerts]);
  const filtered = useMemo(() => (typeFilter === 'ALL' ? alerts : alerts.filter((a) => a.alert_type === typeFilter)), [alerts, typeFilter]);

  if (isLoading) return <Loading message="Loading the review queue" />;
  if (error) return <ErrorBlock title="Could not load alerts" message={error} onRetry={fetchAlerts} />;

  return (
    <div className="space-y-10">
      <PageHead
        no="07"
        kicker="Human in the loop"
        title={
          <>
            Who needs <em>a person.</em>
          </>
        }
        lede="The engine never blocks on its own. Step-ups ask for a selfie; reviews pause the session until someone here decides."
        right={
          <div className="text-right">
            <Label>Open items</Label>
            <div className="tnum font-mono text-[56px] font-light leading-none" style={{ color: alerts.length ? '#e11d48' : undefined }}>
              {alerts.length}
            </div>
          </div>
        }
      />

      <div className="flex flex-wrap gap-x-6 gap-y-2 border-b border-line pb-3">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setTypeFilter(f)}
            className={`relative pb-1 text-[13px] transition ${typeFilter === f ? 'text-paper' : 'text-mute hover:text-paper'}`}
          >
            {f === 'ALL' ? 'Everything' : getAlertMeta(f).label}
            <span className="ml-1.5 font-mono text-[10.5px] text-dim">{counts[f] ?? 0}</span>
            {typeFilter === f && <span className="absolute inset-x-0 -bottom-[13px] h-px bg-paper" />}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Empty title="Queue clear">No escalations or selfies are waiting for a decision.</Empty>
      ) : (
        <div className="border-t border-line">
          {filtered.map((a, idx) => (
            <article
              key={`${a.session_id}-${idx}`}
              className="group relative grid grid-cols-1 gap-4 border-b border-line py-5 pl-5 md:grid-cols-[1fr_auto] md:items-center"
            >
              <span className="absolute inset-y-5 left-0 w-[2px]" style={{ background: getAlertMeta(a.alert_type).hex }} />
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <span className="font-serif text-[26px] leading-none text-paper">{a.name}</span>
                  <span className="font-mono text-[11px] text-dim">{a.rider_id}</span>
                  <AlertTag type={a.alert_type} />
                  <StatusTag status={a.status} />
                </div>
                <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-paper-2">
                  {a.verdict || a.reasons[0] || 'Behavioural mismatch crossed the threshold'}
                </p>
                <div className="mt-2 flex flex-wrap gap-x-5 font-mono text-[11px] text-dim">
                  <span>{a.city || 'unknown city'}</span>
                  <span>
                    {formatRelativeTime(a.alert_at || a.received_at)} · {formatDateTime(a.alert_at || a.received_at)}
                  </span>
                  {a.has_selfie && <span className="text-paper-2">selfie attached</span>}
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <Label>Trust · risk</Label>
                  <div className="tnum mt-1 font-mono text-[18px]">
                    {a.trust} <span className="text-dim">·</span> <span className="text-[#ff6b86]">{a.risk}</span>
                  </div>
                </div>
                <Btn variant={a.alert_type === 'SELFIE_SUBMITTED' ? 'solid' : 'line'} onClick={() => handleOpenReview(a)}>
                  Inspect
                </Btn>
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal open={!!activeAlert} onClose={() => setActiveAlert(null)} width="max-w-5xl" label="Review session">
        {activeAlert && (
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1.1fr]">
            <div className="relative flex min-h-[340px] items-center justify-center border-b border-line bg-ink md:border-b-0 md:border-r">
              {loadingSelfie ? (
                <Loading message="Fetching the selfie" />
              ) : selfieImage ? (
                <img src={selfieImage} alt="Rider step-up selfie" className="max-h-[70vh] w-full object-contain" />
              ) : (
                <div className="w-full">
                  <Fingerprint3D signals={activeAlert.signals} action={activeAlert.action} height={420} distance={4.2} />
                  <p className="pb-5 text-center font-mono text-[11px] text-dim">{selfieError || 'No selfie yet: the behaviour is the evidence.'}</p>
                </div>
              )}
              <span className="label absolute left-4 top-4">{selfieImage ? 'Live selfie frame' : 'Behavioural fingerprint'}</span>
            </div>

            <div className="flex flex-col p-7">
              <Label>Reviewing session {activeAlert.session_id.slice(0, 8)}</Label>
              <h3 className="mt-2 pr-8 font-serif text-[40px] leading-none">{activeAlert.name}</h3>
              <div className="mt-2 flex flex-wrap items-center gap-4">
                <span className="font-mono text-[11px] text-dim">{activeAlert.rider_id}</span>
                <ActionTag action={activeAlert.action} />
                <StatusTag status={activeAlert.status} />
              </div>

              <p className="mt-5 font-serif text-[21px] leading-snug text-paper">{activeAlert.verdict}</p>
              {activeAlert.reasons?.length > 0 && (
                <ul className="mt-3 space-y-1 font-mono text-[11.5px] text-paper-2">
                  {activeAlert.reasons.map((r, i) => (
                    <li key={i}>· {r}</li>
                  ))}
                </ul>
              )}

              <div className="mt-6">
                <SignalReadout signals={activeAlert.signals} />
              </div>

              <KV
                className="mt-6"
                rows={[
                  ['Trust / risk', `${activeAlert.trust} / ${activeAlert.risk}`],
                  ['Behaviour risk', activeAlert.behaviour_risk ?? '-'],
                  ['Context risk', activeAlert.context_risk],
                  ['City', activeAlert.city ?? '-'],
                ]}
              />

              <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
                <Link to={`/riders/${activeAlert.rider_id}`} className="text-[13px] text-paper-2 underline underline-offset-4 hover:text-paper">
                  Rider history →
                </Link>
                <div className="flex gap-2">
                  <Btn variant="danger" onClick={() => setResolveAction('reject')}>
                    Reject and block
                  </Btn>
                  <Btn variant="go" onClick={() => setResolveAction('approve')}>
                    Approve, it's them
                  </Btn>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Confirm
        open={resolveAction !== null}
        title={resolveAction === 'approve' ? `Confirm it's ${activeAlert?.name ?? 'them'}?` : 'Block this session?'}
        message={
          resolveAction === 'approve'
            ? `The session becomes VERIFIED, ${activeAlert?.name} carries on riding, and the engine learns from it.`
            : `The session becomes BLOCKED and the handoff on ${activeAlert?.name}'s account is recorded as confirmed.`
        }
        confirmLabel={resolveAction === 'approve' ? 'Approve' : 'Block'}
        destructive={resolveAction === 'reject'}
        busy={isResolving}
        onConfirm={handleResolveConfirm}
        onCancel={() => setResolveAction(null)}
      />
    </div>
  );
};
