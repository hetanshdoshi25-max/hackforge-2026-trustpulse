import React from 'react';
import { getTrustColor } from '../../utils/status';

interface TrustScoreProps {
  score: number | null | undefined;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export const TrustScore: React.FC<TrustScoreProps> = ({ score, size = 'md', showLabel = false }) => {
  if (score === null || score === undefined || isNaN(score)) {
    return <span className="font-mono text-slate-500">—</span>;
  }

  const color = getTrustColor(score);

  if (size === 'sm') {
    return (
      <span
        className="font-mono font-bold text-xs px-1.5 py-0.5 rounded border border-slate-800"
        style={{ color, backgroundColor: `${color}15` }}
      >
        {score}
      </span>
    );
  }

  if (size === 'lg') {
    return (
      <div className="flex flex-col items-center justify-center p-3 rounded-lg bg-slate-900/60 border border-slate-800">
        <span className="font-mono font-extrabold text-3xl" style={{ color }}>
          {score}
        </span>
        {showLabel && (
          <span className="text-xs text-slate-400 font-mono tracking-wider uppercase mt-1">
            Trust Score
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5">
      <span
        className="font-mono font-bold text-sm px-2 py-0.5 rounded border border-slate-800"
        style={{ color, backgroundColor: `${color}15` }}
      >
        {score}
      </span>
      {showLabel && <span className="text-xs text-slate-400">Trust</span>}
    </div>
  );
};
