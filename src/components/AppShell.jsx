import { useQuery } from '@tanstack/react-query';
import { Building2, CalendarCheck, CalendarDays, ChevronsUpDown, FileText, History, Inbox, LayoutGrid, LogOut, Moon, Network, Settings2, Sun, UserRound, Users } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useLiveUpdates } from '../hooks/useLiveUpdates';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { homeOf, positionOf } from '../lib/home';
import { setTheme, useTheme } from '../lib/theme';
import { NotificationBell } from './NotificationBell';
import { Avatar } from './ProfilePhoto';
import { IconButton } from './ui';

// Menus by position. `to` is the page under the person's own address
// (lib/home.js), '' being the page it opens on.
const PERSONAL_NAV = [
  { to: '', label: 'Dashboard', icon: LayoutGrid, end: true },
  { to: 'requests', label: 'My requests', icon: FileText },
  { to: 'department', label: 'Department', short: 'Department', icon: Network },
  { to: 'profile', label: 'Profile', short: 'Profile', icon: UserRound },
];

const STAFF_NAV = [
  { to: 'requests', label: 'Leave requests', short: 'Requests', icon: Inbox, badge: true },
  { to: 'calendar', label: 'Team calendar', short: 'Calendar', icon: CalendarDays },
  { to: 'upcoming', label: 'Upcoming & past', short: 'Upcoming', icon: History },
  { to: 'department', label: 'Department', short: 'Department', icon: Network },
  { to: 'employees', label: 'Employees', short: 'Employees', icon: Users },
  { to: 'setup', label: 'Setup', short: 'Setup', icon: Settings2 },
];

// Assistant managers and managers see their department; they take leave too,
// so they also have My leave.
const ADMIN_NAV = [
  { to: '', label: 'Overview', short: 'Overview', icon: LayoutGrid, end: true },
  ...STAFF_NAV,
  { to: 'my-leave', label: 'My leave', short: 'My leave', icon: CalendarCheck },
];

// HR runs the organisation and sees the whole company's leave.
const OWNER_NAV = [
  { to: '', label: 'Organisation', short: 'Organisation', icon: Building2, end: true },
  { to: 'overview', label: 'Overview', short: 'Overview', icon: LayoutGrid },
  ...STAFF_NAV,
];

export function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-on-accent">
        <CalendarCheck className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
      </span>
      <span className="text-[15px] font-semibold tracking-tight">Leave Tracker</span>
    </span>
  );
}

function SideLink({ item, badge }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        `flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium transition-colors ${
          isActive ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-sunken hover:text-ink'
        }`
      }
    >
      <item.icon className="h-[18px] w-[18px]" aria-hidden="true" />
      {item.label}
      {item.badge && badge > 0 && (
        <span className="ml-auto rounded-full bg-accent px-1.5 text-[11px] font-medium leading-[18px] tabular-nums text-on-accent">{badge}</span>
      )}
    </NavLink>
  );
}

