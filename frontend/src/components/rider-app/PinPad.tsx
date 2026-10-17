import React, { useRef, useState } from 'react';
import type { KeyTelemetry } from '../../types/api';
import { Delete, Lock } from 'lucide-react';

interface PinPadProps {
  onPinComplete: (pin: string, keystrokeEvents: KeyTelemetry[]) => void;
  disabled?: boolean;
}

export const PinPad: React.FC<PinPadProps> = ({ onPinComplete, disabled = false }) => {
  const [pinDigits, setPinDigits] = useState<string[]>([]);
  const pendingDownRef = useRef<{ key: string; downTime: number; x: number; y: number; size: number } | null>(null);
  const recordedEventsRef = useRef<KeyTelemetry[]>([]);

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>, digit: string) => {
    if (disabled || pinDigits.length >= 4) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const normalizedX = (e.clientX - centerX) / (rect.width / 2);
    const normalizedY = (e.clientY - centerY) / (rect.height / 2);
    const contactSize = e.width && e.height ? (e.width + e.height) / 2 : 1.0;

    pendingDownRef.current = {
      key: digit,
      downTime: performance.now(),
      x: Math.max(-1, Math.min(1, Number(normalizedX.toFixed(2)))),
      y: Math.max(-1, Math.min(1, Number(normalizedY.toFixed(2)))),
      size: Number(contactSize.toFixed(1)),
    };
  };

  const handlePointerUp = (_e: React.PointerEvent<HTMLButtonElement>, digit: string) => {
    if (disabled || !pendingDownRef.current || pendingDownRef.current.key !== digit) {
      return;
    }
    const upTime = performance.now();
    const eventRecord: KeyTelemetry = {
      key: digit,
      down: Number(pendingDownRef.current.downTime.toFixed(1)),
      up: Number(upTime.toFixed(1)),
      x: pendingDownRef.current.x,
      y: pendingDownRef.current.y,
      size: pendingDownRef.current.size,
    };

    pendingDownRef.current = null;
    recordedEventsRef.current.push(eventRecord);

    const nextDigits = [...pinDigits, digit];
    setPinDigits(nextDigits);

    if (nextDigits.length === 4) {
      const fullPin = nextDigits.join('');
      const events = [...recordedEventsRef.current];
      // Reset after passing to handler
      setTimeout(() => {
        onPinComplete(fullPin, events);
      }, 50);
    }
  };

  const handleClear = () => {
    // API contract: If user deletes or resets, clear entire entry & restart capture sequence
    pendingDownRef.current = null;
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
              onPointerUp={(e) => handlePointerUp(e, k)}
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
