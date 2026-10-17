import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 space-y-4 font-mono">
      <div className="w-16 h-16 rounded-2xl bg-rose-950/60 border border-rose-800 flex items-center justify-center text-rose-400">
        <ShieldAlert className="w-8 h-8" />
      </div>
      <h2 className="text-xl font-bold text-slate-100">404 — Route Not Found</h2>
      <p className="text-xs text-slate-400 max-w-sm">
        The requested operations endpoint or page does not exist in the TrustPulse console.
      </p>
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white transition shadow-lg shadow-cyan-950"
      >
        <ArrowLeft className="w-4 h-4" /> Return to Dashboard Overview
      </Link>
    </div>
  );
};
