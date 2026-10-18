import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import type { ActionType, Session, SessionStatusType } from '../types/api';
import { useTrustPulseSocket } from '../hooks/useTrustPulseSocket';
import { formatCoords, formatDateTime, formatRelativeTime } from '../utils/formatting';
import { ACTIONS, getActionHex, getActionMeta } from '../utils/status';
import { Fingerprint3D } from '../three/Fingerprint3D';
import { ActionTag, Arrow, Empty, ErrorBlock, KV, Label, Loading, Modal, PageHead, SignalReadout, StatusTag, TrustCell } from '../components/ui/kit';

const STATUSES: (SessionStatusType | 'ALL')[] = ['ALL', 'ACTIVE', 'PENDING_REVIEW', 'VERIFIED', 'BLOCKED'];

export const SessionsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selected, setSelected] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(searchParams.get('rider_id') || '');
  const [actionFilter, setActionFilter] = useState<ActionType | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<SessionStatusType | 'ALL'>('ALL');
  const [sortBy, setSortBy] = useState<'time' | 'risk' | 'trust'>('time');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const fetchSessions = useCallback(async () => {
    try {
      setError(null);
      setSessions(await api.getSessions(100));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch sessions');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useTrustPulseSocket(fetchSessions);
  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const list = sessions.filter(
      (s) =>
        (q === '' ||
          s.name.toLowerCase().includes(q) ||
          s.rider_id.toLowerCase().includes(q) ||
          s.session_id.toLowerCase().includes(q) ||
          (s.city ?? '').toLowerCase().includes(q)) &&
        (actionFilter === 'ALL' || s.action === actionFilter) &&
        (statusFilter === 'ALL' || s.status === statusFilter),
    );
    const val = (s: Session) => (sortBy === 'time' ? s.received_at || s.ts : sortBy === 'risk' ? s.risk : s.trust);
    return list.sort((a, b) => (sortOrder === 'desc' ? val(b) - val(a) : val(a) - val(b)));
  }, [sessions, search, actionFilter, statusFilter, sortBy, sortOrder]);

  const sort = (f: 'time' | 'risk' | 'trust') => {
    if (sortBy === f) setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    else {
      setSortBy(f);
      setSortOrder('desc');
    }
  };

  // decision mix of what is on screen: a one-line stacked bar
  const mix = useMemo(() => {
    const c: Record<string, number> = {};
    for (const s of filtered) c[s.action] = (c[s.action] ?? 0) + 1;
    return ACTIONS.map((a) => [a, c[a] ?? 0] as const).filter(([, n]) => n > 0);
  }, [filtered]);

  if (isLoading) return <Loading message="Loading the session stream" />;
  if (error) return <ErrorBlock title="Could not load sessions" message={error} onRetry={fetchSessions} />;

  const sortBtn = (f: 'time' | 'risk' | 'trust', children: React.ReactNode) => (
    <button onClick={() => sort(f)} className={`label hover:text-paper ${sortBy === f ? '!text-paper' : ''}`}>
      {children} {sortBy === f ? (sortOrder === 'desc' ? '↓' : '↑') : ''}
    </button>
  );

  return (
    <div className="space-y-10">
      <PageHead
        no="06"
        kicker="Session stream"
        title={
          <>
            Every login, <em>every swipe.</em>
          </>
        }
        lede="The last hundred scored sessions. Open one to see its behavioural fingerprint and why the engine decided what it did."
      />

      <div className="space-y-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search rider, session or city"
            className="field w-full !text-[15px] lg:w-80"
          />
          <div className="flex flex-wrap items-end gap-6">
            <label>
              <span className="label">Decision</span>
              <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value as ActionType | 'ALL')} className="field mt-1 block">
                <option value="ALL">All decisions</option>
                {ACTIONS.map((a) => (
                  <option key={a} value={a}>
                    {getActionMeta(a).label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="label">Status</span>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as SessionStatusType | 'ALL')} className="field mt-1 block">
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s === 'ALL' ? 'All statuses' : s.replace('_', ' ').toLowerCase()}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {filtered.length > 0 && (
          <div>
            <div className="flex h-2 w-full overflow-hidden">
              {mix.map(([a, n]) => (
                <span key={a} title={`${getActionMeta(a).label}: ${n}`} style={{ flex: n, background: getActionHex(a) }} />
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-5 font-mono text-[10.5px] text-mute">
              {mix.map(([a, n]) => (
                <span key={a}>
                  <span style={{ color: getActionHex(a) }}>■</span> {getActionMeta(a).label.toLowerCase()} {n}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <Empty title="Nothing matches">Loosen the filters, or log in from the rider app.</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-t border-line">
            <thead className="border-b border-line">
              <tr className="text-left">
                <th className="label py-3 pr-4 font-normal">Session</th>
                <th className="label py-3 pr-4 font-normal">Rider</th>
                <th className="label py-3 pr-4 font-normal">City</th>
                <th className="py-3 pr-4 font-normal">
                  {sortBtn('trust', 'Trust')}
                </th>
                <th className="py-3 pr-4 font-normal">
                  {sortBtn('risk', 'Decision')}
                </th>
                <th className="label py-3 pr-4 font-normal">Status</th>
                <th className="label py-3 pr-4 font-normal">Why</th>
                <th className="py-3 text-right font-normal">
                  {sortBtn('time', 'When')}
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.session_id} onClick={() => setSelected(s)} className="cursor-pointer border-b border-line transition-colors hover:bg-ink-2">
                  <td className="py-3 pr-4 font-mono text-[11.5px] text-paper-2">{s.session_id.slice(0, 8)}</td>
                  <td className="py-3 pr-4">
                    <div className="text-[14px] text-paper">{s.name}</div>
                    <div className="font-mono text-[10.5px] text-dim">{s.rider_id}</div>
                  </td>
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
      )}

      <Modal open={!!selected} onClose={() => setSelected(null)} side="right" width="max-w-xl" label="Session detail">
        {selected && (
          <div className="p-7">
            <Label>Session {selected.session_id}</Label>
            <h3 className="mt-2 font-serif text-[40px] leading-none">{selected.name}</h3>
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <span className="font-mono text-[11px] text-dim">{selected.rider_id}</span>
              <ActionTag action={selected.action} size="md" />
              <StatusTag status={selected.status} size="md" />
            </div>

            <div className="mt-6 flex items-end gap-6 border-y border-line py-5">
              <div>
                <Label>Trust</Label>
                <div className="tnum font-mono text-[72px] font-light leading-[0.85]" style={{ color: getActionHex(selected.action) }}>
                  {selected.trust}
                </div>
              </div>
              <KV
                className="flex-1 !border-y-0"
                rows={[
                  ['Behaviour risk', selected.behaviour_risk ?? '-'],
                  ['Context risk', selected.context_risk],
                  ['Overall risk', selected.risk],
                ]}
              />
            </div>

            <Fingerprint3D signals={selected.signals} action={selected.action} height={280} />

            <p className="mt-2 font-serif text-[21px] leading-snug">{selected.verdict}</p>
            {selected.reasons?.length > 0 && (
              <ul className="mt-3 space-y-1 font-mono text-[11.5px] text-paper-2">
                {selected.reasons.map((r, i) => (
                  <li key={i}>· {r}</li>
                ))}
              </ul>
            )}

            <div className="mt-7">
              <SignalReadout signals={selected.signals} />
            </div>

            <KV
              className="mt-7"
              rows={[
                ['City', selected.city || '-'],
                ['GPS', formatCoords(selected.lat, selected.lon)],
                ['Phone', selected.device_id ?? '-'],
                ['Enrolling', selected.enrolling ? 'yes' : 'no'],
                ['Received', formatDateTime(selected.received_at)],
              ]}
            />

            <div className="mt-7">
              <Arrow to={`/riders/${selected.rider_id}`}>Rider history and time machine</Arrow>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
