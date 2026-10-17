import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
  message?: string;
  rows?: number;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading data...',
  rows = 3,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center space-y-4">
      <div className="relative flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
        <div className="absolute w-12 h-12 rounded-full border border-cyan-500/20 animate-ping pointer-events-none" />
      </div>
      <p className="text-sm font-mono text-slate-400">{message}</p>

      {rows > 0 && (
        <div className="w-full max-w-md space-y-2 pt-2 opacity-40">
          {Array.from({ length: rows }).map((_, i) => (
            <div
              key={i}
              className="h-4 bg-slate-800 rounded animate-pulse"
              style={{ width: `${100 - i * 15}%` }}
            />
          ))}
        </div>
      )}
    </div>
  );
};
