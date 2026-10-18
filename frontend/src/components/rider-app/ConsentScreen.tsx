import React, { useState } from 'react';
import { Check, ShieldCheck, X } from 'lucide-react';

/**
 * One-time consent before any behavioural data is collected (DPDP Act: consent for a
 * stated purpose). Stored per device; bump CONSENT_VERSION if what we collect changes.
 */
export const CONSENT_VERSION = '1';
const KEY = 'trustpulse_consent';

export function hasConsent(): boolean {
  try {
    return localStorage.getItem(KEY) === CONSENT_VERSION;
  } catch {
    return false;
  }
}

export const ConsentScreen: React.FC<{ onAccept: () => void }> = ({ onAccept }) => {
  const [declined, setDeclined] = useState(false);

  const accept = () => {
    try {
      localStorage.setItem(KEY, CONSENT_VERSION);
    } catch {
      // private mode: consent lasts for this visit only
    }
    onAccept();
  };

  return (
    <div className="mx-auto w-full max-w-sm space-y-4 py-4 text-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-500/50 bg-cyan-950/60 text-cyan-300">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <h2 className="text-lg font-semibold text-slate-100">Keeping your account yours</h2>
      </div>

      <p className="text-slate-300">
        To make sure only <strong>you</strong> can ride on your account, TrustPulse learns how you use this app, the way
        your bank learns how you sign.
      </p>

      <div className="space-y-2 rounded-xl border border-slate-800 bg-neutral-900/60 p-3">
        <div className="text-xs uppercase tracking-wider text-slate-500">What we use</div>
        <Item ok>How you type your PIN: key hold times and gaps</Item>
        <Item ok>How you swipe to accept an order</Item>
        <Item ok>How you hold the phone while doing that (tilt and steadiness, a few seconds only)</Item>
      </div>

      <div className="space-y-2 rounded-xl border border-slate-800 bg-neutral-900/60 p-3">
        <div className="text-xs uppercase tracking-wider text-slate-500">What we never do</div>
        <Item>Track your location from these sensors, or read them in the background</Item>
        <Item>Store raw keystrokes or sensor streams (only a few averaged numbers)</Item>
        <Item>Use it for anything except protecting your account</Item>
      </div>

      <p className="text-xs text-slate-400">
        A new phone or a new city never blocks you. If something looks unusual, the worst case is a quick selfie, and a
        person reviews it before anything else happens.
      </p>

      {declined ? (
        <div className="rounded-xl border border-yellow-800 bg-yellow-950/40 p-3 text-xs text-yellow-200">
          Without this, we can't confirm it's you, so login is paused. You can change your mind any time.
          <button onClick={() => setDeclined(false)} className="mt-2 block font-semibold text-yellow-100 underline">
            Review again
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={() => setDeclined(true)}
            className="flex-1 rounded-xl border border-slate-700 py-3 text-slate-300 hover:bg-neutral-900"
          >
            No thanks
          </button>
          <button onClick={accept} className="flex-[2] rounded-xl bg-cyan-500 py-3 font-semibold text-black hover:bg-cyan-400">
            I agree
          </button>
        </div>
      )}
    </div>
  );
};

const Item: React.FC<{ ok?: boolean; children: React.ReactNode }> = ({ ok, children }) => (
  <div className="flex items-start gap-2 text-slate-300">
    {ok ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /> : <X className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />}
    <span>{children}</span>
  </div>
);
