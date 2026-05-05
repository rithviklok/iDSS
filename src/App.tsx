import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { isPublicRole, canManageSensorRegistry } from './auth/rbac';
import { LocationProvider } from './contexts/LocationContext';
import { ThemeProvider } from './contexts/ThemeContext';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 2 * 60 * 1000, // 2 min – data considered fresh
            gcTime: 10 * 60 * 1000,   // 10 min – keep cached data
        },
    },
});
import AppShell from './components/layout/AppShell';
import MapView from './pages/MapView';
import IssuesDashboard from './pages/IssuesDashboard';
import IssueDetail from './pages/IssueDetail';
import NotificationsPage from './pages/NotificationsPage';
import ProfilePage from './pages/ProfilePage';
import LoginPage from './pages/LoginPage';
import DSSPage from './pages/DSSPage';
import TriggerDetailPage from './pages/TriggerDetailPage';
import ConfiguratorLayout from './components/layout/ConfiguratorLayout';
import SensorHealthMonitor from './pages/SensorHealthMonitor';
import ManageSensors from './pages/ManageSensors';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

/** Blocks Public persona from operational modules (map + profile only). */
function OfficialRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user || isPublicRole(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

/** Sensor CRUD — APPCB + ULB city (not ward-only or public). */
function SensorRegistryRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user || !canManageSensorRegistry(user.role)) return <Navigate to="/configurator" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-primary, #0f1729)' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-muted, #94a3b8)' }}>
          <div className="spinner" style={{ margin: '0 auto 16px' }} />
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<ProtectedRoute><MapView /></ProtectedRoute>} />
        <Route path="/dss" element={<ProtectedRoute><OfficialRoute><DSSPage /></OfficialRoute></ProtectedRoute>} />
        <Route path="/dss/triggers/:id" element={<ProtectedRoute><OfficialRoute><TriggerDetailPage /></OfficialRoute></ProtectedRoute>} />
        <Route path="/issues" element={<ProtectedRoute><OfficialRoute><IssuesDashboard /></OfficialRoute></ProtectedRoute>} />
        <Route path="/issues/:id" element={<ProtectedRoute><OfficialRoute><IssueDetail /></OfficialRoute></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute><OfficialRoute><NotificationsPage /></OfficialRoute></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/configurator" element={<ProtectedRoute><OfficialRoute><ConfiguratorLayout><SensorHealthMonitor /></ConfiguratorLayout></OfficialRoute></ProtectedRoute>} />
        <Route path="/configurator/sensors" element={<ProtectedRoute><OfficialRoute><SensorRegistryRoute><ConfiguratorLayout><ManageSensors /></ConfiguratorLayout></SensorRegistryRoute></OfficialRoute></ProtectedRoute>} />
        <Route path="/configurator/*" element={<ProtectedRoute><OfficialRoute><ConfiguratorLayout><div style={{ padding: 40, color: 'var(--text-muted)', textAlign: 'center' }}>Coming soon</div></ConfiguratorLayout></OfficialRoute></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter basename="/dss">
          <AuthProvider>
            <LocationProvider>
              <AppRoutes />
            </LocationProvider>
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
