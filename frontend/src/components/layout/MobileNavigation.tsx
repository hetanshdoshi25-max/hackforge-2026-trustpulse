import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  X,
  LayoutDashboard,
  Globe2,
  Users,
  Radio,
  BellRing,
  Sliders,
  Settings,
  Smartphone,
  ShieldCheck,
} from 'lucide-react';

interface MobileNavigationProps {
  isOpen: boolean;
  onClose: () => void;
  alertCount?: number;
}

export const MobileNavigation: React.FC<MobileNavigationProps> = ({
  isOpen,
  onClose,
  alertCount = 0,
}) => {
  if (!isOpen) return null;

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
    <div className="fixed inset-0 z-50 md:hidden flex">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="relative w-72 max-w-[80vw] bg-[#0c1322] border-r border-[#1e2c47] p-4 flex flex-col h-full z-10">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#1e2c47]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-950/80 border border-cyan-500/50 flex items-center justify-center text-cyan-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-mono font-bold tracking-wider text-sm text-slate-100">
                TRUST<span className="text-cyan-400">PULSE</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Operations Console</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-200"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-mono tracking-wide ${
                    isActive
                      ? 'bg-cyan-950/70 text-cyan-300 border border-cyan-800 font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0 text-slate-300" />
                <span className="truncate">{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="ml-auto px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/40">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}

          <div className="pt-4 border-t border-slate-800/80 my-2">
            <NavLink
              to="/rider"
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-mono tracking-wide text-cyan-400 bg-cyan-950/40 border border-cyan-800/60"
            >
              <Smartphone className="w-4 h-4 shrink-0 text-cyan-400" />
              <span>Launch Rider PWA ↗</span>
            </NavLink>
          </div>
        </nav>

        <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400 font-mono mt-auto">
          <div>TrustPulse Platform</div>
          <div className="text-[10px] text-slate-400">HackForge 2026</div>
        </div>
      </div>
    </div>
  );
};
