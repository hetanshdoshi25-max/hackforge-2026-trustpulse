import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Failed to load data',
  message = 'Could not establish connection with the TrustPulse backend.',
  onRetry,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center border border-rose-900/40 rounded-xl bg-rose-950/20 max-w-lg mx-auto my-6">
      <div className="w-12 h-12 rounded-full bg-rose-900/40 border border-rose-700/60 flex items-center justify-center text-rose-400 mb-3">
        <AlertCircle className="w-6 h-6" />
      </div>
      <h3 className="text-base font-semibold text-rose-300 mb-1">{title}</h3>
      <p className="text-xs font-mono text-rose-300/70 mb-4 max-w-sm">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-mono font-medium rounded-md bg-neutral-800 text-slate-200 border border-slate-700 hover:bg-slate-700 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry Request
        </button>
      )}
    </div>
  );
};
