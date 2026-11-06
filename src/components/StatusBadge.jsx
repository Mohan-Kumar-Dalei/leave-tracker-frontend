import { motion, useReducedMotion } from 'framer-motion';

const STATUS = {
  pending: { label: 'Pending', tone: 'bg-pending-soft text-pending', dot: 'bg-pending' },
  approved: { label: 'Approved', tone: 'bg-approved-soft text-approved', dot: 'bg-approved' },
  rejected: { label: 'Rejected', tone: 'bg-rejected-soft text-rejected', dot: 'bg-rejected' },
  cancelled: { label: 'Cancelled', tone: 'bg-cancelled-soft text-cancelled', dot: 'bg-cancelled' },
};

export function StatusBadge({ status, fresh = false }) {
  const reduce = useReducedMotion();
  const { label, tone, dot } = STATUS[status];

  return (
    <motion.span
      initial={fresh && !reduce ? { scale: 0.9, opacity: 0 } : false}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}
    >
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {label}
    </motion.span>
  );
}
