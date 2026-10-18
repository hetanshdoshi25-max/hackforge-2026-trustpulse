import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import type { RingsResponse } from '../types/api';
import { useTrustPulseSocket } from '../hooks/useTrustPulseSocket';
import { Rings3D } from '../three/Rings3D';
import { formatRelativeTime } from '../utils/formatting';
import { ErrorBlock, Label, PageHead, Stat } from '../components/ui/kit';

/**
 * Renting is a business: one person often rides several verified accounts.
 * Flagged sessions are compared ACROSS accounts; the same unknown person (or the same
 * phone) showing up on different accounts links them into a ring.
 */
export const RingsPage: React.FC = () => {
  const [data, setData] = useState<RingsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .getRings()
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load rings'));
  }, []);
  useTrustPulseSocket(load);
  useEffect(load, [load]);

  const rings = data?.rings ?? [];
  const inRings = rings.reduce((a, r) => a + r.accounts.length, 0);

  if (error && !data) return <ErrorBlock title="Could not load rings" message={error} onRetry={load} />;

  return (
    <div className="space-y-10">
      <PageHead
        no="08"
        kicker="Cross-account detection"
        title={
          <>
            One renter, <em>many accounts.</em>
          </>
        }
        lede="Flagged sessions are compared across accounts with a PIN-independent signature: key hold, thumb position, finger size, grip, swipe style, plus shared phones. The same stranger on two accounts links them into a ring."
      />

      <div className="grid grid-cols-2 gap-y-8 md:grid-cols-4 md:divide-x md:divide-line">
        <Stat className="md:pr-6" label="Rings found" value={rings.length} color={rings.length ? '#e11d48' : undefined} />
        <Stat className="md:px-6" label="Accounts in rings" value={inRings} color={inRings ? '#e11d48' : undefined} />
        <Stat className="md:px-6" label="Flagged accounts" value={data?.accounts_flagged ?? 0} />
        <Stat className="md:pl-6" label="Stranger sightings" value={data?.sightings ?? 0} />
      </div>

      <div className="grid grid-cols-1 gap-10 xl:grid-cols-[1.5fr_1fr]">
        <section className="relative -mx-5 border-y border-line md:mx-0 md:border">
          {rings.length > 0 ? (
            <Rings3D rings={rings} height={580} />
          ) : (
            <div className="flex h-[580px] flex-col items-center justify-center px-8 text-center">
              <svg width="160" height="90" viewBox="0 0 160 90" className="text-line-2" aria-hidden>
                <circle cx="80" cy="45" r="8" fill="none" stroke="currentColor" />
                {[0, 1, 2, 3].map((i) => {
                  const a = (i / 4) * Math.PI * 2 + 0.4;
                  return (
                    <g key={i}>
                      <line x1={80} y1={45} x2={80 + Math.cos(a) * 60} y2={45 + Math.sin(a) * 34} stroke="currentColor" strokeDasharray="3 4" />
                      <circle cx={80 + Math.cos(a) * 64} cy={45 + Math.sin(a) * 36} r="4" fill="currentColor" />
                    </g>
                  );
                })}
              </svg>
              <div className="mt-6 font-serif text-[30px]">No rings yet</div>
              <p className="mt-2 max-w-sm text-[13px] text-mute">A ring appears once the same unknown person is flagged on two or more accounts.</p>
            </div>
          )}
          {rings.length > 0 && (
            <div className="pointer-events-none absolute bottom-4 left-4 right-4 font-mono text-[10.5px] text-paper-2">
              <span className="text-[#ff6b86]">red core</span> = one unknown person · spoke weight = behaviour match · dashed spoke = same phone
            </div>
          )}
        </section>

        <section className="space-y-8">
          {rings.length === 0 && <div className="border-t border-line pt-5 text-[13px] text-mute">Ring evidence will be listed here.</div>}
          {rings.map((r) => (
            <article key={r.ring_id} className="border-t border-review/70 pt-4">
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-[13px] text-[#ff6b86]">{r.ring_id}</span>
                <span className="font-mono text-[11px] text-dim">
                  {r.sightings} sightings · {formatRelativeTime(r.last_seen)}
                </span>
              </div>
              <p className="mt-2 font-serif text-[24px] leading-tight">
                One person riding <em>{r.accounts.length} verified accounts</em>
                {r.device_evidence && ', on the same phone'}.
              </p>
              <div className="mt-4 border-t border-line">
                {r.members.map((m) => (
                  <Link
                    key={m.rider_id}
                    to={`/riders/${m.rider_id}`}
                    className="flex items-baseline justify-between gap-3 border-b border-line py-2.5 transition-colors hover:bg-ink-2"
                  >
                    <span className="text-[14px] text-paper">
                      {m.name} <span className="font-mono text-[10.5px] text-dim">{m.rider_id}</span>
                    </span>
                    <span className="font-mono text-[11px] text-mute">
                      {m.sightings} flagged · {m.cities.join(', ') || '-'}
                    </span>
                  </Link>
                ))}
              </div>
              <div className="mt-3">
                <Label>Evidence</Label>
                <div className="mt-2 space-y-1 font-mono text-[11.5px] text-paper-2">
                  {r.evidence.map((e) => (
                    <div key={`${e.a}-${e.b}`} className="flex flex-wrap gap-x-3">
                      <span className="text-paper">
                        {e.a} ↔ {e.b}
                      </span>
                      {e.behaviour_match != null && <span>behaviour {e.behaviour_match}% alike</span>}
                      {e.shared_devices.length > 0 && <span className="text-[#ff6b86]">same phone</span>}
                    </div>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
};
