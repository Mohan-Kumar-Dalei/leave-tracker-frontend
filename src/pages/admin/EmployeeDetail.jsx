import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Pencil, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { StatusBadge } from '../../components/StatusBadge';
import { MonthlyBars } from '../../components/MonthlyBars';
import {
  Button,
  ConfirmDialog,
  Dialog,
  IconButton,
  LoadError,
  Panel,
  PanelTitle,
  Reveal,
  RowsSkeleton,
  SelectField,
  TextInput,
} from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { dayRange, dayWord, slashDate, isoFromCreatedAt } from '../../lib/dates';
import { useToast } from '../../lib/toast';

const SESSIONS = [
  ['full', 'Full day'],
  ['first', 'First half'],
  ['second', 'Second half'],
];

const localToday = () => new Intl.DateTimeFormat('en-CA').format(new Date());

// "Record a leave taken" is for days the employee was on leave but never
// applied for: one day (full or half) or a range. It is saved as an approved
// leave on those dates and comes off what is available. Older day changes,
// made before this, can still be edited.
function AdjustBalance({ item, onClose, employeeId, balances }) {
  const leaveOptions = balances.filter((balance) => !balance.leaveType.restrictedHolidayOnly);
  const mode = item ? 'days' : 'leave';
  const [form, setForm] = useState({ days: item?.days ?? '', reason: item?.reason ?? '' });
  const [taken, setTaken] = useState({
    leaveTypeId: '',
    from: localToday(),
    to: localToday(),
    session: 'full',
    note: '',
  });
  const singleDay = taken.from === taken.to;
  const session = singleDay ? taken.session : 'full';
  const [error, setError] = useState('');
  const queryClient = useQueryClient();
  const toast = useToast();

  const takenTypeId = taken.leaveTypeId || leaveOptions[0]?.leaveType.id;
  const takenBalance = leaveOptions.find((balance) => balance.leaveType.id === takenTypeId);

  // How many working days the range counts, and what would be left, checked
  // by the server with the same rules as saving.
  const [preview, setPreview] = useState(null);
  useEffect(() => {
    setPreview(null);
    if (mode !== 'leave' || !takenTypeId || !taken.from || !taken.to) return undefined;
    let active = true;
    const timer = setTimeout(() => {
      api
        .post(`/admin/employees/${employeeId}/leaves/preview`, {
          leaveTypeId: takenTypeId,
          from: taken.from,
          to: taken.to,
          session,
        })
        .then((result) => active && setPreview(result))
        .catch((issue) => active && setPreview({ error: issue.message }));
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [mode, employeeId, takenTypeId, taken.from, taken.to, session]);

  const save = useMutation({
    mutationFn: () => {
      if (mode === 'leave') {
        return api.post(`/admin/employees/${employeeId}/leaves`, {
          leaveTypeId: takenTypeId,
          from: taken.from,
          to: taken.to,
          session,
          note: taken.note.trim() || undefined,
        });
      }
      return api.patch(`/admin/employees/${employeeId}/adjustments/${item.id}`, {
        days: Number(form.days),
        reason: form.reason.trim(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee', employeeId] });
      if (mode === 'leave')
        toast.success('Leave recorded', 'It comes off their available days, and they have been told.');
      else toast.success('Balance updated', 'The employee has been notified.');
      onClose();
    },
    onError: (issue) => setError(issue.message),
  });

  return (
    <Dialog
      open
      onClose={onClose}
      title={item ? 'Edit balance change' : 'Record a leave taken'}
      kind="modal"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="adjust-form"
            loading={save.isPending}
            disabled={mode === 'leave' && !preview?.days}
          >
            {mode === 'leave' ? 'Record leave' : 'Save change'}
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
        {mode === 'leave' && (
          <>
            <p className="text-[13px] text-muted">
              For days they were on leave but did not apply. It is saved as approved leave on those dates.
            </p>
            <SelectField
              label="Leave type"
              value={takenTypeId}
              hint={takenBalance?.available != null ? `${takenBalance.available} available now` : undefined}
              onChange={(event) => setTaken({ ...taken, leaveTypeId: event.target.value })}
            >
              {leaveOptions.map((balance) => (
                <option key={balance.leaveType.id} value={balance.leaveType.id}>
                  {balance.leaveType.name}
                </option>
              ))}
            </SelectField>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput
                label="From"
                type="date"
                required
                value={taken.from}
                onChange={(event) => {
                  const from = event.target.value;
                  setTaken({ ...taken, from, to: taken.to < from ? from : taken.to });
                }}
              />
              <TextInput
                label="To"
                type="date"
                required
                min={taken.from}
                value={taken.to}
                onChange={(event) => setTaken({ ...taken, to: event.target.value })}
              />
            </div>
            {singleDay && (
              <fieldset>
                <legend className="mb-1.5 text-[13px] font-medium">Duration</legend>
                <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-line bg-line">
                  {SESSIONS.map(([value, label]) => (
                    <label
                      key={value}
                      className={`grid min-h-10 cursor-pointer place-items-center px-2 text-sm transition-colors has-focus-visible:outline-2 has-focus-visible:-outline-offset-2 has-focus-visible:outline-accent ${
                        taken.session === value
                          ? 'bg-accent-soft font-medium text-accent'
                          : 'bg-surface text-ink hover:bg-bg'
                      }`}
                    >
                      <input
                        type="radio"
                        name="taken-session"
                        value={value}
                        checked={taken.session === value}
                        onChange={() => setTaken({ ...taken, session: value })}
                        className="sr-only"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            <div aria-live="polite" className="min-h-11 rounded-lg bg-bg px-3 py-2.5 text-sm">
              {preview?.error && <p className="text-rejected">{preview.error}</p>}
              {preview && !preview.error && (
                <p>
                  <span className="font-semibold tabular-nums">{preview.days}</span> working {dayWord(preview.days)}
                  {preview.tracksBalance
                    ? `. ${preview.availableAfter} left after this.`
                    : '. No limit for this leave type.'}
                </p>
              )}
              {!preview && <p className="text-muted">Sundays and public holidays are not counted.</p>}
            </div>
            <TextInput
              label="Note"
              maxLength={300}
              value={taken.note}
              placeholder="Forgot to apply"
              hint="Optional. The employee can see this."
              onChange={(event) => setTaken({ ...taken, note: event.target.value })}
            />
          </>
        )}

        {mode === 'days' && (
          <>
            <p className="text-sm">
              <span className="text-muted">Leave type: </span>
              {item.leaveType?.name}
            </p>
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
          </>
        )}
        {error && (
          <p role="alert" className="text-sm text-rejected">
            {error}
          </p>
        )}
      </form>
    </Dialog>
  );
}

// Department, designation and phone. Designation and phone go into the
// signature of the leave mails this person sends.
function EditDetails({ user, onClose }) {
  const [form, setForm] = useState({
    department: user.department ?? '',
    designation: user.designation ?? '',
    phone: user.phone ?? '',
  });
  const [error, setError] = useState('');
  const queryClient = useQueryClient();
  const toast = useToast();

  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  const save = useMutation({
    mutationFn: () => api.patch(`/admin/employees/${user.id}`, form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee', user.id] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Details saved');
      onClose();
    },
    onError: (issue) => setError(issue.message),
  });

  return (
    <Dialog
      open
      onClose={onClose}
      title="Edit details"
      kind="modal"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="details-form" loading={save.isPending}>
            Save details
          </Button>
        </>
      }
    >
      <form
        id="details-form"
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          setError('');
          save.mutate();
        }}
      >
        <TextInput label="Department" maxLength={60} value={form.department} onChange={set('department')} />
        <TextInput
          label="Designation"
          maxLength={80}
          value={form.designation}
          onChange={set('designation')}
          hint="Empty means Analyst in mails."
        />
        <TextInput
          label="Phone"
          type="tel"
          maxLength={20}
          value={form.phone}
          onChange={set('phone')}
          hint="Shown in their mail signature."
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
  const [adjusting, setAdjusting] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [toggling, setToggling] = useState(false);
  const [editing, setEditing] = useState(false);
  const queryClient = useQueryClient();
  const toast = useToast();

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['employee', id],
    queryFn: () => api.get(`/admin/employees/${id}`),
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

  const removeChange = useMutation({
    mutationFn: (itemId) => api.delete(`/admin/employees/${id}/adjustments/${itemId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee', id] });
      toast.success('Change removed', 'The employee has been notified.');
      setRemoving(null);
    },
    onError: (issue) => {
      toast.error('Could not remove it', issue.message);
      setRemoving(null);
    },
  });

  if (isPending) return <RowsSkeleton rows={6} />;
  if (isError) return <LoadError error={error} onRetry={refetch} />;

  const { user, balances, monthly, adjustments, recent, year } = data;

  return (
    <div className="space-y-4">
      <Reveal>
        <Link
          to="/admin/employees"
          className="mb-3 inline-flex min-h-9 items-center gap-1 text-sm text-muted hover:text-ink"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Employees
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[22px] sm:text-2xl">{user.name}</h1>
            <p className="mt-2 break-words text-base text-muted">
              {[user.designation || (user.role === 'admin' ? '' : 'Analyst'), user.department, user.employeeId]
                .filter(Boolean)
                .join(', ')}
              {!user.isActive && ', inactive'}
            </p>
            <p className="break-words text-base text-muted">{[user.email, user.phone].filter(Boolean).join(', ')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setAdjusting({ item: null })}>Adjust balance</Button>
            <Button variant="secondary" onClick={() => setEditing(true)}>
              Edit details
            </Button>
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
          <PanelTitle>{year} balances</PanelTitle>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-muted">
                  <th className="px-5 py-2 font-normal">Leave type</th>
                  <th className="whitespace-nowrap px-3 py-2 text-right font-normal">Total leave</th>
                  <th className="px-3 py-2 text-right font-normal">Applied</th>
                  <th className="px-3 py-2 text-right font-normal">Approved</th>
                  <th className="px-5 py-2 text-right font-normal">Available</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {balances.map((balance) => {
                  // Leave from the old sheet was taken, so it counts as approved.
                  const approved = balance.earlier + balance.approved;
                  return (
                    <tr key={balance.leaveType.id} className="border-b border-line last:border-b-0">
                      <td className="px-5 py-2.5">{balance.leaveType.name}</td>
                      <td className="px-3 py-2.5 text-right">{balance.total ?? 'No limit'}</td>
                      <td className="px-3 py-2.5 text-right" title={`${approved} approved, ${balance.pending} pending`}>
                        {balance.booked}
                      </td>
                      <td
                        className="px-3 py-2.5 text-right"
                        title={
                          balance.earlier > 0
                            ? `${balance.approved} in the app, ${balance.earlier} from the earlier sheet`
                            : undefined
                        }
                      >
                        {approved}
                      </td>
                      <td className="px-5 py-2.5 text-right font-medium">{balance.available ?? 'No limit'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="border-t border-line px-5 py-2.5 text-xs text-muted">
            Applied is approved plus pending. Approved includes leave from the earlier sheet. Available is total leave
            minus applied, plus any balance changes listed below.
          </p>
        </Panel>
      </Reveal>

      {monthly.some((days) => days > 0) && (
        <Reveal delay={0.1}>
          <Panel>
            <PanelTitle>Leave used by month, {year}</PanelTitle>
            <MonthlyBars months={monthly} />
          </Panel>
        </Reveal>
      )}

      <Reveal delay={0.14} className="grid items-start gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Panel>
          <PanelTitle>Leave in {year}</PanelTitle>
          {recent.length === 0 && <p className="px-5 py-4 text-sm text-muted">No leave this year.</p>}
          <ul>
            {recent.map((leave) => (
              <li
                key={leave.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3 last:border-b-0"
              >
                <div className="min-w-0 text-sm">
                  <p className="font-medium">{leave.leaveType?.name}</p>
                  <p className="tabular-nums text-muted">
                    {dayRange(leave.from, leave.to)}, {leave.days} {dayWord(leave.days)}
                  </p>
                </div>
                <StatusBadge status={leave.status} />
              </li>
            ))}
          </ul>
        </Panel>

        <Panel>
          <PanelTitle>Balance changes</PanelTitle>
          {adjustments.length === 0 && <p className="px-5 py-4 text-sm text-muted">No manual changes this year.</p>}
          <ul>
            {adjustments.map((item) => (
              <li
                key={item.id}
                className="flex items-start justify-between gap-2 border-b border-line py-2 pl-5 pr-3 text-sm last:border-b-0"
              >
                <div className="min-w-0 py-1">
                  <p className="font-medium">
                    <span className="tabular-nums">{item.days > 0 ? `+${item.days}` : item.days}</span>{' '}
                    {item.leaveType?.name}
                  </p>
                  <p className="break-words text-muted">{item.reason}</p>
                  <p className="text-xs text-muted">
                    {item.createdBy?.name}, {slashDate(isoFromCreatedAt(item.createdAt))}
                  </p>
                </div>
                <div className="flex shrink-0">
                  <IconButton label={`Edit ${item.leaveType?.name} change`} onClick={() => setAdjusting({ item })}>
                    <Pencil className="h-4 w-4" />
                  </IconButton>
                  <IconButton label={`Remove ${item.leaveType?.name} change`} onClick={() => setRemoving(item)}>
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </Reveal>

      {editing && <EditDetails user={user} onClose={() => setEditing(false)} />}

      {adjusting && (
        <AdjustBalance item={adjusting.item} onClose={() => setAdjusting(null)} employeeId={id} balances={balances} />
      )}

      <ConfirmDialog
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        title="Remove this balance change?"
        body={
          removing
            ? `${removing.days > 0 ? '+' : ''}${removing.days} ${removing.leaveType?.name}. The balance goes back and the employee is told.`
            : ''
        }
        confirmLabel="Remove change"
        danger
        loading={removeChange.isPending}
        onConfirm={() => removeChange.mutate(removing.id)}
      />

      <ConfirmDialog
        open={toggling}
        onClose={() => setToggling(false)}
        title={user.isActive ? `Turn off access for ${user.name}?` : `Restore access for ${user.name}?`}
        body={
          user.isActive
            ? 'They are signed out at once and cannot sign in again. Their leave history stays.'
            : 'They will be able to sign in again.'
        }
        confirmLabel={user.isActive ? 'Turn off access' : 'Restore access'}
        danger={user.isActive}
        loading={toggle.isPending}
        onConfirm={() => toggle.mutate()}
      />
    </div>
  );
}
