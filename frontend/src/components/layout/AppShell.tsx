import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { MobileNavigation } from './MobileNavigation';
import { useTrustPulseSocket } from '../../hooks/useTrustPulseSocket';
import { api } from '../../services/api';

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  '/dashboard': {
    title: 'Fleet Operations Dashboard',
    subtitle: 'Real-time fleet behavioral identity monitoring',
  },
  '/fleet': {
    title: '3D Fleet Spatial View',
    subtitle: 'Tactical geographic inspection and cluster telemetry',
  },
  '/riders': {
    title: 'Rider Directory',
    subtitle: 'Enrollment progress, baselines, and historical profiles',
  },
  '/sessions': {
    title: 'Session Telemetry Feed',
    subtitle: 'Continuous behavioral verification stream',
  },
  '/alerts': {
    title: 'Alerts & Review Queue',
    subtitle: 'Step-up camera verifications and human resolution queue',
  },
  '/analytics': {
    title: 'Threshold Trade-off Analytics',
    subtitle: 'Synthetic fleet evaluation and false-lockout trade-off curve',
  },
  '/settings': {
    title: 'Engine Configuration',
    subtitle: 'Live sensitivity threshold and baseline parameters',
  },
};

export const AppShell: React.FC = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [backendHealthy, setBackendHealthy] = useState<boolean | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [alertCount, setAlertCount] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const location = useLocation();
  const currentPath = location.pathname;

  // Find page title info, checking dynamic routes like /riders/:id
  let pageInfo = PAGE_TITLES[currentPath];
  if (!pageInfo && currentPath.startsWith('/riders/')) {
    pageInfo = {
      title: 'Rider Detail & History',
      subtitle: 'Chronological trust timeline and behavioral breakdown',
    };
  }
  if (!pageInfo) {
    pageInfo = {
      title: 'TrustPulse Console',
      subtitle: 'Continuous Rider Identity Engine',
    };
  }

  const checkHealthAndAlerts = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const healthRes = await api.health();
      setBackendHealthy(healthRes.ok);
      const alerts = await api.getAlerts(100);
      // Count alerts that need attention (e.g. SELFIE_SUBMITTED, REVIEW, STEP_UP)
      setAlertCount(alerts.length);
      setLastUpdated(Date.now() / 1000);
    } catch {
      setBackendHealthy(false);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const { status: socketStatus } = useTrustPulseSocket(
    useCallback(() => {
      checkHealthAndAlerts();
    }, [checkHealthAndAlerts])
  );

  useEffect(() => {
    checkHealthAndAlerts();
    const interval = setInterval(checkHealthAndAlerts, 20000);
    return () => clearInterval(interval);
  }, [checkHealthAndAlerts]);

  return (
    <div className="flex h-screen w-full bg-[#070b14] text-slate-100 overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          alertCount={alertCount}
        />
      </div>

      {/* Mobile Drawer */}
      <MobileNavigation
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        alertCount={alertCount}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar
          title={pageInfo.title}
          subtitle={pageInfo.subtitle}
          onMobileMenuToggle={() => setMobileMenuOpen(true)}
          socketStatus={socketStatus}
          backendHealthy={backendHealthy}
          lastUpdated={lastUpdated}
          onRefresh={checkHealthAndAlerts}
          isRefreshing={isRefreshing}
        />

        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#070b14]">
          <Outlet context={{ refreshGlobal: checkHealthAndAlerts, alertCount }} />
        </main>
      </div>
    </div>
  );
};
