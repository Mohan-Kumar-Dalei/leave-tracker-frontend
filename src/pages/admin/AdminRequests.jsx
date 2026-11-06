import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Download, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs } from '../../components/Tabs';
import { ReviewList } from '../../components/ReviewList';
import { Empty, LoadError, PageHeading, Pagination, Panel, Reveal, RowsSkeleton, SelectBox } from '../../components/ui';
import { api, toQuery } from '../../lib/api';

const TABS = [
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'all', label: 'All' },
];

export default function AdminRequests() {
  const [params, setParams] = useSearchParams();
  const status = TABS.some((tab) => tab.id === params.get('status')) ? params.get('status') : 'pending';
  const [page, setPage] = useState(1);
  const [leaveType, setLeaveType] = useState('');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const query = { status: status === 'all' ? '' : status, leaveType, q };

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['admin-leaves', query, page],
    queryFn: () => api.get(`/admin/leaves${toQuery({ ...query, page, limit: 15 })}`),
    placeholderData: keepPreviousData,
  });

  const { data: types } = useQuery({ queryKey: ['leave-types'], queryFn: () => api.get('/leave-types') });

  return (
    <div>
      <PageHeading
        title="Leave requests"
        actions={
          <a
            href={`/api/admin/leaves.csv${toQuery(query)}`}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-surface px-3.5 text-sm font-medium shadow-card hover:bg-bg"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Export CSV
          </a>
        }
      >
        Approve or reject requests. The employee hears about it by mail and on their dashboard.
      </PageHeading>

      <Reveal delay={0.08}>
        <Tabs
          label="Filter by status"
          tabs={TABS}
          value={status}
          onChange={(next) => {
            setParams({ status: next });
            setPage(1);
          }}
          className="mb-4"
        />

        <div className="mb-4 flex flex-wrap gap-3">
          <label className="relative min-w-56 flex-1 sm:max-w-sm">
            <span className="sr-only">Search by name or employee ID</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input
              type="search"
              maxLength={80}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name or employee ID"
              className="min-h-11 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-base placeholder:text-muted focus:border-accent focus:outline-none sm:text-sm"
            />
          </label>
          <SelectBox
            aria-label="Filter by leave type"
            value={leaveType}
            onChange={(event) => {
              setLeaveType(event.target.value);
              setPage(1);
            }}
            className="w-full sm:w-64"
          >
            <option value="">All leave types</option>
            {types?.items.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </SelectBox>
        </div>

        <Panel>
          {isPending && <RowsSkeleton />}
          {isError && <LoadError error={error} onRetry={refetch} />}
          {data?.items.length === 0 && (
            <Empty title={status === 'pending' ? 'All caught up' : 'No requests match'}>
              {status === 'pending' ? 'New requests appear here as soon as they are sent.' : 'Try another filter.'}
            </Empty>
          )}
          {data && <ReviewList key={status} items={data.items} keepFinished={status !== 'pending'} />}
          {data && <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} />}
        </Panel>
      </Reveal>
    </div>
  );
}
