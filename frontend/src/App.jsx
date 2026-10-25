import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AppLayout from './components/AppLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import CasesPage from './pages/CasesPage';
import InstitutionsPage from './pages/InstitutionsPage';
import OverlapsPage from './pages/OverlapsPage';
import NotificationsPage from './pages/NotificationsPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';

/** Redirect unauthenticated users to login */
function PrivateRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const { user } = useAuth();

  return (
    <Routes>
      {/* Public */}
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <LoginPage />}
      />

      {/* Protected – wrapped in AppLayout */}
      <Route
        path="/*"
        element={
          <PrivateRoute>
            <AppLayout>
              <Routes>
                <Route path="/"              element={<DashboardPage />} />
                <Route path="/cases"         element={<CasesPage />} />
                <Route path="/institutions"  element={<InstitutionsPage />} />
                <Route path="/overlaps"      element={<OverlapsPage />} />
                <Route path="/notifications" element={<NotificationsPage />} />
                <Route path="/reports"       element={<ReportsPage />} />
                <Route path="/settings"      element={<SettingsPage />} />
                <Route path="*"              element={<Navigate to="/" replace />} />
              </Routes>
            </AppLayout>
          </PrivateRoute>
        }
      />
    </Routes>
  );
}
