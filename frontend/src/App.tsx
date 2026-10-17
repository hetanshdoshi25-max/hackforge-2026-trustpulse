import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';

import { DashboardPage } from './pages/DashboardPage';
import { FleetPage } from './pages/FleetPage';
import { RidersPage } from './pages/RidersPage';
import { RiderDetailPage } from './pages/RiderDetailPage';
import { SessionsPage } from './pages/SessionsPage';
import { AlertsPage } from './pages/AlertsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { SettingsPage } from './pages/SettingsPage';
import { RiderAppPage } from './pages/RiderAppPage';
import { NotFoundPage } from './pages/NotFoundPage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Operations Dashboard Routes (wrapped in AppShell) */}
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/fleet" element={<FleetPage />} />
          <Route path="/riders" element={<RidersPage />} />
          <Route path="/riders/:id" element={<RiderDetailPage />} />
          <Route path="/sessions" element={<SessionsPage />} />
          <Route path="/alerts" element={<AlertsPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        {/* Rider PWA Route (Mobile-first, standalone) */}
        <Route path="/rider" element={<RiderAppPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
