import React, { useRef, useState } from 'react';
import type { KeyTelemetry } from '../../types/api';
import { Delete, Lock } from 'lucide-react';

interface PinPadProps {
  onPinComplete: (pin: string, keystrokeEvents: KeyTelemetry[]) => void;
  disabled?: boolean;
}

export const PinPad: React.FC<PinPadProps> = ({ onPinComplete, disabled = false }) => {
  const [pinDigits, setPinDigits] = useState<string[]>([]);
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
    const events = [...recordedEventsRef.current].sort((a, b) => a.down - b.down);
    const nextDigits = events.map((ev) => ev.key);
    setPinDigits(nextDigits);

    if (nextDigits.length === 4) {
      setTimeout(() => {
        onPinComplete(nextDigits.join(''), events);
      }, 50);
    }
  };

  const handleClear = () => {
    // API contract: If user deletes or resets, clear entire entry & restart capture sequence
    pendingRef.current.clear();
    recordedEventsRef.current = [];
    setPinDigits([]);
  };

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'];

  return (
    <div className="w-full max-w-xs mx-auto flex flex-col items-center select-none">
      {/* 4-digit masked PIN Indicator */}
      <div className="flex items-center justify-center gap-4 py-4 mb-3">
        {[0, 1, 2, 3].map((idx) => {
          const filled = idx < pinDigits.length;
          return (
            <div
              key={idx}
              className={`w-4 h-4 rounded-full border-2 transition-all ${
                filled
                  ? 'bg-cyan-400 border-cyan-400 shadow-md shadow-cyan-500/50 scale-110'
                  : 'bg-transparent border-slate-700'
              }`}
            />
          );
        })}
      </div>

      {/* On-screen custom keypad */}
      <div className="grid grid-cols-3 gap-3 w-full">
        {keys.map((k) => {
          if (k === 'C' || k === '⌫') {
            return (
              <button
                key={k}
                type="button"
                onClick={handleClear}
                disabled={disabled || pinDigits.length === 0}
                className="h-16 rounded-2xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700/80 flex items-center justify-center text-slate-300 font-mono text-xs font-semibold active:scale-95 transition disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="Clear PIN entry"
              >
                {k === '⌫' ? <Delete className="w-5 h-5 text-slate-400" /> : 'CLEAR'}
              </button>
            );
          }

          return (
            <button
              key={k}
              type="button"
              onPointerDown={(e) => handlePointerDown(e, k)}
              onPointerUp={handlePointerUp}
              onPointerCancel={(e) => pendingRef.current.delete(e.pointerId)}
              disabled={disabled || pinDigits.length >= 4}
              className="h-16 rounded-2xl bg-[#0f192d] hover:bg-[#15233e] active:bg-cyan-950/80 border border-[#223558] flex flex-col items-center justify-center text-slate-100 font-mono text-2xl font-bold active:scale-95 transition shadow-sm touch-manipulation disabled:opacity-50"
            >
              <span>{k}</span>
            </button>
          );
        })}
      </div>

      <div className="text-[11px] font-mono text-slate-400 mt-4 flex items-center gap-1.5 text-center">
        <Lock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
        <span>Keystroke rhythm and micro-timing captured for verification</span>
      </div>
    </div>
  );
};
