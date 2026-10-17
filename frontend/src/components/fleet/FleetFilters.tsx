import React from 'react';
import { Search, Globe, Table, Filter } from 'lucide-react';
import type { ActionType } from '../../types/api';

interface FleetFiltersProps {
  search: string;
  onSearchChange: (val: string) => void;
  selectedAction: ActionType | 'ALL';
  onActionChange: (action: ActionType | 'ALL') => void;
  minRisk: number;
  onMinRiskChange: (risk: number) => void;
  viewMode: '3d' | '2d';
  onViewModeToggle: () => void;
}

export const FleetFilters: React.FC<FleetFiltersProps> = ({
  search,
  onSearchChange,
  selectedAction,
  onActionChange,
  minRisk,
  onMinRiskChange,
  viewMode,
  onViewModeToggle,
}) => {
  const actions: (ActionType | 'ALL')[] = ['ALL', 'ALLOW', 'SOFT_CHECK', 'STEP_UP', 'REVIEW', 'ENROLLING'];

  return (
    <div className="bg-[#0a0a0a] border border-[#1e2c47] rounded-xl p-3 md:p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs font-mono">
      {/* Search Input */}
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Filter by rider name or ID..."
          className="w-full pl-9 pr-3 py-2 bg-neutral-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 md:gap-3">
        {/* Action Dropdown */}
        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={selectedAction}
            onChange={(e) => onActionChange(e.target.value as ActionType | 'ALL')}
            className="bg-neutral-900 border border-slate-700 text-slate-200 py-1.5 px-2.5 rounded-lg focus:outline-none focus:border-cyan-500"
          >
            {actions.map((act) => (
              <option key={act} value={act}>
                {act === 'ALL' ? 'All Actions' : act}
              </option>
            ))}
          </select>
        </div>

        {/* Risk Filter */}
        <div className="flex items-center gap-2 bg-neutral-900 px-3 py-1.5 rounded-lg border border-slate-700">
          <span className="text-slate-400">Min Risk:</span>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={minRisk}
            onChange={(e) => onMinRiskChange(Number(e.target.value))}
            className="w-20 accent-cyan-400 cursor-pointer"
          />
          <span className="text-slate-200 font-bold w-6">{minRisk}%</span>
        </div>

        {/* 3D / 2D View Toggle */}
        <button
          onClick={onViewModeToggle}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded-lg transition"
        >
          {viewMode === '3d' ? (
            <>
              <Table className="w-3.5 h-3.5 text-cyan-400" />
              <span>Table View</span>
            </>
          ) : (
            <>
              <Globe className="w-3.5 h-3.5 text-cyan-400" />
              <span>3D Globe</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
