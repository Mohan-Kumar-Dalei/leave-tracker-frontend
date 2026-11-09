import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api';
import { dayRange, dayWord } from '../lib/dates';
import { useToast } from '../lib/toast';
import { ReviewDialog } from './ReviewDialog';
import { StatusBadge } from './StatusBadge';
import { Button, ConfirmDialog } from './ui';

const DECIDED_HOLD_MS = 900;

// A decided row stays on screen briefly so the admin sees the result, even if the
// live update has already removed it from the list.
function useDecisions(items, keepFinished) {
  const [decided, setDecided] = useState({});
  const positions = useRef({});
  const queryClient = useQueryClient();
  const toast = useToast();

  const mutation = useMutation({
    mutationFn: ({ id, decision, reply }) => api.patch(`/admin/leaves/${id}/review`, { decision, reply }),
    onSuccess: ({ leave }, { decision }) => {
      setDecided((current) => ({ ...current, [leave.id]: leave }));
      toast.success(
        decision === 'approved' ? 'Leave approved' : 'Leave rejected',
        `${leave.user.name} has been told by mail and on their dashboard.`,
      );
      setTimeout(() => {
        setDecided(({ [leave.id]: _done, ...rest }) => rest);
        queryClient.invalidateQueries();
      }, DECIDED_HOLD_MS);
    },
    onError: (issue) => {
      toast.error('That did not go through', issue.message);
      queryClient.invalidateQueries();
    },
  });

  const rows = useMemo(() => {
    items.forEach((item, index) => {
      positions.current[item.id] = index;
    });

    const merged = items
      .filter((item) => keepFinished || item.status === 'pending' || decided[item.id])
      .map((item) => decided[item.id] ?? item);

    for (const leave of Object.values(decided)) {
      if (!merged.some((item) => item.id === leave.id)) {
        merged.splice(positions.current[leave.id] ?? merged.length, 0, leave);
      }
    }
    return merged;
  }, [items, decided, keepFinished]);

  const isFresh = useCallback((id) => Boolean(decided[id]), [decided]);
  return { rows, isFresh, mutation };
}

export function ReviewList({ items, compact = false, keepFinished = true }) {
  const { rows, isFresh, mutation } = useDecisions(items, keepFinished);
  const [reviewing, setReviewing] = useState(null);
  const [cancelling, setCancelling] = useState(null);
  const queryClient = useQueryClient();
  const toast = useToast();

  const cancel = useMutation({
    mutationFn: (id) => api.patch(`/leaves/${id}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success('Leave cancelled', 'The employee has been told.');
      setCancelling(null);
    },
    onError: (issue) => {
      toast.error('Could not cancel', issue.message);
      setCancelling(null);
    },
  });

  const decide = ({ decision, reply }) =>
    mutation.mutate({ id: reviewing.leave.id, decision, reply }, { onSuccess: () => setReviewing(null) });

  const grid = compact
    ? 'grid gap-x-5 gap-y-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-center'
    : 'grid gap-x-6 gap-y-2 lg:grid-cols-[minmax(170px,1fr)_minmax(190px,1fr)_minmax(0,1.5fr)_180px] lg:items-center';

  return (
    <>
      <ul>
        <AnimatePresence initial={false}>
          {rows.map((leave) => {
            const fresh = isFresh(leave.id);
            const pending = leave.status === 'pending';
            return (
              <motion.li
                key={leave.id}
                layout="position"
                exit={{ opacity: 0, x: 24 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className={`border-b border-line p-4 last:border-b-0 sm:px-5 ${grid}`}
              >
                <button
                  type="button"
                  onClick={() => setReviewing({ leave })}
                  className="-m-1.5 min-w-0 rounded-lg p-1.5 text-left hover:bg-bg"
                >
                  <p className="text-sm font-medium">{leave.user?.name}</p>
                  <p className="mt-0.5 truncate text-sm text-muted">
                    {leave.user?.employeeId}
                    {leave.user?.department && `, ${leave.user.department}`}
                  </p>
                  {compact && (
                    <p className="mt-1 text-sm">
                      {leave.leaveType?.name}, {leave.days} {dayWord(leave.days)}, {dayRange(leave.from, leave.to)}
                    </p>
                  )}
                  {compact && <p className="mt-0.5 break-words text-sm text-muted">{leave.reason}</p>}
                  <span className="mt-1 block text-[13px] text-accent">Open request</span>
                </button>

                {!compact && (
                  <div className="text-sm">
                    <p>{leave.leaveType?.name}</p>
                    <p className="mt-0.5 tabular-nums text-muted">
                      {dayRange(leave.from, leave.to)}, {leave.days} {dayWord(leave.days)}
                    </p>
                  </div>
                )}

                {!compact && (
                  <div className="min-w-0 text-sm">
                    <p className="break-words">{leave.reason}</p>
                    {leave.reviewNote && <p className="mt-0.5 text-muted">Note: {leave.reviewNote}</p>}
                  </div>
                )}

                <div className="flex min-h-10 flex-wrap items-center gap-2 lg:justify-end">
                  {pending ? (
                    <>
                      <Button
                        className="max-sm:flex-1"
                        disabled={mutation.isPending}
                        onClick={() => setReviewing({ leave, decision: 'approved' })}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="secondary"
                        className="max-sm:flex-1"
                        disabled={mutation.isPending}
                        onClick={() => setReviewing({ leave, decision: 'rejected' })}
                      >
                        Reject
                      </Button>
                    </>
                  ) : (
                    <>
                      <StatusBadge status={leave.status} fresh={fresh} />
                      {leave.status === 'approved' && !fresh && !compact && (
                        <Button variant="ghost" onClick={() => setCancelling(leave)}>
                          Cancel
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>

      {reviewing && (
        <ReviewDialog
          key={reviewing.leave.id + (reviewing.decision ?? '')}
          leave={reviewing.leave}
          decision={reviewing.decision}
          busy={mutation.isPending}
          onClose={() => setReviewing(null)}
          onDecide={decide}
        />
      )}

      <ConfirmDialog
        open={Boolean(cancelling)}
        onClose={() => setCancelling(null)}
        title="Cancel this approved leave?"
        body={cancelling ? `${cancelling.user?.name}, ${dayRange(cancelling.from, cancelling.to)}. The days go back to their balance.` : ''}
        confirmLabel="Cancel leave"
        danger
        loading={cancel.isPending}
        onConfirm={() => cancel.mutate(cancelling.id)}
      />
    </>
  );
}
