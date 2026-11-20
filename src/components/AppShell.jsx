import { useQuery } from '@tanstack/react-query';
import { CalendarCheck, ChevronsUpDown, House, LogOut, Moon, Network, Settings2, Sun, UserRound, Users } from 'lucide-react';
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

// The menu, Zoho style: a dark rail on the left with a few sections, and the
// section's pages as tabs along the top. `to` is the page under the person's
// own address (lib/home.js), '' being the page it opens on.
const EMPLOYEE_SECTIONS = [
  {
    key: 'home',
    label: 'Home',
    icon: House,
    items: [
      { to: '', label: 'Dashboard', end: true },
      { to: 'requests', label: 'My requests' },
    ],
  },
  { key: 'people', label: 'Department', icon: Network, items: [{ to: 'department', label: 'Department' }] },
  { key: 'me', label: 'Profile', icon: UserRound, items: [{ to: 'profile', label: 'Profile' }] },
];

const LEAVE_SECTION = {
  key: 'leave',
  label: 'Leave Tracker',
  icon: CalendarCheck,
  items: [
    { to: 'requests', label: 'Leave requests', badge: true },
    { to: 'calendar', label: 'Team calendar' },
    { to: 'upcoming', label: 'Upcoming & past' },
  ],
};

const SETTINGS_SECTION = {
  key: 'settings',
  label: 'Settings',
  icon: Settings2,
  items: [
    { to: 'setup', label: 'Setup' },
    { to: 'profile', label: 'Profile' },
  ],
};

// Assistant managers and managers: their own leave under Home, the team's
// leave, their people (a manager also organises the company), and settings.
function staffSections({ manager, myDepartment }) {
  return [
    {
      key: 'home',
      label: 'Home',
      icon: House,
      items: [
        { to: '', label: 'Overview', end: true },
        { to: 'my-leave', label: 'My leave' },
        { to: 'my-requests', label: 'My requests' },
      ],
    },
    LEAVE_SECTION,
    {
      key: 'people',
      label: 'People',
      icon: Users,
      items: [
        ...(manager ? [{ to: 'organisation', label: 'Organisation' }] : []),
        ...(myDepartment ? [{ to: `my-department/${myDepartment.id}`, match: 'my-department', label: 'My department' }] : []),
        { to: 'department', label: 'Department' },
        { to: 'employees', label: 'Employees' },
      ],
    },
    SETTINGS_SECTION,
  ];
}

// HR (turned off for now) would open on the organisation.
const HR_SECTIONS = [
  {
    key: 'home',
    label: 'Home',
    icon: House,
    items: [
      { to: '', label: 'Organisation', end: true },
      { to: 'overview', label: 'Overview' },
    ],
  },
  LEAVE_SECTION,
  {
    key: 'people',
    label: 'People',
    icon: Users,
    items: [
      { to: 'department', label: 'Department' },
      { to: 'employees', label: 'Employees' },
    ],
  },
  SETTINGS_SECTION,
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

// Whether a page of a section is the one open.
function isOpen(item, home, pathname) {
  const path = `${home}${item.to ? `/${item.match ?? item.to}` : ''}`;
  return item.end ? pathname === path || pathname === `${path}/` : pathname === path || pathname.startsWith(`${path}/`);
}

function Badge({ count, className = '' }) {
  if (!count) return null;
  return (
    <span className={`rounded-full bg-accent px-1.5 text-[10px] font-semibold leading-4 tabular-nums text-on-accent ${className}`}>
      {count}
    </span>
  );
}

// The tabs of the open section, along the top.
function SectionTabs({ section, home, badge }) {
  return (
    <nav aria-label={section.label} className="flex min-w-0 items-stretch gap-1 overflow-x-auto [scrollbar-width:none]">
      {section.items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to ? `${home}/${item.to}` : home}
          end={item.end}
          className={({ isActive }) =>
            `relative flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 text-sm font-medium transition-colors ${
              isActive
                ? 'text-ink after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-accent'
                : 'text-muted hover:text-ink'
            }`
          }
        >
          {item.label}
          {item.badge && <Badge count={badge} />}
        </NavLink>
      ))}
    </nav>
  );
}