// The account menu: an avatar in the top bar on phones; in the desktop
// sidebar (`inSidebar`) a card with the name, whose menu opens upwards.
function UserMenu({ user, onSignOut, inSidebar = false }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => {
      if (!root.current?.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const itemClass = 'flex h-10 w-full items-center gap-2.5 px-3 text-sm text-ink hover:bg-bg max-sm:h-11';

  return (
    <div ref={root} className="relative">
      {inSidebar ? (
        <button
          type="button"
          aria-expanded={open}
          aria-label="Account menu"
          onClick={() => setOpen((value) => !value)}
          className={`flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition-colors ${
            open ? 'bg-sunken' : 'hover:bg-sunken'
          }`}
        >
          <Avatar user={user} size={34} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{user.name}</span>
            <span className="block truncate text-xs text-muted">{user.email}</span>
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
        </button>
      ) : (
        <button
          type="button"
          aria-expanded={open}
          aria-label="Account menu"
          onClick={() => setOpen((value) => !value)}
          className="rounded-full"
        >
          <Avatar user={user} size={36} />
        </button>
      )}
      {open && (
        <div
          className={`absolute z-40 overflow-hidden rounded-xl border border-line bg-surface shadow-float ${
            inSidebar ? 'inset-x-0 bottom-full mb-2' : 'right-0 top-11 w-64'
          }`}
        >
          <div className="border-b border-line px-3 py-2.5">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-[13px] text-muted">{user.email}</p>
          </div>
          <Link to={`${homeOf(user)}/profile`} className={itemClass}>
            <UserRound className="h-4 w-4 text-muted" aria-hidden="true" />
            Profile, Gmail and password
          </Link>
          <button type="button" onClick={onSignOut} className={`${itemClass} border-t border-line`}>
            <LogOut className="h-4 w-4 text-muted" aria-hidden="true" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function ThemeSwitch({ inSidebar = false }) {
  const dark = useTheme() === 'dark';
  const Icon = dark ? Sun : Moon;
  if (inSidebar) {
    return (
      <button
        type="button"
        onClick={() => setTheme(dark ? 'light' : 'dark')}
        className="flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium text-muted transition-colors hover:bg-sunken hover:text-ink"
      >
        <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
        {dark ? 'Light mode' : 'Dark mode'}
      </button>
    );
  }
  return (
    <IconButton label={dark ? 'Switch to light mode' : 'Switch to dark mode'} onClick={() => setTheme(dark ? 'light' : 'dark')}>
      <Icon className="h-[18px] w-[18px]" />
    </IconButton>
  );
}

export function AppShell() {
  const { user, signOut } = useAuth();
  const isAdmin = user.role === 'admin';
  const home = homeOf(user);

  // Whoever manages a department (its manager or assistant manager) gets a
  // "My department" page to invite and approve their team.
  const { data: mine } = useQuery({
    queryKey: ['my-departments'],
    queryFn: () => api.get('/departments/mine'),
    enabled: user.role !== 'owner',
  });
  const myDepartment = mine?.items?.[0];
  const baseNav =
    user.role === 'owner'
      ? OWNER_NAV
      : positionOf(user) === 'manager'
        ? [ADMIN_NAV[0], { to: 'organisation', label: 'Organisation', short: 'Organisation', icon: Building2 }, ...ADMIN_NAV.slice(1)]
        : isAdmin
          ? ADMIN_NAV
          : PERSONAL_NAV;
  const pages = myDepartment
    ? [...baseNav, { to: `my-department/${myDepartment.id}`, label: 'My department', short: 'My dept', icon: Building2 }]
    : baseNav;
  // Every link points under the person's own address, e.g. /employee/CON-030/requests.
  const nav = pages.map((item) => ({ ...item, to: item.to ? `${home}/${item.to}` : home, end: item.end ?? !item.to }));

  useLiveUpdates(true);

  const { data: overview } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: () => api.get('/admin/overview'),
    enabled: isAdmin || user.role === 'owner',
  });
  const badge = overview?.pendingCount ?? 0;

  return (
    <div className="min-h-dvh pb-20 lg:pb-0 lg:pl-60">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2">
        Skip to content
      </a>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-surface lg:flex">
        <Link to={home} className="flex h-14 items-center px-4">
          <Logo />
        </Link>
        <nav aria-label="Main" className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
          {nav.map((item) => (
            <SideLink key={item.to} item={item} badge={badge} />
          ))}
        </nav>
        {/* Notifications, the theme and the account sit at the foot of the
            sidebar on desktop, so the page has the whole width and height. */}
        <div className="space-y-0.5 border-t border-line px-3 py-3">
          <NotificationBell inSidebar />
          <ThemeSwitch inSidebar />
          <div className="pt-2">
            <UserMenu user={user} onSignOut={signOut} inSidebar />
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur lg:hidden">
        <div className="mx-auto flex h-14 max-w-[1240px] items-center justify-between gap-3 px-4 sm:px-6">
          <Link to={home}>
            <Logo />
          </Link>
          <div className="flex items-center gap-1.5">
            <ThemeSwitch />
            <NotificationBell />
            <UserMenu user={user} onSignOut={signOut} />
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-[1240px] px-4 pb-10 pt-3 sm:px-6 lg:px-8 lg:pt-8">
        <Outlet />
      </main>

      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `relative flex min-h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium max-[359px]:text-[9px] ${
                isActive ? 'text-accent' : 'text-muted'
              }`
            }
          >
            <item.icon className="h-5 w-5" aria-hidden="true" />
            {item.short ?? item.label}
            {item.badge && badge > 0 && (
              <span className="absolute left-1/2 top-1.5 ml-1.5 rounded-full bg-accent px-1 text-[10px] leading-4 tabular-nums text-on-accent">{badge}</span>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
