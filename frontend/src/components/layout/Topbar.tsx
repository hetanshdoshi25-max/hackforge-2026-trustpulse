import React from 'react';
import { Menu, Wifi, WifiOff, RefreshCw, Smartphone, Server } from 'lucide-react';
import type { SocketStatus } from '../../services/websocket';
import { formatRelativeTime } from '../../utils/formatting';

interface TopbarProps {
  title: string;
  subtitle?: string;
  onMobileMenuToggle: () => void;
  socketStatus: SocketStatus;
  backendHealthy: boolean | null;
  lastUpdated: number | null;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const Topbar: React.FC<TopbarProps> = ({
  title,
  subtitle,
  onMobileMenuToggle,
  socketStatus,
  backendHealthy,
  lastUpdated,
  onRefresh,
  isRefreshing,
}) => {
  return (
    <header className="h-16 px-4 md:px-6 bg-[#0a0a0a] border-b border-[#1e2c47] flex items-center justify-between z-20 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onMobileMenuToggle}
          className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-neutral-800 transition"
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="min-w-0">
          <h1 className="text-sm md:text-base font-bold font-mono tracking-wide text-slate-100 truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="text-[11px] font-mono text-slate-400 truncate hidden sm:block">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-4 shrink-0">
        {/* Backend health status indicator */}
        <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded bg-neutral-900/80 border border-slate-800 text-xs font-mono">
          <Server className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-400">API:</span>
          {backendHealthy === null ? (
            <span className="text-amber-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
              Checking
            </span>
          ) : backendHealthy ? (
            <span className="text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Online
            </span>
          ) : (
            <span className="text-rose-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
              Offline
            </span>
          )}
        </div>

        {/* WebSocket live status */}
        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-neutral-900/80 border border-slate-800 text-xs font-mono">
          {socketStatus === 'connected' ? (
            <>
              <Wifi className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-cyan-400 hidden sm:inline">LIVE PUSH</span>
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-slate-400 hidden sm:inline capitalize">{socketStatus}</span>
            </>
          )}
        </div>

        {/* Last updated and manual refresh button */}
        {lastUpdated && (
          <span className="text-[11px] font-mono text-slate-400 hidden lg:inline">
            Updated {formatRelativeTime(lastUpdated)}
          </span>
        )}

        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-neutral-800 transition disabled:opacity-50"
            title="Refresh data"
            aria-label="Refresh data"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        )}

        {/* Quick link to Rider App */}
        <a
          href="/rider"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-medium rounded-lg bg-cyan-950/80 text-cyan-300 border border-cyan-700/60 hover:bg-cyan-900/60 transition shadow-sm"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span className="hidden xs:inline">Rider App</span>
        </a>
      </div>
    </header>
  );
};
