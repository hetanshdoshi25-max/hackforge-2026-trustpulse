import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Globe2,
  Users,
  Radio,
  BellRing,
  Sliders,
  Settings,
  Smartphone,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  alertCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle, alertCount = 0 }) => {
  const navItems = [
    { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
    { to: '/fleet', label: 'Fleet 3D', icon: Globe2 },
    { to: '/riders', label: 'Riders', icon: Users },
    { to: '/sessions', label: 'Sessions', icon: Radio },
    { to: '/alerts', label: 'Alert Queue', icon: BellRing, badge: alertCount },
    { to: '/analytics', label: 'Trade-off Curve', icon: Sliders },
    { to: '/settings', label: 'Config', icon: Settings },
  ];

  return (
    <aside
      className={`relative flex flex-col shrink-0 bg-[#0c1322] border-r border-[#1e2c47] transition-all duration-300 z-30 select-none ${
        collapsed ? 'w-18' : 'w-64'
      }`}
    >
      {/* Brand header */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-[#1e2c47]">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-9 h-9 rounded-lg bg-cyan-950/80 border border-cyan-500/50 flex items-center justify-center text-cyan-400 shrink-0 shadow-lg shadow-cyan-950/50">
            <ShieldCheck className="w-5 h-5" />
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="font-mono font-bold tracking-wider text-sm text-slate-100 flex items-center gap-1.5">
                TRUST<span className="text-cyan-400">PULSE</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono tracking-tight truncate">
                Identity Engine
              </span>
            </div>
          )}
        </div>
        <button
          onClick={onToggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation links */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        <div className={`px-2 pb-2 text-[10px] font-mono uppercase tracking-wider text-slate-400 ${collapsed ? 'hidden' : 'block'}`}>
          Operations
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-mono tracking-wide transition-colors ${
                  isActive
                    ? 'bg-cyan-950/60 text-cyan-300 border border-cyan-800/60 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`
              }
              title={collapsed ? item.label : undefined}
            >
              <Icon className="w-4 h-4 shrink-0 text-slate-300" />
              {!collapsed && <span className="truncate">{item.label}</span>}
              {!collapsed && item.badge !== undefined && item.badge > 0 && (
                <span className="ml-auto px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/40">
                  {item.badge}
                </span>
              )}
            </NavLink>
          );
        })}

        <div className={`pt-4 px-2 pb-2 text-[10px] font-mono uppercase tracking-wider text-slate-400 ${collapsed ? 'hidden' : 'block'}`}>
          Field Apps
        </div>
        <NavLink
          to="/rider"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-mono tracking-wide text-cyan-400 bg-cyan-950/30 border border-cyan-800/40 hover:bg-cyan-950/60 transition"
          title={collapsed ? 'Rider Mobile App (PWA)' : undefined}
        >
          <Smartphone className="w-4 h-4 shrink-0 text-cyan-400" />
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="truncate font-semibold">Rider App</span>
              <span className="text-[10px] text-cyan-500/80">Launch PWA view ↗</span>
            </div>
          )}
        </NavLink>
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="p-3 m-2 rounded-lg bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400 font-mono">
          <div className="text-slate-300 font-semibold mb-0.5">HackForge 2026</div>
          <div className="text-[10px] text-slate-400">Team Braniacs · Track: Trust Juggler</div>
        </div>
      )}
    </aside>
  );
};
