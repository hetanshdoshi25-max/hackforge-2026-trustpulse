import type { ActionType, AlertType, SessionStatusType } from '../types/api';

export function getActionMeta(action: ActionType | string): {
  label: string;
  badgeClass: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
} {
  switch (action) {
    case 'ALLOW':
      return {
        label: 'ALLOW',
        badgeClass: 'bg-emerald-950/60 text-emerald-400 border-emerald-800/80',
        textColor: 'text-emerald-400',
        bgColor: 'bg-emerald-950/60',
        borderColor: 'border-emerald-800',
      };
    case 'SOFT_CHECK':
      return {
        label: 'SOFT CHECK',
        badgeClass: 'bg-amber-950/60 text-amber-400 border-amber-800/80',
        textColor: 'text-amber-400',
        bgColor: 'bg-amber-950/60',
        borderColor: 'border-amber-800',
      };
    case 'STEP_UP':
      return {
        label: 'STEP UP',
        badgeClass: 'bg-orange-950/60 text-orange-400 border-orange-800/80',
        textColor: 'text-orange-400',
        bgColor: 'bg-orange-950/60',
        borderColor: 'border-orange-800',
      };
    case 'REVIEW':
      return {
        label: 'REVIEW',
        badgeClass: 'bg-rose-950/60 text-rose-400 border-rose-800/80',
        textColor: 'text-rose-400',
        bgColor: 'bg-rose-950/60',
        borderColor: 'border-rose-800',
      };
    case 'ENROLLING':
      return {
        label: 'ENROLLING',
        badgeClass: 'bg-blue-950/60 text-blue-400 border-blue-800/80',
        textColor: 'text-blue-400',
        bgColor: 'bg-blue-950/60',
        borderColor: 'border-blue-800',
      };
    default:
      return {
        label: action || 'UNKNOWN',
        badgeClass: 'bg-slate-900 text-slate-400 border-slate-700',
        textColor: 'text-slate-400',
        bgColor: 'bg-slate-900',
        borderColor: 'border-slate-700',
      };
  }
}

export function getStatusMeta(status: SessionStatusType | string): {
  label: string;
  badgeClass: string;
} {
  switch (status) {
    case 'ACTIVE':
      return { label: 'Active', badgeClass: 'bg-sky-950/60 text-sky-400 border-sky-800/80' };
    case 'PENDING_REVIEW':
      return { label: 'Pending Review', badgeClass: 'bg-amber-950/60 text-amber-300 border-amber-700/80' };
    case 'VERIFIED':
      return { label: 'Verified', badgeClass: 'bg-emerald-950/60 text-emerald-400 border-emerald-800/80' };
    case 'BLOCKED':
      return { label: 'Blocked', badgeClass: 'bg-rose-950/60 text-rose-400 border-rose-800/80' };
    default:
      return { label: status || '—', badgeClass: 'bg-slate-900 text-slate-400 border-slate-700' };
  }
}

export function getAlertMeta(type: AlertType | string): {
  label: string;
  badgeClass: string;
} {
  switch (type) {
    case 'SELFIE_SUBMITTED':
      return { label: 'Selfie Submitted', badgeClass: 'bg-purple-950/60 text-purple-300 border-purple-700/80' };
    case 'REVIEW':
      return { label: 'Review Flag', badgeClass: 'bg-rose-950/60 text-rose-300 border-rose-700/80' };
    case 'STEP_UP':
      return { label: 'Step Up Required', badgeClass: 'bg-orange-950/60 text-orange-300 border-orange-700/80' };
    case 'SOFT_CHECK':
      return { label: 'Soft Check', badgeClass: 'bg-amber-950/60 text-amber-300 border-amber-700/80' };
    default:
      return { label: type || 'Alert', badgeClass: 'bg-slate-900 text-slate-400 border-slate-700' };
  }
}

export function getTrustColor(trust: number): string {
  if (trust >= 75) return '#10b981'; // Emerald
  if (trust >= 50) return '#f59e0b'; // Amber
  if (trust >= 25) return '#f97316'; // Orange
  return '#ef4444'; // Red
}

export function getRiskColor(risk: number): string {
  if (risk >= 75) return '#ef4444'; // Red
  if (risk >= 50) return '#f97316'; // Orange
  if (risk >= 25) return '#f59e0b'; // Amber
  return '#10b981'; // Emerald
}
