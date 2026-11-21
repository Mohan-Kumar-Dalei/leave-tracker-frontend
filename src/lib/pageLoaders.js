// The code for each page, loaded on first use. The app also loads them all in
// the background once it is idle (preloadPages), so opening a page never
// waits for its code to download.
export const pageLoaders = {
  Landing: () => import('../pages/Landing'),
  Overview: () => import('../pages/admin/Overview'),
  Team: () => import('../pages/Team'),
  AdminRequests: () => import('../pages/admin/AdminRequests'),
  Employees: () => import('../pages/admin/Employees'),
  EmployeeDetail: () => import('../pages/admin/EmployeeDetail'),
  Setup: () => import('../pages/admin/Setup'),
  Schedule: () => import('../pages/admin/Schedule'),
  Organisation: () => import('../pages/org/Organisation'),
  LeaveTotals: () => import('../components/LeaveTotals'),
  DepartmentHome: () => import('../pages/org/DepartmentHome'),
  Register: () => import('../pages/org/Register'),
  JoinPages: () => import('../pages/org/JoinPages'),
  WorkTracker: () => import('../pages/work/WorkTracker'),
};

// The pages someone signed in can open (not the public ones).
const SIGNED_IN = ['Overview', 'Team', 'AdminRequests', 'Employees', 'EmployeeDetail', 'Setup', 'Schedule', 'Organisation', 'LeaveTotals', 'DepartmentHome', 'WorkTracker'];

let preloaded = false;
export function preloadPages() {
  if (preloaded) return;
  preloaded = true;
  for (const name of SIGNED_IN) pageLoaders[name]().catch(() => {});
}
