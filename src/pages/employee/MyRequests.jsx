import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Tabs } from '../../components/Tabs';
import { ApplyLeaveDialog } from '../../components/ApplyLeave';
import { StatusBadge } from '../../components/StatusBadge';
import { Button, ConfirmDialog, Empty, LoadError, PageHeading, Pagination, Panel, Reveal, RowsSkeleton } from '../../components/ui';
import { api, toQuery } from '../../lib/api';
import { dayRange, dayWord, isoFromCreatedAt, slashDate } from '../../lib/dates';
import { useToast } from '../../lib/toast';

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'cancelled', label: 'Cancelled' },
];

export default function MyRequests() {
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [cancelling, setCancelling] = useState(null);
  const [applying, setApplying] = useState(false);
  const queryClient = useQueryClient();
  const toast = useToast();

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['my-leaves', status, page],
    queryFn: () => api.get(`/me/leaves${toQuery({ status: status === 'all' ? '' : status, page, limit: 10 })}`),
    placeholderData: keepPreviousData,
  });

  const cancel = useMutation({
    mutationFn: (id) => api.patch(`/leaves/${id}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success('Leave cancelled', 'The days are back in your balance.');
      setCancelling(null);
    },
    onError: (issue) => {
      toast.error('Could not cancel', issue.message);
      setCancelling(null);
    },
  });

  const today = new Date().toISOString().slice(0, 10);
  const canCancel = (leave) => leave.status === 'pending' || (leave.status === 'approved' && leave.from > today);

  return (
    <div>
      <PageHeading
        title="Your requests"
        actions={<Button onClick={() => setApplying(true)}>Apply Leave</Button>}
      >
        Every leave you have asked for and what was decided.
      </PageHeading>

      <Reveal delay={0.08}>
        <Tabs
          label="Filter by status"
          tabs={TABS}
          value={status}
          onChange={(next) => {
            setStatus(next);
            setPage(1);
          }}
          className="mb-4"
        />

        <Panel>
          {isPending && <RowsSkeleton />}
          {isError && <LoadError error={error} onRetry={refetch} />}
          {data?.items.length === 0 && (
            <Empty title="No requests here">When you apply for leave it will show up in this list.</Empty>
          )}
          <ul>
            {data?.items.map((leave) => (
              <li
                key={leave.id}
                className="grid gap-x-6 gap-y-2 border-b border-line p-4 last:border-b-0 sm:px-5 lg:grid-cols-[minmax(220px,1fr)_minmax(0,1.6fr)_170px] lg:items-center"
              >
                <div>
                  <p className="text-sm font-medium">{leave.leaveType?.name}</p>
                  <p className="mt-0.5 text-sm tabular-nums text-muted">
                    {dayRange(leave.from, leave.to)}, {leave.days} {dayWord(leave.days)}
                  </p>
                </div>
                <div className="min-w-0 text-sm">
                  <p className="break-words">{leave.reason}</p>
                  <p className="mt-0.5 text-muted">
                    Sent {slashDate(isoFromCreatedAt(leave.createdAt))}
                    {leave.reviewedBy && `, decided by ${leave.reviewedBy.name}`}
                  </p>
                  {leave.reviewNote && <p className="mt-1 text-ink">Note: {leave.reviewNote}</p>}
                </div>
                <div className="flex items-center gap-3 lg:justify-end">
                  <StatusBadge status={leave.status} />
                  {canCancel(leave) && (
                    <Button variant="ghost" onClick={() => setCancelling(leave)}>
                      Cancel
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {data && <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} />}
        </Panel>
      </Reveal>

      <ConfirmDialog
        open={Boolean(cancelling)}
        onClose={() => setCancelling(null)}
        title="Cancel this leave?"
        body={cancelling ? `${cancelling.leaveType?.name}, ${dayRange(cancelling.from, cancelling.to)}. Your admin will be told.` : ''}
        confirmLabel="Cancel leave"
        danger
        loading={cancel.isPending}
        onConfirm={() => cancel.mutate(cancelling.id)}
      />

      <ApplyLeaveDialog open={applying} today={today} onClose={() => setApplying(false)} />
    </div>
  );
}
