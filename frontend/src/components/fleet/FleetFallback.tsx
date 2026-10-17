import React from 'react';
import { MapPin, User, Navigation } from 'lucide-react';
import type { Session } from '../../types/api';
import { StatusBadge } from '../common/StatusBadge';
import { TrustScore } from '../common/TrustScore';
import { RiskIndicator } from '../common/RiskIndicator';
import { formatCoords, formatRelativeTime } from '../../utils/formatting';

interface FleetFallbackProps {
  sessions: Session[];
  selectedSession: Session | null;
  onSelectSession: (session: Session) => void;
}

export const FleetFallback: React.FC<FleetFallbackProps> = ({
  sessions,
  selectedSession,
  onSelectSession,
}) => {
  return (
    <div className="bg-[#0c1322] border border-[#1e2c47] rounded-xl overflow-hidden flex flex-col">
      <div className="p-4 border-b border-[#1e2c47] flex items-center justify-between">
        <h3 className="text-sm font-bold font-mono text-slate-100 flex items-center gap-2">
          <Navigation className="w-4 h-4 text-cyan-400" />
          Fleet Geographic Directory (2D Accessible View)
        </h3>
        <span className="text-xs font-mono text-slate-400">
          {sessions.length} sessions plotted
        </span>
      </div>

      <div className="overflow-x-auto max-h-[600px]">
        <table className="w-full text-left text-xs font-mono">
          <thead className="sticky top-0 bg-[#0e1628] border-b border-[#1e2c47] text-slate-400 uppercase text-[10px] tracking-wider">
            <tr>
              <th className="py-2.5 px-3">Rider</th>
              <th className="py-2.5 px-3">City / GPS Coordinates</th>
              <th className="py-2.5 px-3">Trust</th>
              <th className="py-2.5 px-3">Risk</th>
              <th className="py-2.5 px-3">Action</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3 text-right">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e2c47]/50">
            {sessions.map((session) => {
              const isSelected = selectedSession?.session_id === session.session_id;
              return (
                <tr
                  key={session.session_id}
                  onClick={() => onSelectSession(session)}
                  className={`cursor-pointer transition ${
                    isSelected
                      ? 'bg-cyan-950/50 border-l-2 border-cyan-400'
                      : 'hover:bg-slate-800/40'
                  }`}
                >
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
                        <User className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="font-semibold text-slate-100">{session.name}</div>
                        <div className="text-[10px] text-slate-400">{session.rider_id}</div>
                      </div>
                    </div>
                  </td>

                  <td className="py-3 px-3">
                    <div className="flex flex-col">
                      <span className="text-slate-200 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        {session.city || 'Unknown city'}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {formatCoords(session.lat, session.lon)}
                      </span>
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

                  <td className="py-3 px-3 text-right text-slate-400 whitespace-nowrap">
                    {formatRelativeTime(session.received_at || session.ts)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
