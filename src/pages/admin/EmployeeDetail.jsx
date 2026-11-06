import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Stamp } from '../../components/Stamp';
import { Button, ConfirmDialog, Dialog, LoadError, Panel, Reveal, RowsSkeleton, SelectField, TextInput } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { dayRange, dayWord, slashDate, isoFromCreatedAt } from '../../lib/dates';
import { useToast } from '../../lib/toast';

function AdjustBalance({ open, onClose, employeeId, year, balances }) {
  const options = balances.filter((balance) => balance.leaveType.tracksBalance);
  const [form, setForm] = useState({ leaveTypeId: '', days: '', reason: '' });
  const [error, setError] = useState('');
  const queryClient = useQueryClient();
  const toast = useToast();

  const save = useMutation({
    mutationFn: () =>
      api.post(`/admin/employees/${employeeId}/adjustments`, {
        leaveTypeId: form.leaveTypeId || options[0].leaveType.id,
        year,
        days: Number(form.days),
        reason: form.reason.trim(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee', employeeId] });
      toast.success('Balance updated', 'The employee has been notified.');
      setForm({ leaveTypeId: '', days: '', reason: '' });
      onClose();
    },
    onError: (issue) => setError(issue.message),
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Adjust ${year} balance`}
      kind="modal"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="adjust-form" loading={save.isPending}>
            Save change
          </Button>
        </>
      }
    >
      <form
        id="adjust-form"
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          setError('');
          save.mutate();
        }}
      >
        <SelectField label="Leave type" value={form.leaveTypeId} onChange={(event) => setForm({ ...form, leaveTypeId: event.target.value })}>
          {options.map((balance) => (
            <option key={balance.leaveType.id} value={balance.leaveType.id}>
              {balance.leaveType.name}
            </option>
          ))}
        </SelectField>
        <TextInput
          label="Days"
          type="number"
          step="0.5"
          required
          value={form.days}
          hint="Use a minus to take days away, for example -1."
          onChange={(event) => setForm({ ...form, days: event.target.value })}
        />
        <TextInput
          label="Reason"
          required
          maxLength={240}
          value={form.reason}
          hint="The employee can see this."
          onChange={(event) => setForm({ ...form, reason: event.target.value })}
        />
        {error && (
          <p role="alert" className="text-sm text-rejected">
            {error}
          </p>
        )}
      </form>
    </Dialog>
  );
}

export default function EmployeeDetail() {
  const { id } = useParams();
  const { user: me } = useAuth();
  const [adjusting, setAdjusting] = useState(false);
  const [toggling, setToggling] = useState(false);
  const queryClient = useQueryClient();
  const toast = useToast();

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['employee', id],
    queryFn: () => api.get(`/admin/employees/${id}`),
  });

  const invite = useMutation({
    mutationFn: () => api.post(`/admin/employees/${id}/invite`),
    onSuccess: (result) => toast.success('Link sent', result.message),
    onError: (issue) => toast.error('Could not send', issue.message),
  });

  const toggle = useMutation({
    mutationFn: () => api.patch(`/admin/employees/${id}`, { isActive: !data.user.isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee', id] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success(data.user.isActive ? 'Access turned off' : 'Access restored');
      setToggling(false);
    },
    onError: (issue) => {
      toast.error('Could not change access', issue.message);
      setToggling(false);
    },
  });

  if (isPending) return <RowsSkeleton rows={6} />;
  if (isError) return <LoadError error={error} onRetry={refetch} />;

  const { user, balances, adjustments, recent, year } = data;

  return (
    <div className="space-y-6">
      <Reveal>
        <Link to="/admin/employees" className="mb-6 inline-flex min-h-10 items-center gap-1 text-sm text-muted hover:text-ink">
          <ChevronLeft className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
          People
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[40px] sm:text-[56px]">{user.name}</h1>
            <p className="mt-2 break-words text-base text-muted">
              {[user.designation, user.department, user.employeeId].filter(Boolean).join(', ')}
              {!user.isActive && ', inactive'}
            </p>
            <p className="break-words text-base text-muted">{user.email}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setAdjusting(true)}>Adjust balance</Button>
            {user.isActive && (
              <Button variant="secondary" loading={invite.isPending} onClick={() => invite.mutate()}>
                Send password link
              </Button>
            )}
            {user.id !== me.id && (
              <Button variant={user.isActive ? 'danger' : 'secondary'} onClick={() => setToggling(true)}>
                {user.isActive ? 'Turn off access' : 'Restore access'}
              </Button>
            )}
          </div>
        </div>
      </Reveal>

      <Reveal delay={0.08}>
        <Panel>
          <h2 className="border-b border-line px-5 py-3 text-[18px]">{year} balances</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-muted">
                  <th className="px-5 py-2 font-normal">Leave type</th>
                  <th className="px-3 py-2 text-right font-normal">Entitled</th>
                  <th className="px-3 py-2 text-right font-normal">Approved</th>
                  <th className="px-3 py-2 text-right font-normal">Waiting</th>
                  <th className="px-5 py-2 text-right font-normal">Available</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {balances.map((balance) => (
                  <tr key={balance.leaveType.id} className="border-b border-line last:border-b-0">
                    <td className="px-5 py-2.5">{balance.leaveType.name}</td>
                    <td className="px-3 py-2.5 text-right">{balance.entitled ?? 'No limit'}</td>
                    <td className="px-3 py-2.5 text-right">{balance.approved}</td>
                    <td className="px-3 py-2.5 text-right">{balance.pending}</td>
                    <td className="px-5 py-2.5 text-right font-medium">{balance.available ?? 'No limit'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </Reveal>

      <Reveal delay={0.14} className="grid items-start gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Panel>
          <h2 className="border-b border-line px-5 py-3 text-[18px]">Leave in {year}</h2>
          {recent.length === 0 && <p className="px-5 py-4 text-sm text-muted">No leave this year.</p>}
          <ul>
            {recent.map((leave) => (
              <li key={leave.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3 last:border-b-0">
                <div className="min-w-0 text-sm">
                  <p className="font-medium">{leave.leaveType?.name}</p>
                  <p className="tabular-nums text-muted">
                    {dayRange(leave.from, leave.to)}, {leave.days} {dayWord(leave.days)}
                  </p>
                </div>
                <Stamp status={leave.status} />
              </li>
            ))}
          </ul>
        </Panel>

        <Panel>
          <h2 className="border-b border-line px-5 py-3 text-[18px]">Balance changes</h2>
          {adjustments.length === 0 && <p className="px-5 py-4 text-sm text-muted">No manual changes this year.</p>}
          <ul>
            {adjustments.map((item) => (
              <li key={item.id} className="border-b border-line px-5 py-3 text-sm last:border-b-0">
                <p className="font-medium">
                  <span className="tabular-nums">{item.days > 0 ? `+${item.days}` : item.days}</span> {item.leaveType?.name}
                </p>
                <p className="break-words text-muted">{item.reason}</p>
                <p className="text-xs text-muted">
                  {item.createdBy?.name}, {slashDate(isoFromCreatedAt(item.createdAt))}
                </p>
              </li>
            ))}
          </ul>
        </Panel>
      </Reveal>

      <AdjustBalance open={adjusting} onClose={() => setAdjusting(false)} employeeId={id} year={year} balances={balances} />

      <ConfirmDialog
        open={toggling}
        onClose={() => setToggling(false)}
        title={user.isActive ? `Turn off access for ${user.name}?` : `Restore access for ${user.name}?`}
        body={user.isActive ? 'They are signed out at once and cannot sign in again. Their leave history stays.' : 'They will be able to sign in again.'}
        confirmLabel={user.isActive ? 'Turn off access' : 'Restore access'}
        danger={user.isActive}
        loading={toggle.isPending}
        onConfirm={() => toggle.mutate()}
      />
    </div>
  );
}
