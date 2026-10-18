import React, { useRef, useState } from 'react';
import type { KeyTelemetry } from '../../types/api';

interface PinPadProps {
  onPinComplete: (pin: string, keystrokeEvents: KeyTelemetry[]) => void;
  disabled?: boolean;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'];

export const PinPad: React.FC<PinPadProps> = ({ onPinComplete, disabled = false }) => {
  const [events, setEvents] = useState<KeyTelemetry[]>([]);
  const [down, setDown] = useState<string | null>(null);
  // One entry per finger currently down: fast two-thumb typing presses the next key
  // before releasing the previous one, and a single "pending" slot would drop a digit.
  const pendingRef = useRef(new Map<number, { key: string; downTime: number; x: number; y: number; size: number }>());
  const recordedEventsRef = useRef<KeyTelemetry[]>([]);

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>, digit: string) => {
    if (disabled || recordedEventsRef.current.length + pendingRef.current.size >= 4) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const normalizedX = (e.clientX - centerX) / (rect.width / 2);
    const normalizedY = (e.clientY - centerY) / (rect.height / 2);
    const contactSize = e.width && e.height ? (e.width + e.height) / 2 : 1.0;
    setDown(digit);
    pendingRef.current.set(e.pointerId, {
      key: digit,
      downTime: performance.now(),
      x: Math.max(-1, Math.min(1, Number(normalizedX.toFixed(2)))),
      y: Math.max(-1, Math.min(1, Number(normalizedY.toFixed(2)))),
      size: Number(contactSize.toFixed(1)),
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const pending = pendingRef.current.get(e.pointerId);
    setDown(null);
    if (disabled || !pending) return;
    pendingRef.current.delete(e.pointerId);

    recordedEventsRef.current.push({
      key: pending.key,
      down: Number(pending.downTime.toFixed(1)),
      up: Number(performance.now().toFixed(1)),
      x: pending.x,
      y: pending.y,
      size: pending.size,
    });
    // PIN order = press order, even if the fingers lift in a different order
    const sorted = [...recordedEventsRef.current].sort((a, b) => a.down - b.down);
    setEvents(sorted);

    if (sorted.length === 4) {
      setTimeout(() => {
        onPinComplete(sorted.map((ev) => ev.key).join(''), sorted);
      }, 50);
    }
  };

  const handleClear = () => {
    // API contract: if the user deletes or resets, clear the entire entry and restart capture
    pendingRef.current.clear();
    recordedEventsRef.current = [];
    setEvents([]);
  };

  const filled = events.length;
  const t0 = events[0]?.down ?? 0;
  const span = events.length ? Math.max(1, events[events.length - 1].up - t0) : 1;

  return (
    <div className="mx-auto flex w-full max-w-[340px] select-none flex-col items-stretch">
      {/* four slots */}
      <div className="flex justify-center gap-3" aria-label={`${filled} of 4 digits entered`}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`flex h-12 w-12 items-end justify-center border-b-2 pb-2 transition-colors ${i < filled ? 'border-paper' : 'border-line-2'}`}>
            <span className={`h-3 w-3 rounded-full bg-paper transition-transform duration-150 ${i < filled ? 'scale-100' : 'scale-0'}`} />
          </div>
        ))}
      </div>

      {/* the rhythm we just captured: each bar is one key held down, gaps are the pauses between */}
      <div className="mt-5 h-9">
        <div className="flex items-baseline justify-between">
          <span className="label">Your rhythm</span>
          <span className="tnum font-mono text-[10.5px] text-dim">{events.length ? `${Math.round(span)} ms` : 'waiting'}</span>
        </div>
        <div className="relative mt-2 h-2.5 border-b border-line">
          {events.map((ev, i) => (
            <span
              key={i}
              className="absolute bottom-0 h-full bg-paper/85 animate-[rise_.25s_ease-out]"
              style={{ left: `${((ev.down - t0) / span) * 100}%`, width: `${Math.max(2, ((ev.up - ev.down) / span) * 100)}%` }}
            />
          ))}
        </div>
      </div>

      {/* keypad, drawn as a ruled grid */}
      <div className="mt-6 grid grid-cols-3 border-l border-t border-line">
        {KEYS.map((k) => {
          const util = k === 'C' || k === '⌫';
          const base = 'relative flex h-[68px] items-center justify-center border-b border-r border-line touch-manipulation transition-colors duration-100';
          if (util) {
            return (
              <button
                key={k}
                type="button"
                onClick={handleClear}
                disabled={disabled || filled === 0}
                aria-label="Clear PIN entry"
                className={`${base} font-mono text-[11px] uppercase tracking-[0.14em] text-mute hover:text-paper disabled:opacity-30`}
              >
                {k === 'C' ? 'Clear' : '⌫'}
              </button>
            );
          }
          return (
            <button
              key={k}
              type="button"
              onPointerDown={(e) => handlePointerDown(e, k)}
              onPointerUp={handlePointerUp}
              onPointerCancel={(e) => {
                pendingRef.current.delete(e.pointerId);
                setDown(null);
              }}
              disabled={disabled || filled >= 4}
              className={`${base} text-[30px] font-light disabled:opacity-40 ${down === k ? 'bg-paper text-ink' : 'text-paper hover:bg-ink-3'}`}
            >
              {k}
            </button>
          );
        })}
      </div>
    </div>
  );
};
