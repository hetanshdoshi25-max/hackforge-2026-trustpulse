import React from 'react';
import { Users, UserCheck, ShieldAlert, Sliders, AlertTriangle, Radio } from 'lucide-react';
import type { RiderListItem, Session, Alert } from '../../types/api';

interface MetricsGridProps {
  riders: RiderListItem[];
  sessions: Session[];
  alerts: Alert[];
  threshold: number | null;
}

export const MetricsGrid: React.FC<MetricsGridProps> = ({
  riders,
  sessions,
  alerts,
  threshold,
}) => {
  const totalRiders = riders.length;
  const enrolledRiders = riders.filter((r) => r.enrolled).length;
  const enrollingRiders = riders.filter((r) => !r.enrolled).length;

  const activeSessions = sessions.filter((s) => s.status === 'ACTIVE').length;
  const pendingReviews = alerts.filter(
    (a) => a.alert_type === 'SELFIE_SUBMITTED' || a.alert_type === 'REVIEW'
  ).length;
  const stepUpVerifications = sessions.filter((s) => s.action === 'STEP_UP').length;

  const kpis = [
    {
      label: 'Enrolled Riders',
      value: enrolledRiders,
      subtext: `${totalRiders} total profiles`,
      icon: UserCheck,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-950/40',
      borderColor: 'border-emerald-800/60',
    },
    {
      label: 'Active Sessions',
      value: activeSessions,
      subtext: `${sessions.length} total monitored`,
      icon: Radio,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-950/40',
      borderColor: 'border-cyan-800/60',
    },
    {
      label: 'Enrolling Profiles',
      value: enrollingRiders,
      subtext: 'Building initial baseline',
      icon: Users,
      color: 'text-blue-400',
      bgColor: 'bg-blue-950/40',
      borderColor: 'border-blue-800/60',
    },
    {
      label: 'Pending Reviews',
      value: pendingReviews,
      subtext: 'Selfies awaiting resolution',
      icon: ShieldAlert,
      color: pendingReviews > 0 ? 'text-rose-400' : 'text-slate-400',
      bgColor: pendingReviews > 0 ? 'bg-rose-950/40' : 'bg-slate-900/60',
      borderColor: pendingReviews > 0 ? 'border-rose-800/60' : 'border-slate-800',
    },
    {
      label: 'Step-up Escalations',
      value: stepUpVerifications,
      subtext: 'Camera verification triggered',
      icon: AlertTriangle,
      color: 'text-orange-400',
      bgColor: 'bg-orange-950/40',
      borderColor: 'border-orange-800/60',
    },
    {
      label: 'Strictness Threshold',
      value: threshold !== null ? threshold : '—',
      subtext: threshold !== null && threshold <= 40 ? 'High strictness' : 'Balanced gate',
      icon: Sliders,
      color: 'text-violet-400',
      bgColor: 'bg-violet-950/40',
      borderColor: 'border-violet-800/60',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
      {kpis.map((kpi, index) => {
        const Icon = kpi.icon;
        return (
          <div
            key={index}
            className={`p-3.5 rounded-xl border ${kpi.borderColor} ${kpi.bgColor} bg-slate-900/50 flex flex-col justify-between transition-all hover:border-slate-600`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-mono tracking-wider uppercase text-slate-400">
                {kpi.label}
              </span>
              <Icon className={`w-4 h-4 ${kpi.color}`} />
            </div>
            <div>
              <div className="text-2xl font-bold font-mono text-slate-100">{kpi.value}</div>
              <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">{kpi.subtext}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
