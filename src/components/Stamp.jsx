import { motion, useReducedMotion } from 'framer-motion';
import { slashDate } from '../lib/dates';

const TONE = {
  approved: 'text-approved',
  rejected: 'text-rejected',
  cancelled: 'text-cancelled',
};

// The signature moment. `fresh` is true for the stamp an admin has just made:
// it comes down fast, large to small, and settles slightly crooked.
export function Stamp({ status, date, fresh = false }) {
  const reduce = useReducedMotion();

  if (status === 'pending') {
    return <span className="whitespace-nowrap text-sm font-medium text-pending">Awaiting decision</span>;
  }

  return (
    <motion.span
      className={`stamp ${TONE[status]}`}
      initial={fresh && !reduce ? { scale: 2.1, opacity: 0, rotate: -12 } : { rotate: -4 }}
      animate={{ scale: 1, opacity: 0.86, rotate: -4 }}
      transition={{ duration: 0.26, ease: [0.3, 0.9, 0.35, 1] }}
    >
      {status}
      {date && <small>{slashDate(date)}</small>}
    </motion.span>
  );
}
