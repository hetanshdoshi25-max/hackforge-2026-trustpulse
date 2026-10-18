import React, { useState } from 'react';
import { Btn, Label } from '../ui/kit';

import { CONSENT_KEY, CONSENT_VERSION } from './consent';

const USE = [
  ['How you type your PIN', 'key hold times and the gaps between keys'],
  ['How you swipe to accept an order', 'speed, straightness, angle'],
  ['How you hold the phone while doing that', 'tilt and steadiness, a few seconds only'],
];
const NEVER = [
  'Track your location from these sensors, or read them in the background',
  'Store raw keystrokes or sensor streams: only a few averaged numbers',
  'Use it for anything except protecting your account',
];

export const ConsentScreen: React.FC<{ onAccept: () => void }> = ({ onAccept }) => {
  const [declined, setDeclined] = useState(false);

  const accept = () => {
    try {
      localStorage.setItem(CONSENT_KEY, CONSENT_VERSION);
    } catch {
      // private mode: consent lasts for this visit only
    }
    onAccept();
  };

  return (
    <div className="animate-rise">
      <Label>Before you start · one time</Label>
      <h2 className="mt-3 font-serif text-[40px] leading-[0.98] text-paper">
        Your account <em>stays yours.</em>
      </h2>
      <p className="mt-4 text-[15px] leading-relaxed text-paper-2">
        So only <strong className="font-medium text-paper">you</strong> can ride on your account, TrustPulse learns how you use this app,
        the way a bank learns your signature.
      </p>

      <div className="mt-7">
        <Label>What we read</Label>
        <ul className="mt-2 border-t border-line">
          {USE.map(([a, b]) => (
            <li key={a} className="grid grid-cols-[1.5rem_1fr] gap-2 border-b border-line py-3">
              <span className="font-mono text-allow">+</span>
              <span>
                <span className="block text-[14px] text-paper">{a}</span>
                <span className="block text-[12.5px] text-mute">{b}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6">
        <Label>What we never do</Label>
        <ul className="mt-2 border-t border-line">
          {NEVER.map((a) => (
            <li key={a} className="grid grid-cols-[1.5rem_1fr] gap-2 border-b border-line py-3 text-[14px] text-paper-2">
              <span className="font-mono text-review">×</span>
              {a}
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-5 text-[12.5px] leading-relaxed text-mute">
        A new phone or a new city never blocks you. If something looks unusual, the worst case is a quick selfie, and a person
        reviews it before anything else happens.
      </p>

      {declined ? (
        <div className="mt-6 border-l-2 border-soft pl-4 text-[13px] text-paper-2">
          Without this we can't confirm it's you, so login is paused. You can change your mind any time.
          <button onClick={() => setDeclined(false)} className="mt-2 block text-paper underline underline-offset-4">
            Review again
          </button>
        </div>
      ) : (
        <div className="mt-7 grid grid-cols-[1fr_2fr] gap-2">
          <Btn variant="ghost" onClick={() => setDeclined(true)} className="py-3.5">
            No thanks
          </Btn>
          <Btn variant="solid" onClick={accept} className="py-3.5 text-[14px]">
            I agree
          </Btn>
        </div>
      )}
    </div>
  );
};
