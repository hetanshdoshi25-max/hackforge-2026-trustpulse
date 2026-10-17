import React from 'react';
import type { ActionType, AlertType, SessionStatusType } from '../../types/api';
import { getActionMeta, getAlertMeta, getStatusMeta } from '../../utils/status';

interface StatusBadgeProps {
  type: 'action' | 'status' | 'alert';
  value: ActionType | SessionStatusType | AlertType | string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ type, value, size = 'sm' }) => {
  let label = value;
  let badgeClass = 'bg-neutral-800 text-slate-300 border-slate-700';

  if (type === 'action') {
    const meta = getActionMeta(value as ActionType);
    label = meta.label;
    badgeClass = meta.badgeClass;
  } else if (type === 'status') {
    const meta = getStatusMeta(value as SessionStatusType);
    label = meta.label;
    badgeClass = meta.badgeClass;
  } else if (type === 'alert') {
    const meta = getAlertMeta(value as AlertType);
    label = meta.label;
    badgeClass = meta.badgeClass;
  }

  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm font-medium';

  return (
    <span
      className={`inline-flex items-center rounded-md border font-mono tracking-wider font-semibold uppercase ${sizeClasses} ${badgeClass}`}
    >
      {label}
    </span>
  );
};
