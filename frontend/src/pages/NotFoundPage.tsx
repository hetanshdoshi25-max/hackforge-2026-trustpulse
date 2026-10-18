import React from 'react';
import { Arrow } from '../components/ui/kit';

export const NotFoundPage: React.FC = () => (
  <div className="flex min-h-[60vh] flex-col justify-center">
    <div className="label">404 · flatline</div>
    <svg viewBox="0 0 600 60" className="mt-6 h-14 w-full max-w-2xl text-line-2" aria-hidden>
      <path d="M0 30h220l10-18 14 36 12-26 8 8h336" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
    <h1 className="mt-6 font-serif text-[64px] leading-none">
      No pulse <em>at this address.</em>
    </h1>
    <div className="mt-8">
      <Arrow to="/dashboard">Back to the overview</Arrow>
    </div>
  </div>
);
