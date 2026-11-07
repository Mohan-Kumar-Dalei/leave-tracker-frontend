import { useQuery } from '@tanstack/react-query';
import { CalendarCheck, CalendarDays, FileText, History, Inbox, KeyRound, LayoutGrid, LogOut, Settings2, UserRound, Users } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useLiveUpdates } from '../hooks/useLiveUpdates';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { NotificationBell } from './NotificationBell';

const PERSONAL_NAV = [
  { to: '/', label: 'My leave', icon: CalendarCheck, end: true },
  { to: '/requests', label: 'My requests', icon: FileText },
  { to: '/profile', label: 'Change password', short: 'Password', icon: KeyRound },
];

const ADMIN_NAV = [
  { to: '/admin', label: 'Overview', short: 'Overview', icon: LayoutGrid, end: true },
  { to: '/admin/requests', label: 'Leave requests', short: 'Requests', icon: Inbox, badge: true },
  { to: '/team-calendar', label: 'Team calendar', short: 'Calendar', icon: CalendarDays },
  { to: '/admin/schedule', label: 'Upcoming & past', short: 'Upcoming', icon: History },
  { to: '/admin/employees', label: 'Employees', short: 'Employees', icon: Users },
  { to: '/admin/setup', label: 'Setup', short: 'Setup', icon: Settings2 },
];

const initials = (name) =>
  name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

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

function UserMenu({ user, onSignOut }) {
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
      <button
        type="button"
        aria-expanded={open}
        aria-label="Account menu"
        onClick={() => setOpen((value) => !value)}
        className="grid h-9 w-9 place-items-center rounded-full bg-accent-soft text-[13px] font-semibold text-accent"
      >
        {initials(user.name)}
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-40 w-64 overflow-hidden rounded-xl border border-line bg-surface shadow-float">
          <div className="border-b border-line px-3 py-2.5">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-[13px] text-muted">{user.email}</p>
          </div>
          <Link to="/profile" className={itemClass}>
            <UserRound className="h-4 w-4 text-muted" aria-hidden="true" />
            Profile and password
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

export function AppShell() {
  const { user, signOut } = useAuth();
  const isAdmin = user.role === 'admin';
  const nav = isAdmin ? ADMIN_NAV : PERSONAL_NAV;

  useLiveUpdates(true);

  const { data: overview } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: () => api.get('/admin/overview'),
    enabled: isAdmin,
  });
  const badge = overview?.pendingCount ?? 0;

  return (
    <div className="min-h-dvh pb-20 lg:pb-0 lg:pl-60">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2">
        Skip to content
      </a>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-surface lg:flex">
        <Link to={isAdmin ? '/admin' : '/'} className="flex h-14 items-center px-4">
          <Logo />
        </Link>
        <nav aria-label="Main" className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
          {nav.map((item) => (
            <SideLink key={item.to} item={item} badge={badge} />
          ))}
        </nav>
      </aside>

      <header className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur lg:static lg:border-b-0 lg:bg-transparent lg:backdrop-blur-none">
        <div className="mx-auto flex h-14 max-w-[1240px] items-center justify-between gap-3 px-4 sm:px-6 lg:justify-end lg:px-8">
          <Link to={isAdmin ? '/admin' : '/'} className="lg:hidden">
            <Logo />
          </Link>
          <div className="flex items-center gap-1.5">
            <NotificationBell />
            <UserMenu user={user} onSignOut={signOut} />
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-[1240px] px-4 pb-10 pt-3 sm:px-6 lg:px-8 lg:pt-0">
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
