import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import type { ActionType, Session } from '../types/api';
import { Constellation3D, ConstellationLegend } from '../three/Constellation3D';
import { useTrustPulseSocket } from '../hooks/useTrustPulseSocket';
import { formatCoords, formatRelativeTime } from '../utils/formatting';
import { ACTIONS, getActionHex, getActionMeta } from '../utils/status';
import { ActionTag, Arrow, ErrorBlock, KV, Label, Loading, PageHead, SignalReadout, StatusTag, TrustCell } from '../components/ui/kit';

export const FleetPage: React.FC = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selected, setSelected] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [action, setAction] = useState<ActionType | 'ALL'>('ALL');
  const [minRisk, setMinRisk] = useState(0);
  const [view, setView] = useState<'3d' | 'list'>('3d');

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
    return sessions.filter(
      (s) =>
        (q === '' || s.name.toLowerCase().includes(q) || s.rider_id.toLowerCase().includes(q) || (s.city ?? '').toLowerCase().includes(q)) &&
        (action === 'ALL' || s.action === action) &&
        s.risk >= minRisk,
    );
  }, [sessions, search, action, minRisk]);

  // latest per rider, for the list view
  const latest = useMemo(() => {
    const m = new Map<string, Session>();
    for (const s of filtered) if (!m.has(s.rider_id) || s.received_at > m.get(s.rider_id)!.received_at) m.set(s.rider_id, s);
    return [...m.values()].sort((a, b) => b.risk - a.risk);
  }, [filtered]);

  if (isLoading) return <Loading message="Placing riders on the map" />;
  if (error) return <ErrorBlock title="Fleet map unavailable" message={error} onRetry={fetchSessions} />;

  return (
    <div className="space-y-8">
      <PageHead
        no="04"
        kicker="Fleet map"
        title={
          <>
            Cities as <em>constellations.</em>
          </>
        }
        lede="Riders orbit their city by real latitude and longitude. A pillar's height is risk, its colour the decision. A red ring means someone just escalated; a dashed arc means a login from a new city."
      />

      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-wrap items-end gap-6">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rider, ID or city" className="field w-60 !text-[14px]" />
          <label>
            <span className="label">Decision</span>
            <select value={action} onChange={(e) => setAction(e.target.value as ActionType | 'ALL')} className="field mt-1 block">
              <option value="ALL">All</option>
              {ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {getActionMeta(a).label}
                </option>
              ))}
            </select>
          </label>
          <label className="w-48">
            <span className="label">Risk at least {minRisk}</span>
            <input type="range" min={0} max={100} step={5} value={minRisk} onChange={(e) => setMinRisk(Number(e.target.value))} className="hair mt-1" />
          </label>
        </div>
        <div className="flex gap-5">
          {(['3d', 'list'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`text-[13px] ${view === v ? 'text-paper underline underline-offset-[6px]' : 'text-mute hover:text-paper'}`}
            >
              {v === '3d' ? 'Constellation' : 'List'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[1fr_22rem]">
        <section className="relative border border-line">
          {view === '3d' ? (
            <>
              <Constellation3D sessions={filtered} selectedSessionId={selected?.session_id ?? null} onSelectSession={setSelected} height={620} />
              <ConstellationLegend className="pointer-events-none absolute bottom-4 left-4 right-4" />
            </>
          ) : (
            <div className="max-h-[620px] overflow-y-auto">
              {latest.map((s) => (
                <button
                  key={s.rider_id}
                  onClick={() => setSelected(s)}
                  className={`grid w-full grid-cols-[1fr_7rem_6.5rem] items-center gap-4 border-b border-line px-4 py-3 text-left transition-colors hover:bg-ink-2 ${
                    selected?.rider_id === s.rider_id ? 'bg-ink-2' : ''
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] text-paper">{s.name}</span>
                    <span className="block font-mono text-[10.5px] text-dim">
                      {s.rider_id} · {s.city ?? '-'}
                    </span>
                  </span>
                  <TrustCell trust={s.trust} action={s.action} />
                  <span className="justify-self-end">
                    <ActionTag action={s.action} />
                  </span>
                </button>
              ))}
              {latest.length === 0 && <div className="p-8 text-center text-[13px] text-mute">No riders match the filters.</div>}
            </div>
          )}
        </section>

        <aside>
          {selected ? (
            <div className="animate-rise">
              <div className="flex items-start justify-between">
                <Label>{selected.rider_id}</Label>
                <button onClick={() => setSelected(null)} className="font-mono text-[11px] text-mute hover:text-paper">
                  close ×
                </button>
              </div>
              <div className="mt-2 font-serif text-[36px] leading-none">{selected.name}</div>
              <div className="mt-4 flex items-end gap-4 border-y border-line py-4">
                <span className="tnum font-mono text-[60px] font-light leading-[0.8]" style={{ color: getActionHex(selected.action) }}>
                  {selected.trust}
                </span>
                <span className="space-y-1 pb-1">
                  <ActionTag action={selected.action} size="md" />
                  <div>
                    <StatusTag status={selected.status} />
                  </div>
                </span>
              </div>
              <p className="mt-4 font-serif text-[19px] leading-snug">{selected.verdict}</p>
              <div className="mt-5">
                <SignalReadout signals={selected.signals} />
              </div>
              <KV
                className="mt-5"
                rows={[
                  ['City', selected.city ?? '-'],
                  ['GPS', formatCoords(selected.lat, selected.lon)],
                  ['Context risk', selected.context_risk],
                  ['Seen', formatRelativeTime(selected.received_at || selected.ts)],
                ]}
              />
              <div className="mt-5">
                <Arrow to={`/riders/${selected.rider_id}`}>Full rider history</Arrow>
              </div>
            </div>
          ) : (
            <div className="border-t border-line pt-5">
              <Label>Selection</Label>
              <p className="mt-3 font-serif text-[24px] leading-snug text-paper-2">Click a pillar to read that rider's latest login.</p>
              <div className="mt-6 space-y-2 font-mono text-[11.5px] text-mute">
                <div>{filtered.length} sessions in view</div>
                <div>{new Set(filtered.map((s) => s.rider_id)).size} riders</div>
                <div>{new Set(filtered.map((s) => s.city).filter(Boolean)).size} cities</div>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};
