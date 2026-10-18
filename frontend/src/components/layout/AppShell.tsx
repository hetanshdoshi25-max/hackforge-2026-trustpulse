import React, { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useTrustPulseSocket } from '../../hooks/useTrustPulseSocket';
import { api } from '../../services/api';
import { PulseStrip } from '../ui/PulseStrip';
import { Wordmark } from '../ui/kit';

const NAV = [
  { to: '/dashboard', label: 'Overview' },
  { to: '/stage', label: 'Stage' },
  { to: '/challenge', label: 'Challenge' },
  { to: '/fleet', label: 'Fleet map' },
  { to: '/riders', label: 'Riders' },
  { to: '/sessions', label: 'Sessions' },
  { to: '/alerts', label: 'Alerts' },
  { to: '/rings', label: 'Rings' },
  { to: '/analytics', label: 'Evaluation' },
  { to: '/settings', label: 'Config' },
];

export const AppShell: React.FC = () => {
  const [healthy, setHealthy] = useState<boolean | null>(null);
  const [alertCount, setAlertCount] = useState(0);
  const [perMinute, setPerMinute] = useState<number | null>(null);
  const [menu, setMenu] = useState(false);
  const location = useLocation();

  const refresh = useCallback(async () => {
    try {
      const h = await api.health();
      setHealthy(h.ok);
      setPerMinute(h.scored_last_minute ?? null);
      setAlertCount((await api.getAlerts(100)).length);
    } catch {
      setHealthy(false);
    }
  }, []);

  const { status } = useTrustPulseSocket(refresh);

  useEffect(() => {
    refresh();
    const t = window.setInterval(refresh, 20000);
    return () => window.clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    setMenu(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const live = status === 'connected' && healthy !== false;

  return (
    <div className="min-h-screen bg-ink text-paper">
      <header className="sticky top-0 z-40 border-b border-line bg-ink/92 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1520px] items-center gap-6 px-5 md:px-10">
          <Link to="/" aria-label="TrustPulse home" className="shrink-0">
            <Wordmark size="sm" />
          </Link>

          <nav className="hidden flex-1 items-center gap-0 xl:flex" aria-label="Console">
            {NAV.map((n, i) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  `group relative flex items-baseline gap-1.5 whitespace-nowrap px-2 py-1.5 text-[13px] transition-colors ${
                    isActive ? 'text-paper' : 'text-mute hover:text-paper'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span className="font-mono text-[9.5px] text-dim group-hover:text-mute">{String(i + 1).padStart(2, '0')}</span>
                    {n.label}
                    {n.to === '/alerts' && alertCount > 0 && (
                      <span className="tnum font-mono text-[10px] text-review">{alertCount}</span>
                    )}
                    {isActive && <span className="absolute inset-x-2 -bottom-[11px] h-px bg-paper" />}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-5">
            <div className="hidden items-center gap-2 font-mono text-[11px] sm:flex" title={`socket: ${status}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${live ? 'bg-allow' : 'bg-dim'}`} />
              <span className={live ? 'text-paper-2' : 'text-dim'}>{live ? 'LIVE' : healthy === false ? 'OFFLINE' : 'LINKING'}</span>
              {perMinute != null && <span className="text-dim">· {perMinute}/min</span>}
            </div>
            <a
              href="/rider"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden whitespace-nowrap border border-line-2 px-3 py-1.5 text-[12px] text-paper transition hover:border-paper md:inline-block"
            >
              Rider app ↗
            </a>
            <button className="text-paper xl:hidden" onClick={() => setMenu(true)} aria-label="Open menu">
              <Menu className="h-5 w-5" strokeWidth={1.5} />
            </button>
          </div>
        </div>
        <PulseStrip height={26} />
      </header>

      {menu && (
        <div className="fixed inset-0 z-50 flex flex-col bg-ink px-6 py-5 xl:hidden">
          <div className="flex items-center justify-between">
            <Wordmark size="sm" />
            <button onClick={() => setMenu(false)} aria-label="Close menu" className="text-paper">
              <X className="h-6 w-6" strokeWidth={1.5} />
            </button>
          </div>
          <nav className="mt-10 flex-1 overflow-y-auto">
            {NAV.map((n, i) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  `flex items-baseline gap-4 border-b border-line py-3 font-serif text-[34px] leading-none ${isActive ? 'text-paper' : 'text-mute'}`
                }
              >
                <span className="w-7 font-mono text-[11px] text-dim">{String(i + 1).padStart(2, '0')}</span>
                {n.label}
                {n.to === '/alerts' && alertCount > 0 && <span className="font-mono text-sm text-review">{alertCount}</span>}
              </NavLink>
            ))}
          </nav>
          <a href="/rider" className="mt-6 border border-line-2 py-3 text-center text-sm text-paper">
            Open rider app ↗
          </a>
        </div>
      )}

      <main className="mx-auto max-w-[1520px] px-5 pb-24 pt-10 md:px-10">
        <Outlet context={{ refreshGlobal: refresh, alertCount }} />
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1520px] flex-wrap items-center justify-between gap-2 px-5 py-5 font-mono text-[11px] text-dim md:px-10">
          <span>TrustPulse · continuous rider identity</span>
          <span>HackForge 2026 · Team Braniacs</span>
        </div>
      </footer>
    </div>
  );
};
