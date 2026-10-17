import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDestructive = false,
  isLoading = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
    >
      <div className="relative w-full max-w-md rounded-xl bg-neutral-900 border border-slate-700/80 p-6 shadow-2xl">
        <button
          onClick={onCancel}
          disabled={isLoading}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 transition"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start gap-4">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
              isDestructive
                ? 'bg-rose-950/80 text-rose-400 border border-rose-800'
                : 'bg-amber-950/80 text-amber-400 border border-amber-800'
            }`}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>

          <div className="flex-1">
            <h3 className="text-base font-semibold text-slate-100 mb-1">{title}</h3>
            <p className="text-xs text-slate-300 leading-relaxed mb-6">{message}</p>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onCancel}
                disabled={isLoading}
                className="px-4 py-2 text-xs font-mono font-medium rounded-lg bg-neutral-800 text-slate-300 hover:bg-slate-700 hover:text-white transition"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={isLoading}
                className={`px-4 py-2 text-xs font-mono font-medium rounded-lg text-white transition flex items-center gap-2 ${
                  isDestructive
                    ? 'bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-950'
                    : 'bg-cyan-600 hover:bg-cyan-500 shadow-lg shadow-cyan-950'
                }`}
              >
                {isLoading && (
                  <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                )}
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
