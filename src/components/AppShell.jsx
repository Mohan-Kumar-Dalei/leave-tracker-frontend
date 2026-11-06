import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  BookOpen,
  CalendarDays,
  Inbox,
  LayoutList,
  LogOut,
  ScrollText,
  Settings2,
  UserRound,
  Users,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useLiveUpdates } from '../hooks/useLiveUpdates';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { NotificationBell } from './NotificationBell';

const EMPLOYEE_NAV = [
  { to: '/', label: 'Summary', icon: BookOpen, end: true },
  { to: '/requests', label: 'Requests', icon: ScrollText },
];

const ADMIN_NAV = [
  { to: '/admin', label: 'Overview', icon: LayoutList, end: true },
  { to: '/admin/requests', label: 'Requests', icon: Inbox, badge: true },
  { to: '/admin/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/admin/employees', label: 'People', icon: Users },
  { to: '/admin/setup', label: 'Setup', icon: Settings2 },
];

const initials = (name) =>
  name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

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

  const itemClass = 'flex min-h-11 w-full items-center gap-3 px-4 text-sm text-ink hover:bg-bg';

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-label="Account menu"
        onClick={() => setOpen((value) => !value)}
        className="grid h-10 w-10 place-items-center rounded-full border border-line bg-surface text-sm font-medium hover:border-ink"
      >
        {initials(user.name)}
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-40 w-64 rounded border border-line bg-surface shadow-[0_12px_32px_-16px_rgba(28,35,33,0.4)]">
          <div className="border-b border-line px-4 py-3">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-sm text-muted">{user.email}</p>
          </div>
          {user.role === 'admin' && (
            <Link to="/" className={itemClass}>
              <BookOpen className="h-4 w-4 text-muted" strokeWidth={1.5} />
              My leave
            </Link>
          )}
          <Link to="/profile" className={itemClass}>
            <UserRound className="h-4 w-4 text-muted" strokeWidth={1.5} />
            Profile and password
          </Link>
          <button type="button" onClick={onSignOut} className={`${itemClass} border-t border-line`}>
            <LogOut className="h-4 w-4 text-muted" strokeWidth={1.5} />
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
  const nav = isAdmin ? ADMIN_NAV : EMPLOYEE_NAV;

  useLiveUpdates(true);

  const { data: overview } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: () => api.get('/admin/overview'),
    enabled: isAdmin,
  });
  const badge = overview?.pendingCount ?? 0;

  return (
    <div className="min-h-dvh pb-20 sm:pb-0">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-surface focus:px-3 focus:py-2">
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-line bg-bg">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-8 px-4 sm:px-8 lg:px-12">
          <Link to={isAdmin ? '/admin' : '/'} className="font-display text-[22px] tracking-tight whitespace-nowrap">
            Leave Tracker
          </Link>

          <nav aria-label="Main" className="hidden h-full items-stretch gap-1 sm:flex">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `relative flex items-center gap-2 px-3 text-sm font-medium transition-colors ${
                    isActive ? 'text-ink' : 'text-muted hover:text-ink'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {item.label}
                    {item.badge && badge > 0 && (
                      <span className="rounded-sm bg-accent px-1.5 text-xs tabular-nums text-on-accent">{badge}</span>
                    )}
                    {isActive && (
                      <motion.span
                        layoutId="nav-rule"
                        className="absolute inset-x-3 -bottom-px h-0.5 bg-accent"
                        transition={{ type: 'spring', stiffness: 480, damping: 38 }}
                      />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <NotificationBell />
            <UserMenu user={user} onSignOut={signOut} />
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-[1440px] px-4 py-8 sm:px-8 sm:py-12 lg:px-12">
        <Outlet />
      </main>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-bg pb-[env(safe-area-inset-bottom)] sm:hidden"
      >
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `relative flex min-h-16 flex-1 flex-col items-center justify-center gap-1 text-xs font-medium ${
                isActive ? 'text-accent' : 'text-muted'
              }`
            }
          >
            <item.icon className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
            {item.label}
            {item.badge && badge > 0 && (
              <span className="absolute left-1/2 top-1.5 ml-2 rounded-sm bg-accent px-1 text-[11px] tabular-nums text-on-accent">
                {badge}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
