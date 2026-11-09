import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { dayRange, dayWord, isoFromCreatedAt, slashDate } from '../lib/dates';
import { MailBody } from './MailParts';
import { StatusBadge } from './StatusBadge';
import { Button, Dialog } from './ui';

const SESSION = { full: 'Full day', first: 'First half', second: 'Second half' };
const LINE = {
  approved: 'Your leave request is approved.',
  rejected: 'Your leave request is not approved.',
};

const firstName = (name = '') => name.trim().split(/\s+/)[0];

export const replyDraft = (leave, me, decision) =>
  `Hi ${firstName(leave.user?.name)},\n\n${LINE[decision]}\n\nThanks,\n${firstName(me.name)}`;

function Detail({ label, children }) {
  return (
    <div className="grid grid-cols-[96px_1fr] gap-3 border-b border-line py-2.5 text-sm last:border-b-0">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

// The full request as the employee sent it, and the reply that goes back to
// them and the same CC when the admin decides.
export function ReviewDialog({ leave, decision: startDecision, onClose, onDecide, busy }) {
  const { user: me } = useAuth();
  const { data: compose } = useQuery({ queryKey: ['compose'], queryFn: () => api.get('/me/compose') });

  const [reply, setReply] = useState(() => replyDraft(leave, me, startDecision ?? 'approved'));
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [sending, setSending] = useState(null);
  const pending = leave.status === 'pending';

  const nameOf = (email) => compose?.contacts.find((contact) => contact.email === email)?.name ?? email;
  const ccNames = leave.cc ? leave.cc.map(nameOf) : (compose?.defaultCc ?? []).map((contact) => contact.name);
  const toNames = leave.mailTo ? leave.mailTo.map(nameOf) : null;
  const duration = leave.from === leave.to ? SESSION[leave.session] : 'Full days';

  // The reply starts as the approval. Pressing Reject while that text is
  // untouched swaps in the rejection text first, so the admin reads what goes
  // out and presses Reject again to send it. The other way round too.
  const send = (decision) => {
    setError('');
    setNotice('');
    const other = decision === 'approved' ? 'rejected' : 'approved';
    if (reply === replyDraft(leave, me, other)) {
      setReply(replyDraft(leave, me, decision));
      setNotice(
        `The reply now says the leave is ${decision === 'approved' ? 'approved' : 'not approved'}. Check it and press ${
          decision === 'approved' ? 'Approve' : 'Reject'
        } again to send.`,
      );
      return;
    }
    if (reply.trim().length < 5) {
      setError('Write a short reply for the employee.');
      return;
    }
    setSending(decision);
    onDecide({ decision, reply: reply.trim() });
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="Leave request"
      footer={
        pending ? (
          <>
            <Button variant="ghost" className="mr-auto" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="danger" loading={busy && sending === 'rejected'} disabled={busy} onClick={() => send('rejected')}>
              Reject
            </Button>
            <Button loading={busy && sending === 'approved'} disabled={busy} onClick={() => send('approved')}>
              Approve
            </Button>
          </>
        ) : (
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        )
      }
    >
      <div className="space-y-5">
        <dl>
          <Detail label="Employee">
            {leave.user?.name}
            <span className="text-muted">, {leave.user?.employeeId}</span>
          </Detail>
          <Detail label="Leave type">{leave.leaveType?.name}</Detail>
          <Detail label="Dates">
            <span className="tabular-nums">{dayRange(leave.from, leave.to)}</span>
            <span className="text-muted">
              , {leave.days} {dayWord(leave.days)}
            </span>
          </Detail>
          <Detail label="Duration">{duration}</Detail>
          <Detail label="Applied">{leave.createdAt ? slashDate(isoFromCreatedAt(leave.createdAt)) : 'Not known'}</Detail>
          <Detail label="Subject">{leave.subject || 'Leave Application'}</Detail>
          {toNames && <Detail label="To">{toNames.join(', ')}</Detail>}
          <Detail label="CC">{ccNames.length ? ccNames.join(', ') : 'Nobody'}</Detail>
          {!pending && (
            <Detail label="Status">
              <StatusBadge status={leave.status} />
            </Detail>
          )}
        </dl>

        <section>
          <h3 className="mb-1.5 text-[13px] font-medium">Their mail</h3>
          <p className="whitespace-pre-wrap break-words rounded-lg bg-bg px-3 py-2.5 text-sm leading-relaxed">
            {leave.message || leave.reason}
          </p>
        </section>

        {pending ? (
          <section>
            {notice && (
              <p role="status" className="mb-3 rounded-lg bg-pending-soft px-3 py-2 text-[13px] text-pending">
                {notice}
              </p>
            )}
            <MailBody
              label="Your reply"
              rows={7}
              maxLength={4000}
              value={reply}
              error={error}
              signature={compose?.signature}
              hint="Goes to the employee and the same people they copied, in the same mail thread."
              onChange={(event) => {
                setReply(event.target.value);
                setNotice('');
              }}
            />
          </section>
        ) : (
          (leave.reply || leave.reviewNote) && (
            <section>
              <h3 className="mb-1.5 text-[13px] font-medium">
                Reply{leave.reviewedBy?.name ? ` from ${leave.reviewedBy.name}` : ''}
              </h3>
              <p className="whitespace-pre-wrap break-words rounded-lg bg-bg px-3 py-2.5 text-sm leading-relaxed">
                {leave.reply || leave.reviewNote}
              </p>
            </section>
          )
        )}
      </div>
    </Dialog>
  );
}
