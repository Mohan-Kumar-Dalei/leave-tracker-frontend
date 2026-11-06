import { lazy, Suspense } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { Button } from './components/ui';
import { useAuth } from './lib/auth';
import { ForgotPassword, Login, ResetPassword } from './pages/auth/AuthPages';
import Profile from './pages/Profile';
import MyRequests from './pages/employee/MyRequests';
import Summary from './pages/employee/Summary';

const Overview = lazy(() => import('./pages/admin/Overview'));
const AdminRequests = lazy(() => import('./pages/admin/AdminRequests'));
const TeamCalendar = lazy(() => import('./pages/admin/TeamCalendar'));
const Employees = lazy(() => import('./pages/admin/Employees'));
const EmployeeDetail = lazy(() => import('./pages/admin/EmployeeDetail'));
const Setup = lazy(() => import('./pages/admin/Setup'));

function Loading() {
  return <div className="skeleton h-40" aria-label="Loading" />;
}

function ServerDown() {
  const { retry } = useAuth();
  return (
    <div className="grid min-h-dvh place-items-center px-5 text-center">
      <div>
        <h1 className="text-[40px]">We cannot reach the server</h1>
        <p className="mt-3 text-base text-muted">Your session is safe. Please try again in a moment.</p>
        <Button className="mt-6" onClick={retry}>
          Try again
        </Button>
      </div>
    </div>
  );
}

function RequireAuth({ children }) {
  const { user, ready, unreachable } = useAuth();
  const location = useLocation();
  if (unreachable) return <ServerDown />;
  if (!ready) return null;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

function RequireAdmin({ children }) {
  const { user } = useAuth();
  if (user.role !== 'admin') return <Navigate to="/" replace />;
  return <Suspense fallback={<Loading />}>{children}</Suspense>;
}

function GuestOnly({ children }) {
  const { user, ready, unreachable } = useAuth();
  if (unreachable) return <ServerDown />;
  if (!ready) return null;
  if (user) return <Navigate to={user.role === 'admin' ? '/admin' : '/'} replace />;
  return children;
}

function NotFound() {
  return (
    <div className="py-24 text-center">
      <h1 className="text-[40px]">This page is not in the register</h1>
      <Link to="/" className="mt-4 inline-block text-accent underline underline-offset-4">
        Back to your summary
      </Link>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
      <Route path="/forgot-password" element={<GuestOnly><ForgotPassword /></GuestOnly>} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route element={<RequireAuth><AppShell /></RequireAuth>}>
        <Route index element={<Summary />} />
        <Route path="requests" element={<MyRequests />} />
        <Route path="profile" element={<Profile />} />
        <Route path="admin" element={<RequireAdmin><Overview /></RequireAdmin>} />
        <Route path="admin/requests" element={<RequireAdmin><AdminRequests /></RequireAdmin>} />
        <Route path="admin/calendar" element={<RequireAdmin><TeamCalendar /></RequireAdmin>} />
        <Route path="admin/employees" element={<RequireAdmin><Employees /></RequireAdmin>} />
        <Route path="admin/employees/:id" element={<RequireAdmin><EmployeeDetail /></RequireAdmin>} />
        <Route path="admin/setup" element={<RequireAdmin><Setup /></RequireAdmin>} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
