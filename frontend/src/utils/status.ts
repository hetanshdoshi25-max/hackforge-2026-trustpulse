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
        badgeClass: 'bg-yellow-950/60 text-yellow-300 border-yellow-700/80',
        textColor: 'text-yellow-300',
        bgColor: 'bg-yellow-950/60',
        borderColor: 'border-yellow-700',
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
        badgeClass: 'bg-rose-950/60 text-rose-400 border-rose-700/80',
        textColor: 'text-rose-400',
        bgColor: 'bg-rose-950/60',
        borderColor: 'border-rose-800',
      };
    case 'ENROLLING':
      return {
        label: 'ENROLLING',
        badgeClass: 'bg-indigo-950/60 text-indigo-300 border-indigo-700/80',
        textColor: 'text-indigo-300',
        bgColor: 'bg-indigo-950/60',
        borderColor: 'border-indigo-700',
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
      return { label: 'Pending Review', badgeClass: 'bg-yellow-950/60 text-yellow-300 border-yellow-700/80' };
    case 'VERIFIED':
      return { label: 'Verified', badgeClass: 'bg-emerald-950/60 text-emerald-400 border-emerald-800/80' };
    case 'BLOCKED':
      return { label: 'Blocked', badgeClass: 'bg-rose-950/60 text-rose-400 border-rose-700/80' };
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
      return { label: 'Soft Check', badgeClass: 'bg-yellow-950/60 text-yellow-300 border-yellow-700/80' };
    case 'PIN_LOCKOUT':
      return { label: 'PIN Lockout', badgeClass: 'bg-rose-950/60 text-rose-300 border-rose-700/80' };
    default:
      return { label: type || 'Alert', badgeClass: 'bg-slate-900 text-slate-400 border-slate-700' };
  }
}

/**
 * Status palette, validated with the dataviz validator on the dark surface (#070b14):
 * CVD-separable, normal-vision dE >= 15, >= 3:1 contrast. Always shown with a label/icon.
 */
export const ACTION_HEX: Record<string, string> = {
  ENROLLING: '#818cf8',
  ALLOW: '#34d399',
  SOFT_CHECK: '#fde047',
  STEP_UP: '#f97316',
  REVIEW: '#e11d48',
};

export function getActionHex(action: string): string {
  return ACTION_HEX[action] ?? '#94a3b8';
}

export function getTrustColor(trust: number): string {
  if (trust >= 75) return ACTION_HEX.ALLOW;
  if (trust >= 50) return ACTION_HEX.SOFT_CHECK;
  if (trust >= 25) return ACTION_HEX.STEP_UP;
  return ACTION_HEX.REVIEW;
}

export function getRiskColor(risk: number): string {
  return getTrustColor(100 - risk);
}
