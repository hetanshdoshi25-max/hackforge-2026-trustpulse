import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';

import { RiderAppPage } from './pages/RiderAppPage';
import { LandingPage } from './pages/LandingPage';
import { Loading } from './components/ui/kit';

// Ops/3D pages load on demand, so the phone opening /rider never downloads three.js.
const page = <K extends string>(load: () => Promise<Record<K, React.ComponentType>>, name: K) =>
  lazy(() => load().then((m) => ({ default: m[name] })));
const DashboardPage = page(() => import('./pages/DashboardPage'), 'DashboardPage');
const FleetPage = page(() => import('./pages/FleetPage'), 'FleetPage');
const RidersPage = page(() => import('./pages/RidersPage'), 'RidersPage');
const RiderDetailPage = page(() => import('./pages/RiderDetailPage'), 'RiderDetailPage');
const SessionsPage = page(() => import('./pages/SessionsPage'), 'SessionsPage');
const AlertsPage = page(() => import('./pages/AlertsPage'), 'AlertsPage');
const AnalyticsPage = page(() => import('./pages/AnalyticsPage'), 'AnalyticsPage');
const SettingsPage = page(() => import('./pages/SettingsPage'), 'SettingsPage');
const NotFoundPage = page(() => import('./pages/NotFoundPage'), 'NotFoundPage');
const StagePage = page(() => import('./pages/StagePage'), 'StagePage');
const RingsPage = page(() => import('./pages/RingsPage'), 'RingsPage');
const ChallengePage = page(() => import('./pages/ChallengePage'), 'ChallengePage');
const PlayPage = page(() => import('./pages/PlayPage'), 'PlayPage');

export function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<Loading />}>
      <Routes>
        {/* Entry: choose rider app or ops dashboard */}
        <Route path="/" element={<LandingPage />} />

        {/* Operations Dashboard Routes (wrapped in AppShell) */}
        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/fleet" element={<FleetPage />} />
          <Route path="/riders" element={<RidersPage />} />
          <Route path="/riders/:id" element={<RiderDetailPage />} />
          <Route path="/sessions" element={<SessionsPage />} />
          <Route path="/alerts" element={<AlertsPage />} />
          <Route path="/rings" element={<RingsPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        {/* Rider PWA Route (Mobile-first, standalone) */}
        <Route path="/rider" element={<RiderAppPage />} />

        {/* Projector view for the live demo */}
        <Route path="/stage" element={<StagePage />} />

        {/* "Can you fool TrustPulse?": projector board + phone page */}
        <Route path="/challenge" element={<ChallengePage />} />
        <Route path="/play" element={<PlayPage />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
