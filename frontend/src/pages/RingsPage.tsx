import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Network, Smartphone, UserX } from 'lucide-react';
import { api } from '../services/api';
import type { RingsResponse } from '../types/api';
import { useTrustPulseSocket } from '../hooks/useTrustPulseSocket';
import { Rings3D } from '../three/Rings3D';
import { formatRelativeTime } from '../utils/formatting';

/**
 * Renting is a business: one person often rides several verified accounts.
 * Flagged sessions are compared ACROSS accounts; the same unknown person (or the same
 * phone) showing up on different accounts links them into a ring.
 */
export const RingsPage: React.FC = () => {
  const [data, setData] = useState<RingsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api.getRings().then(setData).catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load rings'));
  }, []);
  useTrustPulseSocket(load);
  useEffect(load, [load]);

  const rings = data?.rings ?? [];
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-xl border border-rose-900/50 bg-rose-950/10 p-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-lg border border-rose-800/60 bg-rose-950/50 p-2 text-rose-300">
            <Network className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Rental rings</h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-400">
              The same unknown person showing up on several verified accounts. Flagged sessions are compared
              across accounts with a PIN-independent behaviour signature (key hold, thumb position, finger size,
              grip, swipe style) and by shared phones.
            </p>
          </div>
        </div>
        <div className="flex gap-6 text-center">
          <Stat label="Rings" value={rings.length} hot={rings.length > 0} />
          <Stat label="Accounts in rings" value={rings.reduce((a, r) => a + r.accounts.length, 0)} hot={rings.length > 0} />
          <Stat label="Flagged accounts" value={data?.accounts_flagged ?? 0} />
          <Stat label="Sightings" value={data?.sightings ?? 0} />
        </div>
      </div>

      {error && <div className="rounded-lg border border-rose-800 bg-rose-950/40 p-3 text-sm text-rose-300">{error}</div>}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="relative overflow-hidden rounded-xl border border-slate-800">
          {rings.length > 0 ? (
            <Rings3D rings={rings} height={560} />
          ) : (
            <div className="flex h-[560px] flex-col items-center justify-center gap-3 bg-black text-center">
              <UserX className="h-10 w-10 text-slate-600" />
              <p className="text-slate-300">No rental rings detected yet</p>
              <p className="max-w-sm text-sm text-slate-500">
                A ring appears once the same unknown person is flagged on two or more accounts.
              </p>
            </div>
          )}
          {rings.length > 0 && (
            <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg border border-slate-800 bg-black/80 px-3 py-2 text-[11px] text-slate-300">
              <span className="font-semibold text-rose-300">Red core</span> = one unknown person · spoke strength = behaviour match ·
              dashed spoke = same phone
            </div>
          )}
        </div>

        <div className="space-y-4">
          {rings.map((r) => (
            <div key={r.ring_id} className="space-y-3 rounded-xl border border-rose-900/60 bg-[#0a0a0a] p-4">
              <div className="flex items-center justify-between">
                <div className="font-mono text-sm font-bold text-rose-300">{r.ring_id}</div>
                <div className="text-xs text-slate-500">
                  {r.sightings} sightings · last {formatRelativeTime(r.last_seen)}
                </div>
              </div>
              <div className="text-sm text-slate-300">
                One person riding <strong className="text-slate-100">{r.accounts.length} verified accounts</strong>
                {r.device_evidence && ', on the same phone'}.
              </div>
              <ul className="space-y-1.5">
                {r.members.map((m) => (
                  <li key={m.rider_id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-neutral-900/50 px-3 py-2 text-sm">
                    <Link to={`/riders/${m.rider_id}`} className="text-slate-100 hover:text-cyan-300">
                      {m.name} <span className="text-xs text-slate-500">{m.rider_id}</span>
                    </Link>
                    <span className="text-xs text-slate-400">
                      {m.sightings} flagged · {m.cities.join(', ') || '-'}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="space-y-1 border-t border-slate-800 pt-2 text-xs text-slate-400">
                {r.evidence.map((e) => (
                  <div key={`${e.a}-${e.b}`} className="flex flex-wrap items-center gap-x-2">
                    <span className="text-slate-300">{e.a} ↔ {e.b}</span>
                    {e.behaviour_match != null && <span>behaviour {e.behaviour_match}% alike</span>}
                    {e.shared_devices.length > 0 && (
                      <span className="flex items-center gap-1 text-rose-300">
                        <Smartphone className="h-3 w-3" /> same phone
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: number; hot?: boolean }> = ({ label, value, hot }) => (
  <div>
    <div className={`font-mono text-2xl font-bold ${hot ? 'text-rose-300' : 'text-slate-100'}`}>{value}</div>
    <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
  </div>
);
