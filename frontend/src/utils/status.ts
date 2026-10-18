import type { ActionType, AlertType, SessionStatusType } from '../types/api';

/**
 * Decision palette, validated with the dataviz validator on the ink surface:
 * CVD-separable, normal-vision dE >= 15, >= 3:1 contrast. Always shown with a word too.
 */
export const ACTION_HEX: Record<string, string> = {
  ENROLLING: '#818cf8',
  ALLOW: '#34d399',
  SOFT_CHECK: '#fde047',
  STEP_UP: '#f97316',
  REVIEW: '#e11d48',
};

const NEUTRAL = '#8a877f';

export const ACTIONS: ActionType[] = ['ENROLLING', 'ALLOW', 'SOFT_CHECK', 'STEP_UP', 'REVIEW'];

const ACTION_COPY: Record<string, { label: string; plain: string }> = {
  ENROLLING: { label: 'Enrolling', plain: 'Learning this rider' },
  ALLOW: { label: 'Allow', plain: 'Same person' },
  SOFT_CHECK: { label: 'Soft check', plain: 'Quick check at next pickup' },
  STEP_UP: { label: 'Step up', plain: 'Selfie required' },
  REVIEW: { label: 'Review', plain: 'Paused for a human' },
};

export function getActionMeta(action: ActionType | string): { label: string; plain: string; hex: string } {
  const c = ACTION_COPY[action];
  return { label: c?.label ?? (action || 'Unknown'), plain: c?.plain ?? '', hex: getActionHex(action) };
}

export function getActionHex(action: string): string {
  return ACTION_HEX[action] ?? NEUTRAL;
}

export function getStatusMeta(status: SessionStatusType | string): { label: string; hex: string } {
  switch (status) {
    case 'ACTIVE':
      return { label: 'Active', hex: '#bdbab2' };
    case 'PENDING_REVIEW':
      return { label: 'Pending review', hex: ACTION_HEX.SOFT_CHECK };
    case 'VERIFIED':
      return { label: 'Verified', hex: ACTION_HEX.ALLOW };
    case 'BLOCKED':
      return { label: 'Blocked', hex: ACTION_HEX.REVIEW };
    default:
      return { label: status || '-', hex: NEUTRAL };
  }
}

export function getAlertMeta(type: AlertType | string): { label: string; hex: string } {
  switch (type) {
    case 'SELFIE_SUBMITTED':
      return { label: 'Selfie in', hex: '#edebe6' };
    case 'REVIEW':
      return { label: 'Review', hex: ACTION_HEX.REVIEW };
    case 'STEP_UP':
      return { label: 'Step up', hex: ACTION_HEX.STEP_UP };
    case 'SOFT_CHECK':
      return { label: 'Soft check', hex: ACTION_HEX.SOFT_CHECK };
    case 'PIN_LOCKOUT':
      return { label: 'PIN lockout', hex: ACTION_HEX.REVIEW };
    default:
      return { label: type || 'Alert', hex: NEUTRAL };
  }
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

/** Behaviour match colour for a 0-100 match percentage. */
export function getMatchColor(match: number | undefined | null): string {
  if (match == null) return NEUTRAL;
  if (match >= 50) return ACTION_HEX.ALLOW;
  if (match >= 25) return ACTION_HEX.SOFT_CHECK;
  return ACTION_HEX.REVIEW;
}
