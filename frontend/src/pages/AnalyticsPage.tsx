import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import { api } from '../services/api';
import type { AppConfig, TradeoffCurvePoint, TradeoffMetrics } from '../types/api';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { formatPercent } from '../utils/formatting';
import {
  Sliders,
  CheckCircle,
  FlaskConical,
  BarChart3,
  TrendingUp,
  Columns,
  Sparkles,
} from 'lucide-react';

export const AnalyticsPage: React.FC = () => {
  const [metrics, setMetrics] = useState<TradeoffMetrics | null>(null);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Local selected slider threshold for preview (20 - 95, step 5)
  const [selectedThreshold, setSelectedThreshold] = useState<number>(70);
  const [isApplying, setIsApplying] = useState(false);
  const [applySuccess, setApplySuccess] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [tradeoffData, configData] = await Promise.all([
        api.getTradeoffMetrics(),
        api.getConfig(),
      ]);
      setMetrics(tradeoffData);
      setConfig(configData);
      setSelectedThreshold(configData.threshold);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load tradeoff analytics');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Selected curve point based on local slider
  const selectedPoint: TradeoffCurvePoint | undefined = useMemo(() => {
    if (!metrics || !metrics.curve) return undefined;
    return (
      metrics.curve.find((c) => c.threshold === selectedThreshold) ||
      metrics.curve[Math.floor(metrics.curve.length / 2)]
    );
  }, [metrics, selectedThreshold]);

  const handleApplyThreshold = async () => {
    setIsApplying(true);
    setApplySuccess(false);
    try {
      const updated = await api.setConfig(selectedThreshold);
      setConfig(updated);
      setApplySuccess(true);
      setTimeout(() => setApplySuccess(false), 3000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update threshold');
    } finally {
      setIsApplying(false);
    }
  };

  // Prepare Histogram Data for Recharts
  const histogramData = useMemo(() => {
    if (!metrics || !metrics.risk_histogram) return [];
    const { genuine, takeover, bin_size } = metrics.risk_histogram;
    const len = Math.min(genuine.length, takeover.length);
    const bins = [];
    for (let i = 0; i < len; i++) {
      const start = i * bin_size;
      const end = (i + 1) * bin_size;
      bins.push({
        range: `${start}-${end}%`,
        genuine: genuine[i] || 0,
        takeover: takeover[i] || 0,
      });
    }
    return bins;
  }, [metrics]);

  if (isLoading) {
    return <LoadingState message="Loading synthetic fleet evaluation & tradeoff models..." />;
  }

  if (error || !metrics) {
    return (
      <ErrorState
        title="Analytics Data Unavailable"
        message={error || 'Tradeoff evaluation data could not be retrieved.'}
        onRetry={fetchData}
      />
    );
  }

  const isCurrentApplied = config?.threshold === selectedThreshold;

  return (
    <div className="space-y-6">
      {/* Synthetic Fleet Header Banner */}
      <div className="p-4 rounded-xl bg-violet-950/20 border border-violet-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-violet-900/40 border border-violet-700/60 text-violet-400 shrink-0 mt-0.5">
            <FlaskConical className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold font-mono tracking-wider text-slate-100">
                SYNTHETIC FLEET EVALUATION BENCHMARK
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 font-mono border border-violet-500/40">
                Offline Evaluation
              </span>
            </div>
            <p className="text-xs text-slate-300 font-mono mt-1">
              Evaluated across {metrics.fleet.riders} riders, {metrics.fleet.scored_sessions.toLocaleString()} scored sessions, {metrics.fleet.takeover_sessions} simulated rented sessions, and {metrics.fleet.takeover_accounts} rented accounts.
            </p>
          </div>
        </div>

        <div className="text-xs font-mono text-slate-400 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800 shrink-0">
          Default Engine Threshold: <strong className="text-cyan-400">{metrics.default_threshold}</strong>
        </div>
      </div>

      {/* Threshold Slider Card */}
      <div className="p-5 rounded-xl bg-[#0c1322] border border-[#1e2c47] space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#1e2c47]">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-cyan-400" />
            <h3 className="font-mono font-bold text-sm text-slate-100">
              Live Engine Strictness Slider: Strict ↔ Open Trade-off
            </h3>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="text-slate-400">
              Active in Backend: <strong className="text-emerald-400">{config?.threshold}</strong>
            </span>
          </div>
        </div>

        {/* Range Input with Strict <-> Open markers */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-rose-400 font-bold flex items-center gap-1">
              ◀ STRICT (High Security / Higher Interruption)
            </span>
            <span className="text-slate-100 font-mono font-extrabold text-base px-3 py-1 rounded bg-slate-900 border border-slate-700">
              Selected: {selectedThreshold}
            </span>
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              OPEN (Frictionless / Lower Catch Rate) ▶
            </span>
          </div>

          <input
            type="range"
            min="20"
            max="95"
            step="5"
            value={selectedThreshold}
            onChange={(e) => setSelectedThreshold(Number(e.target.value))}
            className="w-full h-2.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />

          <div className="flex justify-between text-[10px] font-mono text-slate-400">
            <span>20</span>
            <span>30</span>
            <span>40</span>
            <span>50</span>
            <span>60</span>
            <span>70 (Default)</span>
            <span>80</span>
            <span>90</span>
            <span>95</span>
          </div>
        </div>

        {/* Preview of Tradeoff Metrics at Selected Threshold */}
        {selectedPoint && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono">
              <span className="text-slate-400 text-[10px] block">Honest Sessions Stopped</span>
              <span className="text-lg font-bold text-amber-400">
                {formatPercent(selectedPoint.false_lockout)}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono">
              <span className="text-slate-400 text-[10px] block">Honest Riders Ever Stopped</span>
              <span className="text-lg font-bold text-amber-400">
                {formatPercent(selectedPoint.honest_riders_ever_stopped)}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono">
              <span className="text-slate-400 text-[10px] block">Rented Sessions Caught</span>
              <span className="text-lg font-bold text-emerald-400">
                {formatPercent(selectedPoint.takeover_caught)}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono">
              <span className="text-slate-400 text-[10px] block">↳ Caught on Same Device</span>
              <span className="text-lg font-bold text-cyan-400">
                {formatPercent(selectedPoint.takeover_caught_same_device)}
              </span>
            </div>
          </div>
        )}

        {/* Apply Button */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#1e2c47]">
          {applySuccess && (
            <span className="text-xs font-mono text-emerald-400 flex items-center gap-1 animate-fade-in">
              <CheckCircle className="w-4 h-4" /> Live backend threshold applied!
            </span>
          )}

          <button
            onClick={handleApplyThreshold}
            disabled={isApplying || isCurrentApplied}
            className={`px-4 py-2 text-xs font-mono font-medium rounded-lg transition flex items-center gap-2 ${
              isCurrentApplied
                ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-950'
            }`}
          >
            {isApplying && (
              <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            )}
            {isCurrentApplied ? 'Applied to Backend' : `Apply Threshold (${selectedThreshold})`}
          </button>
        </div>
      </div>

      {/* Trade-off Curve Chart */}
      <div className="p-5 rounded-xl bg-[#0c1322] border border-[#1e2c47] space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#1e2c47]">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-cyan-400" />
            <h3 className="font-mono font-bold text-sm text-slate-100">
              False-Lockout vs. Takeover-Detection Trade-off Curve
            </h3>
          </div>
          <span className="text-xs font-mono text-slate-400">
            X-axis: Threshold · Y-axis: Percentage (%)
          </span>
        </div>

        <div className="h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={metrics.curve} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2c47" opacity={0.6} />
              <XAxis
                dataKey="threshold"
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'monospace' }}
              />
              <YAxis
                domain={[0, 100]}
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'monospace' }}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const d = payload[0].payload;
                    return (
                      <div className="bg-slate-900 border border-slate-700 p-3 rounded-lg text-xs font-mono text-slate-200 shadow-xl space-y-1">
                        <div className="font-bold text-cyan-400 mb-1">
                          Threshold: {d.threshold}
                        </div>
                        <div className="text-emerald-400">
                          Rented Caught: {d.takeover_caught}%
                        </div>
                        <div className="text-cyan-300">
                          ↳ Same Device Caught: {d.takeover_caught_same_device}%
                        </div>
                        <div className="text-amber-400">
                          Honest Sessions Stopped: {d.false_lockout}%
                        </div>
                        <div className="text-slate-400">
                          Honest Riders Stopped: {d.honest_riders_ever_stopped}%
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 11, fontFamily: 'monospace', paddingTop: 10 }}
              />
              <Line
                type="monotone"
                dataKey="takeover_caught"
                stroke="#10b981"
                strokeWidth={2.5}
                name="Rented Sessions Caught (%)"
                dot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="takeover_caught_same_device"
                stroke="#06b6d4"
                strokeWidth={2}
                strokeDasharray="4 4"
                name="Caught on Same Phone (%)"
                dot={{ r: 2 }}
              />
              <Line
                type="monotone"
                dataKey="false_lockout"
                stroke="#f59e0b"
                strokeWidth={2}
                name="Honest Sessions Stopped (%)"
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Risk Score Separation Histogram */}
      <div className="p-5 rounded-xl bg-[#0c1322] border border-[#1e2c47] space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#1e2c47]">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-cyan-400" />
            <h3 className="font-mono font-bold text-sm text-slate-100">
              Risk Score Distribution Histogram (Separation Power)
            </h3>
          </div>
          <span className="text-xs font-mono text-slate-400">
            Bin size: {metrics.risk_histogram.bin_size}% risk
          </span>
        </div>

        <div className="h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={histogramData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2c47" opacity={0.6} />
              <XAxis
                dataKey="range"
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
              />
              <YAxis
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const d = payload[0].payload;
                    return (
                      <div className="bg-slate-900 border border-slate-700 p-2.5 rounded text-xs font-mono text-slate-200">
                        <div className="text-slate-400 mb-1">Risk Range: {d.range}</div>
                        <div className="text-emerald-400">Honest Sessions: {d.genuine}</div>
                        <div className="text-rose-400">Rented Sessions: {d.takeover}</div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 11, fontFamily: 'monospace', paddingTop: 10 }}
              />
              <Bar dataKey="genuine" fill="#10b981" name="Honest Sessions" opacity={0.8} />
              <Bar dataKey="takeover" fill="#ef4444" name="Rented Sessions" opacity={0.8} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Baseline Comparison Matrix */}
      <div className="p-5 rounded-xl bg-[#0c1322] border border-[#1e2c47] space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#1e2c47]">
          <div className="flex items-center gap-2">
            <Columns className="w-4 h-4 text-cyan-400" />
            <h3 className="font-mono font-bold text-sm text-slate-100">
              Policy Baseline Comparison
            </h3>
          </div>
          <span className="text-xs font-mono text-cyan-400 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" /> Behavioral Telemetry Advantage
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-[#0e1628] border-b border-[#1e2c47] text-slate-400 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Verification Policy</th>
                <th className="py-3 px-4">Honest Sessions Stopped</th>
                <th className="py-3 px-4">Honest Riders Ever Stopped</th>
                <th className="py-3 px-4">Rented Sessions Caught</th>
                <th className="py-3 px-4">↳ Caught on Same Phone</th>
                <th className="py-3 px-4">Rented Accounts Caught</th>
                <th className="py-3 px-4">Median Shifts to Catch</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2c47]/60">
              {/* Open Gate */}
              <tr className="hover:bg-slate-800/30 transition">
                <td className="py-3 px-4 font-bold text-slate-300">
                  Open Gate (Verify Once)
                </td>
                <td className="py-3 px-4">0%</td>
                <td className="py-3 px-4">0%</td>
                <td className="py-3 px-4 text-rose-400">0%</td>
                <td className="py-3 px-4 text-rose-400">0%</td>
                <td className="py-3 px-4 text-rose-400">0%</td>
                <td className="py-3 px-4 text-slate-500">—</td>
              </tr>

              {/* Strict Gate */}
              <tr className="hover:bg-slate-800/30 transition">
                <td className="py-3 px-4 font-bold text-slate-300">
                  Strict Gate (Verify Every Login)
                </td>
                <td className="py-3 px-4 text-rose-400">100%</td>
                <td className="py-3 px-4 text-rose-400">100%</td>
                <td className="py-3 px-4 text-emerald-400">100%</td>
                <td className="py-3 px-4 text-emerald-400">100%</td>
                <td className="py-3 px-4 text-emerald-400">100%</td>
                <td className="py-3 px-4">1 shift</td>
              </tr>

              {/* Context Rules */}
              <tr className="hover:bg-slate-800/30 transition">
                <td className="py-3 px-4 font-bold text-slate-300">
                  Context Rules (New Device/City Only)
                </td>
                <td className="py-3 px-4">0.56%</td>
                <td className="py-3 px-4 text-amber-400">28.0%</td>
                <td className="py-3 px-4">37.8%</td>
                <td className="py-3 px-4 text-rose-400 font-bold">5.7% (Bypassed!)</td>
                <td className="py-3 px-4">45.8%</td>
                <td className="py-3 px-4">1 shift</td>
              </tr>

              {/* TrustPulse */}
              <tr className="bg-cyan-950/40 border-l-2 border-cyan-400 hover:bg-cyan-900/40 transition">
                <td className="py-3.5 px-4 font-extrabold text-cyan-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                  TrustPulse (Threshold 70)
                </td>
                <td className="py-3.5 px-4 font-bold text-emerald-400">0.19%</td>
                <td className="py-3.5 px-4 font-bold text-emerald-400">3.4% (Single selfie)</td>
                <td className="py-3.5 px-4 font-bold text-emerald-400">83.1%</td>
                <td className="py-3.5 px-4 font-bold text-cyan-300">81.8% (Caught!)</td>
                <td className="py-3.5 px-4 font-bold text-emerald-400">93.8%</td>
                <td className="py-3.5 px-4 font-bold text-slate-200">2 shifts (Median)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
