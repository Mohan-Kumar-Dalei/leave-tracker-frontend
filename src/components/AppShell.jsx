import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarCheck, ChevronsUpDown, House, LogOut, Menu, Moon, Network, Settings2, Sun, Target, UserRound, Users } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useLiveUpdates } from '../hooks/useLiveUpdates';
import { useSlider } from '../hooks/useSlider';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { APP_NAME, TAGLINE } from '../lib/brand';
import { homeOf, positionOf } from '../lib/home';
import { preloadPages } from '../lib/pageLoaders';
import { prefetchPage } from '../lib/prefetch';
import { askForLocation } from '../lib/deviceLocation';
import { setTheme, useTheme } from '../lib/theme';
import { NotificationBell } from './NotificationBell';
import { Avatar } from './ProfilePhoto';
import { IconButton } from './ui';

// The daily target sheet, for everyone.
const WORK_SECTION = { key: 'work', label: 'Work Tracker', icon: Target, items: [{ to: 'work', label: 'Work tracker' }] };

// The menu, Zoho style: a dark rail on the left with a few sections, and the
// section's pages as tabs along the top. `to` is the page under the person's
// own address (lib/home.js), '' being the page it opens on.
const EMPLOYEE_SECTIONS = [
  { key: 'home', label: 'Home', icon: House, items: [{ to: '', label: 'Dashboard', end: true }] },
  {
    key: 'leave',
    label: 'Leave Tracker',
    icon: CalendarCheck,
    items: [
      { to: 'requests', label: 'My requests' },
      { to: 'totals', label: 'Leave totals' },
    ],
  },
  WORK_SECTION,
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
    { to: 'totals', label: 'Leave totals' },
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
    WORK_SECTION,
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

// The name, with the line under it where there is room (`tagline`).
export function Logo({ tagline = false }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className={`grid shrink-0 place-items-center rounded-lg bg-accent text-on-accent ${tagline ? 'h-9 w-9' : 'h-7 w-7'}`}>
        <CalendarCheck className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold leading-tight tracking-tight">{APP_NAME}</span>
        {tagline && <span className="block text-xs leading-snug text-muted">{TAGLINE}</span>}
      </span>
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
          <button
            type="button"
            onClick={onSignOut}
            className="group flex h-10 w-full items-center gap-2.5 border-t border-line px-3 text-sm text-ink transition-colors hover:bg-rejected-soft hover:text-rejected max-sm:h-11"
          >
            <LogOut className="h-4 w-4 text-muted transition-colors group-hover:text-rejected" aria-hidden="true" />
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

const POSITION_NAME = { employee: 'Employee', assistantmanager: 'Assistant Manager', manager: 'Manager', hr: 'HR' };

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

// The tabs of the open section, along the top. The blue line slides to the
// tab you press at once (a CSS transform, so it glides even while the next
// page is drawn), and pointing at a tab starts fetching that page's data.
function SectionTabs({ section, home, badge, onWarm }) {
  const { pathname } = useLocation();
  const active = section.items.findIndex((item) => isOpen(item, home, pathname));
  const { track, marker, itemRef, slideTo } = useSlider(active, { kind: 'line', inset: 12 });
  return (
    <nav
      ref={track}
      aria-label={section.label}
      className="relative flex min-w-0 items-stretch gap-1 overflow-x-auto [scrollbar-width:none]"
    >
      {section.items.map((item, index) => (
        <NavLink
          key={item.to}
          ref={itemRef(index)}
          to={item.to ? `${home}/${item.to}` : home}
          end={item.end}
          onPointerEnter={() => onWarm(item.to)}
          onFocus={() => onWarm(item.to)}
          onPointerDown={() => slideTo(index)}
          onClick={() => slideTo(index)}
          className={({ isActive }) =>
            `relative my-2 flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-sm font-medium transition-colors duration-200 ${
              isActive ? 'text-ink' : 'text-muted hover:bg-sunken hover:text-ink'
            }`
          }
        >
          {item.label}
          {item.badge && <Badge count={badge} />}
        </NavLink>
      ))}
      <span
        ref={marker}
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-0 h-[2.5px] w-[100px] origin-left rounded-full bg-accent opacity-0 transition-[transform,opacity] duration-[380ms] ease-[var(--ease-calm)] motion-reduce:transition-none"
      />
    </nav>
  );
}

export function AppShell() {
  const { user, signOut } = useAuth();
  const { pathname } = useLocation();
  const position = positionOf(user);
  const isAdmin = user.role === 'admin';
  // The rail opens with the section names, or folds to icons; remembered.
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem('lt-rail') !== 'folded';
    } catch {
      return true;
    }
  });
  const toggleRail = () =>
    setOpen((value) => {
      try {
        localStorage.setItem('lt-rail', value ? 'folded' : 'open');
      } catch {
        // Storage may be off; it simply is not remembered.
      }
      return !value;
    });
  const home = homeOf(user);

  // Whoever runs a department gets a "My department" page to invite and
  // approve their team; a manager can switch to any department there.
  const { data: mine } = useQuery({
    queryKey: ['my-departments'],
    queryFn: () => api.get('/departments/mine'),
    enabled: user.role !== 'owner',
  });
  const myDepartment = mine?.items?.[0];
  // The work tracker shows only where a department has turned it on.
  const sections = (
    position === 'hr' ? HR_SECTIONS : isAdmin ? staffSections({ manager: position === 'manager', myDepartment }) : EMPLOYEE_SECTIONS
  ).filter((section) => section.key !== 'work' || user.workTracker);
  const current = sections.find((section) => section.items.some((item) => isOpen(item, home, pathname))) ?? sections[0];

  useLiveUpdates(true);
  // Ask for the person's location as the app opens, for the weather on the
  // dashboard. The browser asks once and remembers the answer for the site.
  useEffect(() => askForLocation(), []);

  const { data: overview } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: () => api.get('/admin/overview'),
    enabled: isAdmin || user.role === 'owner',
  });
  const badge = overview?.pendingCount ?? 0;
  const sectionBadge = (section) => (section.items.some((item) => item.badge) ? badge : 0);
  const firstPage = (section) => (section.items[0].to ? `${home}/${section.items[0].to}` : home);

  // Every request to the live server takes about a third of a second, so the
  // app fetches ahead: a page's data as soon as its tab or section is pointed
  // at, and, once the open page has settled, the code for every page and the
  // data for the open section's other tabs.
  const queryClient = useQueryClient();
  const warm = (path) => prefetchPage(queryClient, position, path);
  useEffect(() => {
    const later = window.requestIdleCallback ?? ((run) => setTimeout(run, 1200));
    const cancel = window.cancelIdleCallback ?? clearTimeout;
    const handle = later(() => {
      preloadPages();
      for (const item of current.items) prefetchPage(queryClient, position, item.to);
    });
    return () => cancel(handle);
    // The section's items are rebuilt each render; its key says when it changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.key, position, queryClient]);

  return (
    <div
      className={`min-h-dvh pb-20 transition-[padding] duration-300 ease-[var(--ease-calm)] lg:pb-0 ${open ? 'lg:pl-60' : 'lg:pl-[76px]'}`}
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2"
      >
        Skip to content
      </a>

      {/* The rail: the app's sections on a dark band down the left. The
          menu button folds it to icons only, or opens it with the names. */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden flex-col overflow-hidden border-r border-white/5 bg-[linear-gradient(180deg,#1b2654_0%,#141c42_55%,#0f1534_100%)] text-white transition-[width] duration-300 ease-[var(--ease-calm)] lg:flex ${
          open ? 'w-60' : 'w-[76px]'
        }`}
      >
        <div className={`relative flex h-[4.5rem] shrink-0 items-center gap-2 ${open ? 'px-4' : 'justify-center px-2'}`}>
          <button
            type="button"
            onClick={toggleRail}
            aria-label={open ? 'Fold the menu' : 'Open the menu'}
            aria-expanded={open}
            title={open ? 'Fold the menu' : 'Open the menu'}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
          {open && (
            <Link to={home} title={`${APP_NAME}: ${TAGLINE}`} className="flex min-w-0 items-center gap-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent text-on-accent shadow-[0_6px_18px_-6px_var(--color-accent)]">
                <CalendarCheck className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-semibold leading-tight tracking-tight">{APP_NAME}</span>
                <span className="block text-[10.5px] leading-snug text-white/55">{TAGLINE}</span>
              </span>
            </Link>
          )}
        </div>

        <nav aria-label="Sections" className={`relative flex flex-1 flex-col gap-1 overflow-y-auto py-3 ${open ? 'px-3' : 'px-2'}`}>
          {open && <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40">Menu</p>}
          {sections.map((section) => {
            const active = section.key === current.key;
            const count = sectionBadge(section);
            return (
              <Link
                key={section.key}
                to={firstPage(section)}
                onPointerEnter={() => warm(section.items[0].to)}
                onFocus={() => warm(section.items[0].to)}
                aria-current={active ? 'page' : undefined}
                aria-label={open ? undefined : section.label}
                title={open ? undefined : section.label}
                className={`group relative flex items-center rounded-xl transition-colors ${
                  open ? 'gap-3 px-2.5 py-2' : 'justify-center py-2'
                } ${active ? 'bg-white/[0.12] text-white' : 'text-white/70 hover:bg-white/[0.06] hover:text-white'}`}
              >
                {active && <span aria-hidden="true" className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-accent" />}
                <span
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-colors ${
                    active ? 'bg-accent text-on-accent' : 'bg-white/[0.06] group-hover:bg-white/10'
                  }`}
                >
                  <section.icon className="h-[18px] w-[18px]" aria-hidden="true" />
                </span>
                {open && <span className="truncate text-sm font-medium">{section.label}</span>}
                {count > 0 &&
                  (open ? (
                    <Badge count={count} className="ml-auto" />
                  ) : (
                    <span className="absolute right-3 top-1.5 h-2 w-2 rounded-full bg-accent ring-2 ring-[#16204a]" aria-hidden="true" />
                  ))}
              </Link>
            );
          })}
        </nav>

        {/* Who is signed in, at the foot of the rail. */}
        <Link
          to={`${home}/profile`}
          title={open ? undefined : user.name}
          className={`relative m-3 flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.05] p-2 transition-colors hover:bg-white/10 ${
            open ? '' : 'justify-center'
          }`}
        >
          <Avatar user={user} size={32} />
          {open && (
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{user.name}</span>
              <span className="block truncate text-xs text-white/55">{POSITION_NAME[position] ?? 'Employee'}</span>
            </span>
          )}
        </Link>
      </aside>

      {/* The top: the open section's pages as tabs, and the account on the
          right. On phones the logo row sits above the tabs. */}
      {/* Above the pages' own sticky tops (z-20), so the account menu opens over them. */}
      <header className="sticky top-0 z-30 border-b border-line bg-surface">
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
          <SectionTabs key={current.label} section={current} home={home} badge={badge} onWarm={warm} />
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
      <nav
        aria-label="Sections"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        {sections.map((section) => {
          const active = section.key === current.key;
          return (
            <Link
              key={section.key}
              to={firstPage(section)}
              onPointerDown={() => warm(section.items[0].to)}
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
