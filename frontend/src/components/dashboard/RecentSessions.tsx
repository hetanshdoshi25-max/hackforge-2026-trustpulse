import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, MapPin, User } from 'lucide-react';
import type { Session } from '../../types/api';
import { StatusBadge } from '../common/StatusBadge';
import { TrustScore } from '../common/TrustScore';
import { RiskIndicator } from '../common/RiskIndicator';
import { formatRelativeTime } from '../../utils/formatting';

interface RecentSessionsProps {
  sessions: Session[];
  onSelectSession?: (session: Session) => void;
}

export const RecentSessions: React.FC<RecentSessionsProps> = ({
  sessions,
  onSelectSession,
}) => {
  return (
    <div className="bg-[#0a0a0a] border border-[#1e2c47] rounded-xl p-4 md:p-5 flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm md:text-base font-bold font-mono tracking-wide text-slate-100">
            Live Session Activity
          </h2>
          <p className="text-xs text-slate-400 font-mono">
            Latest continuous behavioral verifications
          </p>
        </div>
        <Link
          to="/sessions"
          className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition"
        >
          View all sessions <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="flex-1 overflow-x-auto">
        <table className="w-full text-left text-xs font-mono">
          <thead>
            <tr className="border-b border-[#1e2c47] text-slate-400 uppercase text-[10px] tracking-wider">
              <th className="py-2.5 px-3">Rider</th>
              <th className="py-2.5 px-3">Location</th>
              <th className="py-2.5 px-3">Trust</th>
              <th className="py-2.5 px-3">Risk</th>
              <th className="py-2.5 px-3">Decision</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3 text-right">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e2c47]/60">
            {sessions.slice(0, 8).map((session) => (
              <tr
                key={session.session_id}
                onClick={() => onSelectSession?.(session)}
                className="hover:bg-neutral-800/40 transition cursor-pointer group"
              >
                <td className="py-3 px-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-md bg-neutral-800 border border-slate-700 flex items-center justify-center text-slate-300 font-bold">
                      <User className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <Link
                        to={`/riders/${session.rider_id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-semibold text-slate-200 hover:text-cyan-400 transition truncate block"
                      >
                        {session.name}
                      </Link>
                      <span className="text-[10px] text-slate-400 truncate block">
                        {session.rider_id}
                      </span>
                    </div>
                  </div>
                </td>

                <td className="py-3 px-3">
                  <div className="flex items-center gap-1 text-slate-300">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    <span>{session.city || 'Unknown'}</span>
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
