/**
 * Main application component - routing, auth guard, and layout
 * Handles routing, authentication guard, and layout.
 */

import { lazy, Suspense } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  Link as RouterLinkComponent,
} from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Toaster } from 'react-hot-toast';
import { AppShell } from '@astryxdesign/core/AppShell';
import { LinkProvider } from '@astryxdesign/core/Link';

import Sidebar from './components/Sidebar';

// Astryx link-rendering components pass `href` and `to={href}`. React Router's
// Link takes `to`; forwarding only the accepted props keeps client-side routing
// without leaking a redundant href onto the anchor.
function RouterLink({ to, href, children, ...rest }) {
  return (
    <RouterLinkComponent to={to ?? href} {...rest}>
      {children}
    </RouterLinkComponent>
  );
}

// Route-level splitting keeps the initial bundle small; each page is fetched
// the first time the user navigates to it.
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Connections = lazy(() => import('./pages/Connections'));
const Explorer = lazy(() => import('./pages/Explorer'));
const Transfers = lazy(() => import('./pages/Transfers'));
const TransferDetail = lazy(() => import('./pages/TransferDetail'));
const Monitoring = lazy(() => import('./pages/Monitoring'));
const AdminUsers = lazy(() => import('./pages/AdminUsers'));

function PageFallback() {
  return (
    <div className="loading-overlay" role="status" aria-live="polite">
      <div className="spinner spinner-lg" aria-hidden="true"></div>
      <span>Loading…</span>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-overlay" style={{ minHeight: '100vh' }}>
        <div className="spinner spinner-lg" aria-hidden="true"></div>
        <span>Loading…</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function AppLayout({ children }) {
  // AppShell owns the skip link, the main landmark, the responsive mobile nav
  // drawer and its focus trap/restore. Pages keep their own h1 inside children.
  return (
    <AppShell
      contentPadding={0}
      height="auto"
      variant="surface"
      mobileNav={{ breakpoint: 'lg' }}
      sideNav={<Sidebar />}
    >
      {children}
    </AppShell>
  );
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Dashboard />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/connections"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Connections />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/explorer"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Explorer />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/transfers"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Transfers />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/transfers/:id"
          element={
            <ProtectedRoute>
              <AppLayout>
                <TransferDetail />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/monitoring"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Monitoring />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute>
              <AppLayout>
                <AdminUsers />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <LinkProvider component={RouterLink}>
      <AuthProvider>
        <Router>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              ariaProps: { role: 'status', 'aria-live': 'polite' },
              style: {
                background: 'var(--raised)',
                color: 'var(--text)',
                border: '1px solid var(--control-border)',
                borderRadius: 'var(--radius-control)',
                fontSize: 'var(--fs-small)',
                boxShadow: 'none',
              },
              success: {
                iconTheme: { primary: 'var(--pill-positive-ink)', secondary: 'var(--surface)' },
              },
              error: {
                iconTheme: { primary: 'var(--pill-negative-ink)', secondary: 'var(--surface)' },
              },
            }}
          />
          <AppRoutes />
        </Router>
      </AuthProvider>
    </LinkProvider>
  );
}

export default App;
