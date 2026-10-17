import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import type { AppConfig } from '../types/api';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { Settings, CheckCircle, ArrowRight } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [thresholdInput, setThresholdInput] = useState<number>(70);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    try {
      setError(null);
      const data = await api.getConfig();
      setConfig(data);
      setThresholdInput(data.threshold);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch engine configuration');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const updated = await api.setConfig(thresholdInput);
      setConfig(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update threshold');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <LoadingState message="Loading engine settings..." />;
  }

  if (error || !config) {
    return (
      <ErrorState
        title="Settings Unavailable"
        message={error || 'Could not retrieve engine configuration.'}
        onRetry={fetchConfig}
      />
    );
  }

  const hasChanged = config.threshold !== thresholdInput;

  return (
    <div className="max-w-3xl space-y-6">
      {/* Settings Card */}
      <div className="bg-[#0a0a0a] border border-[#1e2c47] rounded-xl p-6 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-[#1e2c47]">
          <div className="w-10 h-10 rounded-lg bg-cyan-950/80 border border-cyan-800 flex items-center justify-center text-cyan-400">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold font-mono text-slate-100">
              Identity Engine Sensitivity & Parameters
            </h2>
            <p className="text-xs font-mono text-slate-400">
              Tune live behavioral thresholds and baseline requirements
            </p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-6 text-xs font-mono">
          {/* Threshold Parameter */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-semibold text-slate-200 block">
                  Step-up Decision Threshold (Risk Cutoff)
                </label>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Controls the risk threshold for escalating to STEP_UP camera verification.
                  <br />
                  <strong className="text-cyan-400">Lower = Stricter</strong> (more verifications) ·{' '}
                  <strong className="text-emerald-400">Higher = More Open</strong> (frictionless).
                </p>
              </div>
              <span className="text-lg font-bold font-mono text-cyan-400 px-3 py-1 rounded bg-neutral-900 border border-slate-700">
                {thresholdInput}
              </span>
            </div>

            <input
              type="range"
              min="20"
              max="95"
              step="5"
              value={thresholdInput}
              onChange={(e) => setThresholdInput(Number(e.target.value))}
              className="w-full h-2.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />

            <div className="flex justify-between text-[10px] text-slate-400">
              <span className="text-rose-400 font-bold">20 (Strict)</span>
              <span>Default: 70</span>
              <span className="text-emerald-400 font-bold">95 (Open)</span>
            </div>
          </div>

          {/* Min Enroll Parameter (Read-only engine constant) */}
          <div className="p-4 rounded-lg bg-neutral-900/60 border border-slate-800 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-200">
                Baseline Enrollment Requirement
              </span>
              <span className="text-sm font-bold text-slate-100">
                {config.min_enroll} clean logins
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Each new rider requires at least {config.min_enroll} logins to build their personal
              scaled Manhattan distance feature baseline.
            </p>
          </div>

          {/* Save / Apply row */}
          <div className="flex items-center justify-between pt-4 border-t border-[#1e2c47]">
            <div>
              {saveSuccess && (
                <span className="text-xs text-emerald-400 flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" /> Threshold updated live in engine.
                </span>
              )}
            </div>

            <button
              type="submit"
              disabled={isSaving || !hasChanged}
              className={`px-4 py-2 text-xs font-mono font-medium rounded-lg transition flex items-center gap-2 ${
                !hasChanged
                  ? 'bg-neutral-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                  : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-950'
              }`}
            >
              {isSaving && (
                <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              )}
              {hasChanged ? `Apply Threshold (${thresholdInput})` : 'Applied'}
            </button>
          </div>
        </form>
      </div>

      {/* Helper Card linking to Tradeoff Curve */}
      <div className="p-4 rounded-xl bg-neutral-900/50 border border-slate-800 flex items-center justify-between text-xs font-mono">
        <div>
          <span className="font-semibold text-slate-200 block">
            Want to see the trade-off curve across 500 simulated riders?
          </span>
          <span className="text-[11px] text-slate-400">
            View false-lockouts, takeover catch rates, and risk distribution in the Analytics tab.
          </span>
        </div>
        <Link
          to="/analytics"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-950 text-cyan-300 border border-cyan-800 hover:bg-cyan-900 transition shrink-0"
        >
          <span>Open Trade-off Curve</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
};
