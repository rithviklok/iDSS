import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
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
        <Route path="/dss" element={<ProtectedRoute><DSSPage /></ProtectedRoute>} />
        <Route path="/dss/triggers/:id" element={<ProtectedRoute><TriggerDetailPage /></ProtectedRoute>} />
        <Route path="/issues" element={<ProtectedRoute><IssuesDashboard /></ProtectedRoute>} />
        <Route path="/issues/:id" element={<ProtectedRoute><IssueDetail /></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/configurator" element={<ProtectedRoute><ConfiguratorLayout><SensorHealthMonitor /></ConfiguratorLayout></ProtectedRoute>} />
        <Route path="/configurator/sensors" element={<ProtectedRoute><ConfiguratorLayout><ManageSensors /></ConfiguratorLayout></ProtectedRoute>} />
        <Route path="/configurator/*" element={<ProtectedRoute><ConfiguratorLayout><div style={{ padding: 40, color: 'var(--text-muted)', textAlign: 'center' }}>Coming soon</div></ConfiguratorLayout></ProtectedRoute>} />
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
