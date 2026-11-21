import { lazy, Suspense } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { Button } from './components/ui';
import { useAuth } from './lib/auth';
import { baseOf, homeOf, pathFor, positionOf } from './lib/home';
import { pageLoaders } from './lib/pageLoaders';
import { ForgotPassword, Login, ResetPassword } from './pages/auth/AuthPages';
import Profile from './pages/Profile';
import MyRequests from './pages/employee/MyRequests';
import Summary from './pages/employee/Summary';
import TeamCalendar from './pages/TeamCalendar';

const Landing = lazy(pageLoaders.Landing);
const Overview = lazy(pageLoaders.Overview);
const Team = lazy(pageLoaders.Team);
const AdminRequests = lazy(pageLoaders.AdminRequests);
const Employees = lazy(pageLoaders.Employees);
const EmployeeDetail = lazy(pageLoaders.EmployeeDetail);
const Setup = lazy(pageLoaders.Setup);
const Schedule = lazy(pageLoaders.Schedule);
const Organisation = lazy(pageLoaders.Organisation);
const LeaveTotalsPage = lazy(() => pageLoaders.LeaveTotals().then((module) => ({ default: module.LeaveTotalsPage })));
const DepartmentHome = lazy(pageLoaders.DepartmentHome);
const Register = lazy(pageLoaders.Register);
const WorkTracker = lazy(pageLoaders.WorkTracker);
const AcceptInvite = lazy(() => pageLoaders.JoinPages().then((module) => ({ default: module.AcceptInvite })));
const JoinDepartment = lazy(() => pageLoaders.JoinPages().then((module) => ({ default: module.JoinDepartment })));
// Development only: every sky of the dashboard's weather band, at /dev/sky.
const SkyGallery = import.meta.env.DEV ? lazy(() => import('./pages/dev/SkyGallery')) : null;

// The pages under each person's address (see lib/home.js), by position.
// '' is the page their address opens on.
const STAFF_PAGES = [
  ['requests', AdminRequests],
  ['calendar', TeamCalendar],
  ['upcoming', Schedule],
  ['department', Team],
  ['employees', Employees],
  ['employees/:id', EmployeeDetail],
  ['setup', Setup],
  ['profile', Profile],
  ['totals', LeaveTotalsPage],
  ['work', WorkTracker],
];

const PAGES = {
  employee: [
    ['', Summary],
    ['requests', MyRequests],
    ['totals', LeaveTotalsPage],
    ['department', Team],
    ['profile', Profile],
    ['work', WorkTracker],
  ],
  // Assistant managers and managers run their department and take leave too.
  assistantmanager: [
    ['', Overview],
    ...STAFF_PAGES,
    ['my-leave', Summary],
    ['my-requests', MyRequests],
    ['my-department/:id', DepartmentHome],
  ],
  // A manager also organises: adds departments and invites their AMs.
  manager: [
    ['', Overview],
    ['organisation', Organisation],
    ...STAFF_PAGES,
    ['my-leave', Summary],
    ['my-requests', MyRequests],
    ['my-department/:id', DepartmentHome],
  ],
  // HR opens on the organisation and sees the whole company.
  hr: [['', Organisation], ['overview', Overview], ...STAFF_PAGES, ['departments/:id', DepartmentHome]],
};

function Public({ children }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}

// While a page's code is on its way: the shape of a page (a heading, a line
// under it, and a panel of rows), so nothing jumps when it arrives.
function Loading() {
  const block = 'animate-pulse rounded-lg bg-sunken motion-reduce:animate-none';
  return (
    <div role="status" aria-label="Loading" className="space-y-4">
      <div className="space-y-2 pb-2">
        <div className={`h-7 w-48 ${block}`} />
        <div className={`h-4 w-72 max-w-full ${block}`} />
      </div>
      <div className="space-y-3 rounded-xl border border-line bg-surface p-5 shadow-card">
        {[0, 1, 2, 3, 4].map((row) => (
          <div key={row} className={`h-9 ${block}`} />
        ))}
      </div>
    </div>
  );
}

function ServerDown() {
  const { retry } = useAuth();
  return (
    <div className="grid min-h-dvh place-items-center px-5 text-center">
      <div>
        <h1 className="text-[22px] sm:text-2xl">We cannot reach the server</h1>
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
  if (!user) return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  return children;
}

function GuestOnly({ children }) {
  const { user, ready, unreachable } = useAuth();
  if (unreachable) return <ServerDown />;
  if (!ready) return null;
  if (user) return <Navigate to={homeOf(user)} replace />;
  return children;
}

function NotFound() {
  return (
    <div className="py-24 text-center">
      <h1 className="text-[22px] sm:text-2xl">This page is not in the register</h1>
      <Link to="/" className="mt-4 inline-block text-accent underline underline-offset-4">
        Back to the start
      </Link>
    </div>
  );
}

// Someone's own part of the app. Another person's address, or the wrong
// position, takes them to their own.
function PersonArea() {
  const { user } = useAuth();
  const location = useLocation();
  const base = baseOf(user);
  const here = decodeURIComponent(location.pathname);
  const mine = decodeURIComponent(base);
  if (here !== mine && !here.startsWith(`${mine}/`)) return <Navigate to={base} replace />;

  const relative = mine.replace(/^\/employee\//, '');
  return (
    <Routes>
      <Route path={relative} element={<AppShell />}>
        {PAGES[positionOf(user)].map(([path, Page]) => {
          const element = (
            <Suspense fallback={<Loading />}>
              <Page />
            </Suspense>
          );
          return path ? <Route key={path} path={path} element={element} /> : <Route key="home" index element={element} />;
        })}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

// The app's older addresses (in notifications, mails and bookmarks) move to
// the person's own ones.
function OldAddress() {
  const { user } = useAuth();
  const location = useLocation();
  const to = pathFor(user, `${location.pathname}${location.search}`);
  if (to) return <Navigate to={to} replace />;
  return <NotFound />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Public><Landing /></Public>} />
      <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
      <Route path="/forgot-password" element={<GuestOnly><ForgotPassword /></GuestOnly>} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/register" element={<GuestOnly><Public><Register /></Public></GuestOnly>} />
      <Route path="/join/invite/:token" element={<Public><AcceptInvite /></Public>} />
      <Route path="/join/:code" element={<Public><JoinDepartment /></Public>} />
      {SkyGallery && <Route path="/dev/sky" element={<Public><SkyGallery /></Public>} />}
      <Route path="/employee/*" element={<RequireAuth><PersonArea /></RequireAuth>} />
      <Route path="*" element={<RequireAuth><OldAddress /></RequireAuth>} />
    </Routes>
  );
}
