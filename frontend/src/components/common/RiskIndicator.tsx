import React from 'react';
import { getRiskColor } from '../../utils/status';

interface RiskIndicatorProps {
  risk: number | null | undefined;
  behaviourRisk?: number | null;
  contextRisk?: number | null;
  compact?: boolean;
}

export const RiskIndicator: React.FC<RiskIndicatorProps> = ({
  risk,
  behaviourRisk,
  contextRisk,
  compact = false,
}) => {
  if (risk === null || risk === undefined || isNaN(risk)) {
    return <span className="font-mono text-slate-500">—</span>;
  }

  const overallColor = getRiskColor(risk);

  if (compact) {
    return (
      <span
        className="font-mono font-semibold text-xs px-1.5 py-0.5 rounded border border-slate-800"
        style={{ color: overallColor, backgroundColor: `${overallColor}15` }}
      >
        {risk}%
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="text-slate-400">Total Risk:</span>
        <span className="font-bold" style={{ color: overallColor }}>
          {risk}%
        </span>
      </div>

      {(behaviourRisk !== undefined || contextRisk !== undefined) && (
        <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400 pt-0.5 border-t border-slate-800/60">
          <span>
            Beh:{' '}
            <strong className={behaviourRisk !== null && behaviourRisk !== undefined ? 'text-slate-200' : 'text-slate-500'}>
              {behaviourRisk !== null && behaviourRisk !== undefined ? `${behaviourRisk}%` : '—'}
            </strong>
          </span>
          <span>·</span>
          <span>
            Ctx:{' '}
            <strong className={contextRisk !== null && contextRisk !== undefined ? 'text-slate-200' : 'text-slate-500'}>
              {contextRisk !== null && contextRisk !== undefined ? `${contextRisk}%` : '—'}
            </strong>
          </span>
        </div>
      )}
    </div>
  );
};
