import React from 'react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'No records found',
  description = 'There is currently no telemetry or records matching your query.',
  icon,
  action,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-slate-800 rounded-xl bg-neutral-900/30">
      <div className="w-12 h-12 rounded-full bg-neutral-800/80 border border-slate-700/60 flex items-center justify-center text-slate-400 mb-3">
        {icon || <Inbox className="w-6 h-6" />}
      </div>
      <h3 className="text-sm font-semibold text-slate-200 mb-1">{title}</h3>
      <p className="text-xs font-mono text-slate-400 max-w-sm mb-4">{description}</p>
      {action && <div>{action}</div>}
    </div>
  );
};