export function AppShell() {
  const { user, signOut } = useAuth();
  const { pathname } = useLocation();
  const position = positionOf(user);
  const isAdmin = user.role === 'admin';
  const home = homeOf(user);

  // Whoever runs a department gets a "My department" page to invite and
  // approve their team; a manager can switch to any department there.
  const { data: mine } = useQuery({
    queryKey: ['my-departments'],
    queryFn: () => api.get('/departments/mine'),
    enabled: user.role !== 'owner',
  });
  const myDepartment = mine?.items?.[0];
  const sections =
    position === 'hr'
      ? HR_SECTIONS
      : isAdmin
        ? staffSections({ manager: position === 'manager', myDepartment })
        : EMPLOYEE_SECTIONS;
  const current =
    sections.find((section) => section.items.some((item) => isOpen(item, home, pathname))) ?? sections[0];

  useLiveUpdates(true);

  const { data: overview } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: () => api.get('/admin/overview'),
    enabled: isAdmin || user.role === 'owner',
  });
  const badge = overview?.pendingCount ?? 0;
  const sectionBadge = (section) => (section.items.some((item) => item.badge) ? badge : 0);
  const firstPage = (section) => (section.items[0].to ? `${home}/${section.items[0].to}` : home);

  return (
    <div className="min-h-dvh pb-20 lg:pb-0 lg:pl-[84px]">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2">
        Skip to content
      </a>

      {/* The rail: the app's sections, on a dark band down the left. */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[84px] flex-col items-center bg-[#16204a] py-3 lg:flex">
        <Link to={home} aria-label="Leave Tracker home" className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-accent text-on-accent">
          <CalendarCheck className="h-5 w-5" strokeWidth={2.25} aria-hidden="true" />
        </Link>
        <nav aria-label="Sections" className="flex w-full flex-1 flex-col items-center gap-1 overflow-y-auto px-1.5">
          {sections.map((section) => {
            const active = section.key === current.key;
            return (
              <Link
                key={section.key}
                to={firstPage(section)}
                aria-current={active ? 'page' : undefined}
                className="group relative flex w-full flex-col items-center gap-1 rounded-xl py-2 text-center"
              >
                <span
                  className={`grid h-10 w-10 place-items-center rounded-xl transition-colors ${
                    active ? 'bg-white text-[#16204a]' : 'bg-white/10 text-white/80 group-hover:bg-white/20 group-hover:text-white'
                  }`}
                >
                  <section.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className={`text-[11px] font-medium leading-tight ${active ? 'text-white' : 'text-white/70 group-hover:text-white'}`}>
                  {section.label}
                </span>
                {sectionBadge(section) > 0 && <Badge count={sectionBadge(section)} className="absolute right-2.5 top-1.5" />}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* The top: the open section's pages as tabs, and the account on the
          right. On phones the logo row sits above the tabs. */}
      <header className="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur">
        <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6 lg:hidden">
          <Link to={home}>
            <Logo />
          </Link>
          <div className="flex items-center gap-1.5">
            <ThemeSwitch />
            <NotificationBell />
            <UserMenu user={user} onSignOut={signOut} />
          </div>
        </div>
        <div className="flex h-11 items-stretch justify-between gap-3 px-2 sm:px-4 lg:h-14 lg:px-6">
          <SectionTabs section={current} home={home} badge={badge} />
          <div className="hidden items-center gap-1.5 lg:flex">
            <ThemeSwitch />
            <NotificationBell />
            <UserMenu user={user} onSignOut={signOut} />
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-[1240px] px-4 pb-10 pt-3 sm:px-6 lg:px-8 lg:pt-8">
        <Outlet />
      </main>

      {/* Phones: the sections along the bottom. */}
      <nav aria-label="Sections" className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden">
        {sections.map((section) => {
          const active = section.key === current.key;
          return (
            <Link
              key={section.key}
              to={firstPage(section)}
              aria-current={active ? 'page' : undefined}
              className={`relative flex min-h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium ${
                active ? 'text-accent' : 'text-muted'
              }`}
            >
              <section.icon className="h-5 w-5" aria-hidden="true" />
              <span className="truncate px-1">{section.label}</span>
              {sectionBadge(section) > 0 && <Badge count={sectionBadge(section)} className="absolute left-1/2 top-1.5 ml-1.5" />}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
