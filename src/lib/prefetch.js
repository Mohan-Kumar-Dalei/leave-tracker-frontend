import { api } from './api';

// The first data each page asks for, under the same keys the pages use, so a
// page opened after its tab was pointed at (or after the app fetched it in the
// background) shows at once instead of waiting on the server. Every request
// to the live server costs about a third of a second, so this matters.
//
// `path` is the page under the person's own address: '' for the page they
// open on, 'requests', 'my-department/<id>' and so on.
function queriesFor(position, path) {
  const staff = position !== 'employee';
  const [page, id] = path.split('/');
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const summary = { queryKey: ['summary', null], url: '/me/summary' };
  const myLeaves = { queryKey: ['my-leaves', 'all', 1], url: '/me/leaves?page=1&limit=10' };

  switch (page) {
    case '':
      return staff ? [{ queryKey: ['admin-overview'], url: '/admin/overview' }] : [summary];
    case 'my-leave':
      return [summary];
    case 'my-requests':
      return [myLeaves];
    case 'requests':
      return staff
        ? [
            {
              queryKey: ['admin-leaves', { status: 'pending', leaveType: '', q: '', department: '' }, 1],
              url: '/admin/leaves?status=pending&page=1&limit=15',
            },
          ]
        : [myLeaves];
    case 'calendar':
      return [{ queryKey: ['team-calendar', now.getFullYear(), now.getMonth()], url: `/team-calendar?month=${month}` }];
    case 'upcoming':
      return [{ queryKey: ['admin-schedule', null], url: '/admin/schedule' }];
    case 'totals':
      return [{ queryKey: ['team-totals', 'all', null, null], url: '/team/totals' }];
    case 'organisation':
      return [{ queryKey: ['organisation'], url: '/org' }];
    case 'my-department':
      return id ? [{ queryKey: ['department', id], url: `/departments/${id}` }] : [];
    case 'department':
      return [{ queryKey: ['team'], url: '/team' }];
    case 'employees':
      return staff && !id ? [{ queryKey: ['employees', '', 'active', 1], url: '/admin/employees?status=active&page=1&limit=200' }] : [];
    case 'setup':
      return [
        { queryKey: ['leave-types'], url: '/leave-types' },
        { queryKey: ['holidays', String(now.getFullYear())], url: `/holidays?year=${now.getFullYear()}` },
      ];
    default:
      return [];
  }
}

// Fetches a page's data unless it is already fresh in the cache.
export function prefetchPage(queryClient, position, path) {
  for (const { queryKey, url } of queriesFor(position, path ?? '')) {
    queryClient.prefetchQuery({ queryKey, queryFn: () => api.get(url) }).catch(() => {});
  }
}
