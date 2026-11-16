// Everyone's pages live under their own address, named by their position and
// employee ID:
//   employee           /employee/CON-030
//   assistant manager  /employee/assistantmanager/CON-001
//   manager            /employee/manager/CON-040
//   HR                 /employee/hr/CON-041
// The page itself follows, e.g. /employee/CON-030/requests.

const SEGMENT = { employee: '', assistantmanager: 'assistantmanager/', manager: 'manager/', hr: 'hr/' };

export const positionOf = (user) =>
  SEGMENT[user?.position] !== undefined
    ? user.position
    : user?.role === 'owner'
      ? 'hr'
      : user?.role === 'admin'
        ? 'assistantmanager'
        : 'employee';

export const isStaff = (user) => positionOf(user) !== 'employee';

export const baseOf = (user) => `/employee/${SEGMENT[positionOf(user)]}${encodeURIComponent(user.employeeId ?? '')}`;

// Where each person starts after signing in.
export const homeOf = (user) => baseOf(user);

// The app's older addresses (in notifications, mails and bookmarks) and where
// they live now. Returns null for an address it does not know.
export function pathFor(user, address) {
  const url = new URL(address, 'http://app.local');
  const base = baseOf(user);
  const position = positionOf(user);
  const hr = position === 'hr';
  const staff = position !== 'employee';
  const at = (suffix) => `${base}${suffix ? `/${suffix}` : ''}${url.search}`;
  const path = url.pathname.replace(/\/+$/, '') || '/';

  if (path === '/') return at(staff && !hr ? 'my-leave' : '');
  if (path === '/requests') return at(staff ? (hr ? 'requests' : 'my-requests') : 'requests');
  if (path === '/team') return at('department');
  if (path === '/profile') return at('profile');
  if (path === '/organisation') return at(hr ? '' : position === 'manager' ? 'organisation' : '');
  if (path === '/admin') return at(hr ? 'overview' : staff ? '' : '');
  if (path === '/admin/requests') return at(staff ? 'requests' : 'requests');
  if (path === '/admin/schedule') return at(staff ? 'upcoming' : '');
  if (path === '/admin/setup') return at(staff ? 'setup' : '');
  if (path === '/team-calendar') return at(staff ? 'calendar' : '');
  if (path === '/admin/employees') return at(staff ? 'employees' : '');
  const employee = path.match(/^\/admin\/employees\/([^/]+)$/);
  if (employee) return at(staff ? `employees/${employee[1]}` : '');
  const department = path.match(/^\/departments\/([^/]+)$/);
  if (department) return at(hr ? `departments/${department[1]}` : staff ? `my-department/${department[1]}` : '');
  return null;
}
