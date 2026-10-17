import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BellRing, Camera, ShieldAlert } from 'lucide-react';
import type { Alert } from '../../types/api';
import { StatusBadge } from '../common/StatusBadge';
import { formatRelativeTime } from '../../utils/formatting';

interface RecentAlertsProps {
  alerts: Alert[];
}

export const RecentAlerts: React.FC<RecentAlertsProps> = ({ alerts }) => {
  return (
    <div className="bg-[#0a0a0a] border border-[#1e2c47] rounded-xl p-4 md:p-5 flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BellRing className="w-4 h-4 text-rose-400" />
          <h2 className="text-sm md:text-base font-bold font-mono tracking-wide text-slate-100">
            Escalation Queue
          </h2>
        </div>
        <Link
          to="/alerts"
          className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition"
        >
          Open Queue ({alerts.length}) <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {alerts.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-500 font-mono text-xs">
          <ShieldAlert className="w-8 h-8 text-slate-600 mb-2" />
          <span>Queue clean. No active escalations.</span>
        </div>
      ) : (
        <div className="flex-1 space-y-2.5 overflow-y-auto">
          {alerts.slice(0, 6).map((alert, idx) => (
            <div
              key={`${alert.session_id}-${idx}`}
              className="p-3 rounded-lg bg-neutral-900/60 border border-slate-800 hover:border-slate-700 transition flex flex-col gap-1.5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold text-xs text-slate-200">
                    {alert.name}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    ({alert.rider_id})
                  </span>
                </div>
                <StatusBadge type="alert" value={alert.alert_type} size="sm" />
              </div>

              <p className="text-[11px] text-slate-300 line-clamp-2 font-mono">
                {alert.verdict || (alert.reasons && alert.reasons[0]) || 'Risk threshold crossed'}
              </p>

              <div className="flex items-center justify-between pt-1 text-[10px] font-mono text-slate-400 border-t border-slate-800/80">
                <div className="flex items-center gap-2">
                  <span>Risk: <strong className="text-rose-400">{alert.risk}%</strong></span>
                  {alert.has_selfie && (
                    <span className="text-purple-400 flex items-center gap-1">
                      <Camera className="w-3 h-3" /> Selfie Attached
                    </span>
                  )}
                </div>
                <span>{formatRelativeTime(alert.alert_at || alert.received_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
