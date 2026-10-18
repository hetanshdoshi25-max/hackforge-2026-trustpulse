import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api';
import type { AppConfig } from '../types/api';
import { ACTION_HEX } from '../utils/status';
import { Arrow, Btn, ErrorBlock, KV, Label, Loading, PageHead } from '../components/ui/kit';

/** The decision bands, relative to the threshold T (mirrors backend engine.decide). */
function bands(t: number) {
  const step = Math.min(t + 20, 95);
  return [
    { action: 'ALLOW', from: 0, to: Math.max(0, t - 30), label: 'Allow' },
    { action: 'SOFT_CHECK', from: Math.max(0, t - 30), to: t, label: 'Soft check' },
    { action: 'STEP_UP', from: t, to: step, label: 'Step up' },
    { action: 'REVIEW', from: step, to: 100, label: 'Review' },
  ];
}

export const SettingsPage: React.FC = () => {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [threshold, setThreshold] = useState(70);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    try {
      setError(null);
      const c = await api.getConfig();
      setConfig(c);
      setThreshold(c.threshold);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch engine configuration');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaved(false);
    try {
      setConfig(await api.setConfig(threshold));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      window.alert(err instanceof Error ? err.message : 'Failed to update threshold');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <Loading message="Loading engine settings" />;
  if (error || !config) return <ErrorBlock title="Settings unavailable" message={error || 'Could not retrieve engine configuration.'} onRetry={fetchConfig} />;

  const changed = config.threshold !== threshold;

  return (
    <div className="space-y-12">
      <PageHead
        no="10"
        kicker="Engine configuration"
        title={
          <>
            One dial, <em>four outcomes.</em>
          </>
        }
        lede="The threshold decides where the engine starts asking for a selfie. Lower is stricter, higher is more open. It changes the live engine immediately."
      />

      <form onSubmit={save} className="grid grid-cols-1 gap-12 lg:grid-cols-[1.4fr_1fr]">
        <section>
          <div className="flex items-end justify-between">
            <Label>Step-up threshold (risk)</Label>
            <span className="tnum font-mono text-[72px] font-light leading-[0.8]">{threshold}</span>
          </div>
          <input
            type="range"
            min="20"
            max="95"
            step="5"
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="hair mt-6"
            aria-label="Threshold"
          />
          <div className="mt-1 flex justify-between font-mono text-[10.5px] text-dim">
            <span>20 · strict</span>
            <span>default 70 · demo 45</span>
            <span>95 · open</span>
          </div>

          {/* what each risk score would get at this threshold */}
          <div className="mt-10">
            <Label>What a session gets, by its risk score</Label>
            <div className="mt-3 flex h-10 w-full">
              {bands(threshold).map((b) => (
                <div
                  key={b.action}
                  className="relative overflow-hidden transition-[flex-grow] duration-300"
                  style={{ flexGrow: Math.max(0.0001, b.to - b.from), background: `${ACTION_HEX[b.action]}26`, borderTop: `2px solid ${ACTION_HEX[b.action]}` }}
                >
                  {b.to - b.from >= 8 && (
                    <span className="absolute left-2 top-2 font-mono text-[10.5px] uppercase tracking-[0.1em]" style={{ color: ACTION_HEX[b.action] }}>
                      {b.label}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-1 flex justify-between font-mono text-[10px] text-dim">
              <span>risk 0</span>
              <span>50</span>
              <span>100</span>
            </div>
          </div>

          <div className="mt-8 flex items-center justify-end gap-4">
            {saved && <span className="font-mono text-[11.5px] text-allow">live in the engine</span>}
            <Btn type="submit" variant={changed ? 'solid' : 'line'} disabled={isSaving || !changed}>
              {changed ? `Apply ${threshold}` : 'Applied'}
            </Btn>
          </div>
        </section>

        <section>
          <Label>Fixed by design</Label>
          <KV
            className="mt-3"
            rows={[
              ['Enrollment', `${config.min_enroll} clean logins`],
              ['Live threshold', config.threshold],
              ['Recording real sessions', config.recording ? 'on' : 'off'],
              ['Distance', 'scaled Manhattan'],
              ['Same-person rule', 'behaviour risk < 30 allows'],
            ]}
          />
          <p className="mt-5 text-[13px] leading-relaxed text-mute">
            Each new rider needs {config.min_enroll} logins before their own baseline exists. Until then every session is ENROLLING and nothing is
            blocked.
          </p>
          <div className="mt-6">
            <Arrow to="/analytics">See the trade-off at every threshold</Arrow>
          </div>
        </section>
      </form>
    </div>
  );
};
