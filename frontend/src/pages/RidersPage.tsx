import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import type { ActionType, RiderListItem } from '../types/api';
import { useTrustPulseSocket } from '../hooks/useTrustPulseSocket';
import { formatRelativeTime } from '../utils/formatting';
import { ACTIONS, getActionMeta } from '../utils/status';
import { ActionTag, Empty, ErrorBlock, Loading, PageHead, TrustCell } from '../components/ui/kit';

type SortField = 'time' | 'trust' | 'risk' | 'sessions';

export const RidersPage: React.FC = () => {
  const [riders, setRiders] = useState<RiderListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<ActionType | 'ALL'>('ALL');
  const [sortField, setSortField] = useState<SortField>('time');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const navigate = useNavigate();

  const fetchRiders = useCallback(async () => {
    try {
      setError(null);
      setRiders(await api.getRiders());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch riders list');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useTrustPulseSocket(fetchRiders);
  useEffect(() => {
    fetchRiders();
  }, [fetchRiders]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const list = riders.filter(
      (r) =>
        (q === '' || r.name.toLowerCase().includes(q) || r.rider_id.toLowerCase().includes(q) || r.known_cities.some((c) => c.toLowerCase().includes(q))) &&
        (actionFilter === 'ALL' || r.last?.action === actionFilter),
    );
    const val = (r: RiderListItem) =>
      sortField === 'time' ? r.last?.received_at || 0 : sortField === 'trust' ? (r.last?.trust ?? -1) : sortField === 'risk' ? (r.last?.risk ?? -1) : r.sessions;
    return list.sort((a, b) => (sortOrder === 'desc' ? val(b) - val(a) : val(a) - val(b)));
  }, [riders, search, actionFilter, sortField, sortOrder]);

  const toggleSort = (f: SortField) => {
    if (sortField === f) setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    else {
      setSortField(f);
      setSortOrder('desc');
    }
  };

  if (isLoading) return <Loading message="Loading rider profiles" />;
  if (error) return <ErrorBlock title="Could not load riders" message={error} onRetry={fetchRiders} />;

  const head = (children: React.ReactNode, f?: SortField, className = '') => (
    <th key={String(children)} className={`label py-3 pr-4 text-left font-normal ${className}`}>
      {f ? (
        <button onClick={() => toggleSort(f)} className={`uppercase tracking-[0.14em] hover:text-paper ${sortField === f ? 'text-paper' : ''}`}>
          {children} {sortField === f ? (sortOrder === 'desc' ? '↓' : '↑') : ''}
        </button>
      ) : (
        children
      )}
    </th>
  );

  return (
    <div className="space-y-10">
      <PageHead
        no="05"
        kicker="Directory"
        title={
          <>
            Every rider, <em>their own baseline.</em>
          </>
        }
        lede="Nobody is compared with anybody else. Each profile learns one person's rhythm over their first logins and keeps adapting to their new phones and cities."
        right={
          <div className="text-right">
            <div className="label">Profiles</div>
            <div className="tnum font-mono text-[56px] font-light leading-none">{riders.length}</div>
          </div>
        }
      />

      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, ID or city"
          className="field w-full !text-[15px] md:w-80"
        />
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {(['ALL', ...ACTIONS] as const).map((a) => (
            <button
              key={a}
              onClick={() => setActionFilter(a)}
              className={`text-[13px] transition ${actionFilter === a ? 'text-paper underline underline-offset-[6px]' : 'text-mute hover:text-paper'}`}
            >
              {a === 'ALL' ? 'All' : getActionMeta(a).label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Empty title="No riders match">Try a different search or decision.</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] border-t border-line">
            <thead className="border-b border-line">
              <tr>
                {head('Rider')}
                {head('Profile')}
                {head('Sessions', 'sessions')}
                {head('Phones · cities')}
                {head('Last trust', 'trust')}
                {head('Decision', 'risk')}
                {head('Seen', 'time', 'text-right')}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.rider_id}
                  onClick={() => navigate(`/riders/${r.rider_id}`)}
                  className="cursor-pointer border-b border-line transition-colors hover:bg-ink-2"
                >
                  <td className="py-3.5 pr-4">
                    <div className="text-[14.5px] text-paper">{r.name}</div>
                    <div className="font-mono text-[10.5px] text-dim">{r.rider_id}</div>
                  </td>
                  <td className="py-3.5 pr-4">
                    {r.enrolled ? (
                      <span className="font-mono text-[11px] text-paper-2">enrolled</span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <span className="flex gap-0.5">
                          {Array.from({ length: 8 }).map((_, i) => (
                            <span key={i} className="h-2.5 w-1" style={{ background: i < r.enroll_progress ? '#818cf8' : 'var(--color-line)' }} />
                          ))}
                        </span>
                        <span className="font-mono text-[11px] text-enroll">{r.enroll_progress}/8</span>
                      </span>
                    )}
                    {r.shared_enrollment && <div className="mt-1 font-mono text-[10px] text-soft">shared since day one</div>}
                  </td>
                  <td className="tnum py-3.5 pr-4 font-mono text-[13px] text-paper">{r.sessions}</td>
                  <td className="py-3.5 pr-4">
                    <div className="font-mono text-[12px] text-paper-2">{r.known_devices} phone{r.known_devices === 1 ? '' : 's'}</div>
                    <div className="max-w-[16rem] truncate text-[12px] text-mute">{r.known_cities.join(', ') || '-'}</div>
                  </td>
                  <td className="py-3.5 pr-4">{r.last ? <TrustCell trust={r.last.trust} action={r.last.action} /> : <span className="text-dim">-</span>}</td>
                  <td className="py-3.5 pr-4">{r.last ? <ActionTag action={r.last.action} /> : <span className="text-dim">-</span>}</td>
                  <td className="py-3.5 text-right font-mono text-[11px] text-dim">{r.last ? formatRelativeTime(r.last.received_at) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
