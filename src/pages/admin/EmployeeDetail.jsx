import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Pencil, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Controller } from 'react-hook-form';
import { z } from 'zod';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { StatusBadge } from '../../components/StatusBadge';
import { useTeam } from '../../components/TeamPeople';
import { MonthlyBars } from '../../components/MonthlyBars';
import {
  Button,
  ConfirmDialog,
  Dialog,
  FormError,
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
import { formError, rules, showServerError, useZodForm } from '../../lib/forms';
import { useAppPath } from '../../hooks/useAppPath';

const SESSIONS = [
  ['full', 'Full day'],
  ['first', 'First half'],
  ['second', 'Second half'],
];

const localToday = () => new Intl.DateTimeFormat('en-CA').format(new Date());

// "Record a leave taken" is for days the employee was on leave but never
// applied for: one day (full or half) or a range. It is saved as an approved
// leave on those dates and comes off what is available. Restricted Holidays
// are recorded too: one day picked from the restricted holiday list. Older
// day changes, made before this, can still be edited.
// The rules: a leave needs its type and dates (or, for a restricted holiday,
// one from the list); an older change needs whole or half days and a reason.
const adjustRules = (mode, restricted) =>
  mode === 'leave'
    ? z
        .object({
          leaveTypeId: rules.required('Pick a leave type.'),
          from: z.string().min(1, restricted ? 'Pick a restricted holiday.' : 'Pick the first day.'),
          to: z.string().min(1, 'Pick the last day.'),
          session: z.string(),
          note: rules.text(300, 'The note'),
          days: z.any(),
          reason: z.any(),
        })
        .refine((values) => !values.from || !values.to || values.to >= values.from, {
          path: ['to'],
          message: 'The last day cannot be before the first.',
        })
    : z.object({
        days: z
          .string()
          .trim()
          .min(1, 'Enter the days.')
          .refine((value) => !Number.isNaN(Number(value)), 'Enter a number, like 1 or -0.5.')
          .refine((value) => Number(value) !== 0, 'Use a number other than 0.')
          .refine((value) => Math.abs(Number(value)) <= 365, 'Use at most 365 days.')
          .refine((value) => Number.isInteger(Number(value) * 2), 'Use whole or half days.'),
        reason: z.string().trim().min(3, 'Add a short reason.').max(240, 'Keep the reason under 240 characters.'),
        leaveTypeId: z.any(),
        from: z.any(),
        to: z.any(),
        session: z.any(),
        note: z.any(),
      });

function AdjustBalance({ item, onClose, employeeId, balances }) {
  const leaveOptions = balances;
  const mode = item ? 'days' : 'leave';
  const queryClient = useQueryClient();
  const toast = useToast();

  // The form, checked with react-hook-form; the rules depend on the kind of
  // leave picked, so they are worked out each time it is checked.
  const restrictedRef = useRef(false);
  const form = useZodForm(() => adjustRules(mode, restrictedRef.current), {
    leaveTypeId: leaveOptions[0]?.leaveType.id ?? '',
    from: localToday(),
    to: localToday(),
    session: 'full',
    note: '',
    days: item ? String(item.days) : '',
    reason: item?.reason ?? '',
  });
  const { register, handleSubmit, setValue, watch, formState } = form;
  const { errors } = formState;
  const taken = watch();
  const pick = (name, value) => setValue(name, value, { shouldValidate: formState.isSubmitted, shouldDirty: true });

  const takenTypeId = taken.leaveTypeId || leaveOptions[0]?.leaveType.id;
  const takenBalance = leaveOptions.find((balance) => balance.leaveType.id === takenTypeId);
  const restricted = Boolean(takenBalance?.leaveType.restrictedHolidayOnly);
  restrictedRef.current = restricted;
  const year = (taken.from || localToday()).slice(0, 4);
  const { data: holidayData } = useQuery({
    queryKey: ['holidays', year],
    queryFn: () => api.get(`/holidays?year=${year}`),
    enabled: restricted,
  });
  const restrictedHolidays = (holidayData?.items ?? []).filter((holiday) => holiday.restricted);
  const singleDay = taken.from === taken.to;
  // A restricted holiday is always one full day.
  const session = singleDay && !restricted ? taken.session : 'full';

  // How many working days the range counts, and what would be left, checked
  // by the server with the same rules as saving.
  const [preview, setPreview] = useState(null);
  useEffect(() => {
    setPreview(null);
    if (mode !== 'leave' || !takenTypeId || !taken.from || !taken.to || taken.to < taken.from) return undefined;
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
    mutationFn: (values) => {
      if (mode === 'leave') {
        return api.post(`/admin/employees/${employeeId}/leaves`, {
          leaveTypeId: takenTypeId,
          from: values.from,
          to: values.to,
          session,
          note: values.note.trim() || undefined,
        });
      }
      return api.patch(`/admin/employees/${employeeId}/adjustments/${item.id}`, {
        days: Number(values.days),
        reason: values.reason.trim(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee', employeeId] });
      if (mode === 'leave')
        toast.success('Leave recorded', 'It comes off their available days, and they have been told.');
      else toast.success('Balance updated', 'The employee has been notified.');
      onClose();
    },
    onError: (issue) => showServerError(form, issue, ['from', 'to', 'note', 'days', 'reason']),
  });
  const error = formError(form);

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
            disabled={mode === 'leave' && Boolean(preview) && !preview.days}
          >
            {mode === 'leave' ? 'Record leave' : 'Save change'}
          </Button>
        </>
      }
    >
      <form id="adjust-form" className="space-y-4" noValidate onSubmit={handleSubmit((values) => save.mutate(values))}>
        {mode === 'leave' && (
          <>
            <p className="text-[13px] text-muted">
              For days they were on leave but did not apply. Saved as approved leave.
            </p>
            <SelectField
              label="Leave type"
              value={takenTypeId}
              error={errors.leaveTypeId?.message}
              hint={takenBalance?.available != null ? `${takenBalance.available} available now` : undefined}
              onChange={(event) => {
                const next = leaveOptions.find((balance) => balance.leaveType.id === event.target.value);
                pick('leaveTypeId', event.target.value);
                // A restricted holiday starts unpicked and is always one full day.
                if (next?.leaveType.restrictedHolidayOnly) {
                  pick('from', '');
                  pick('to', '');
                  pick('session', 'full');
                } else {
                  pick('from', taken.from || localToday());
                  pick('to', taken.to || localToday());
                }
              }}
            >
              {leaveOptions.map((balance) => (
                <option key={balance.leaveType.id} value={balance.leaveType.id}>
                  {balance.leaveType.name}
                </option>
              ))}
            </SelectField>
            {restricted ? (
              <SelectField
                label="Restricted holiday"
                value={taken.from}
                error={errors.from?.message}
                hint="A restricted holiday is taken as one full day."
                onChange={(event) => {
                  pick('from', event.target.value);
                  pick('to', event.target.value);
                  pick('session', 'full');
                }}
              >
                <option value="">Pick a holiday</option>
                {restrictedHolidays.map((holiday) => (
                  <option key={holiday.id} value={holiday.date}>
                    {`${holiday.name}, ${slashDate(holiday.date)}`}
                  </option>
                ))}
              </SelectField>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextInput
                    label="From"
                    type="date"
                    error={errors.from?.message}
                    {...register('from', {
                      onChange: (event) => {
                        const from = event.target.value;
                        if (from && taken.to && taken.to < from) pick('to', from);
                      },
                    })}
                  />
                  <TextInput label="To" type="date" min={taken.from || undefined} error={errors.to?.message} {...register('to')} />
                </div>
                {/* Always shown, so the form keeps its height. Half days are for
                    one date only, so they are off for a range. */}
                <fieldset>
                  <legend className="mb-1.5 text-[13px] font-medium">Duration</legend>
                  <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-line bg-line">
                    {SESSIONS.map(([value, label]) => {
                      const off = !singleDay && value !== 'full';
                      return (
                        <label
                          key={value}
                          title={off ? 'Half days are for one date only' : undefined}
                          className={`grid min-h-10 place-items-center px-2 text-sm transition-colors has-focus-visible:outline-2 has-focus-visible:-outline-offset-2 has-focus-visible:outline-accent ${
                            off
                              ? 'cursor-not-allowed bg-surface text-muted/50'
                              : session === value
                                ? 'cursor-pointer bg-accent-soft font-medium text-accent'
                                : 'cursor-pointer bg-surface text-ink hover:bg-bg'
                          }`}
                        >
                          <input
                            type="radio"
                            name="taken-session"
                            value={value}
                            disabled={off}
                            checked={session === value}
                            onChange={() => pick('session', value)}
                            className="sr-only"
                          />
                          {label}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              </>
            )}
            {/* One fixed line for the count, problems and save errors, so the
                form does not grow as it is filled in. */}
            <div
              aria-live="polite"
              className={`flex min-h-11 items-center rounded-lg px-3 py-2 text-sm ${error || preview?.error ? 'bg-rejected-soft' : 'bg-bg'}`}
            >
              {error && (
                <p role="alert" className="line-clamp-2 text-rejected">
                  {error}
                </p>
              )}
              {!error && preview?.error && <p className="line-clamp-2 text-rejected">{preview.error}</p>}
              {!error && preview && !preview.error && (
                <p>
                  <span className="font-semibold tabular-nums">{preview.days}</span> working {dayWord(preview.days)}
                  {preview.tracksBalance
                    ? `. ${preview.availableAfter} left after this.`
                    : '. No limit for this leave type.'}
                </p>
              )}
              {!error && !preview && <p className="text-muted">Sundays and public holidays are not counted.</p>}
            </div>
            <TextInput
              label="Note"
              maxLength={300}
              placeholder="Forgot to apply"
              hint="Optional. The employee can see this."
              error={errors.note?.message}
              {...register('note')}
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
              hint="Use a minus to take days away, for example -1."
              error={errors.days?.message}
              {...register('days')}
            />
            <TextInput label="Reason" maxLength={240} hint="The employee can see this." error={errors.reason?.message} {...register('reason')} />
            <FormError>{error}</FormError>
          </>
        )}
      </form>
    </Dialog>
  );
}

// Department, designation and phone. Designation and phone go into the
// signature of the leave mails this person sends.
const detailsRules = z.object({
  email: rules.email,
  department: rules.text(60, 'The department'),
  designation: rules.text(80, 'The designation'),
  phone: rules.phone,
  reportsTo: z.string(),
  workFromHome: z.boolean(),
});

function EditDetails({ user, onClose }) {
  const form = useZodForm(detailsRules, {
    email: user.email ?? '',
    department: user.department ?? '',
    designation: user.designation ?? '',
    phone: user.phone ?? '',
    reportsTo: user.reportsTo ?? '',
    workFromHome: Boolean(user.workFromHome),
  });
  const { register, handleSubmit, control, formState } = form;
  const { errors } = formState;
  // Everyone they could report to: active, visible people other than them.
  const { data: team } = useTeam();
  const managers = (team?.members ?? []).filter((member) => member.id !== user.id);
  const queryClient = useQueryClient();
  const toast = useToast();

  const save = useMutation({
    mutationFn: (fields) => api.patch(`/admin/employees/${user.id}`, { ...fields, reportsTo: fields.reportsTo || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee', user.id] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['team'] });
      toast.success('Details saved');
      onClose();
    },
    onError: (issue) => showServerError(form, issue, ['email', 'department', 'designation', 'phone', 'reportsTo']),
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
      <form id="details-form" className="space-y-4" noValidate onSubmit={handleSubmit((fields) => save.mutate(fields))}>
        <TextInput
          label="Email"
          type="email"
          maxLength={160}
          hint="Their sign-in. A new email needs a new Gmail App Password."
          error={errors.email?.message}
          {...register('email')}
        />
        <TextInput label="Department" maxLength={60} error={errors.department?.message} {...register('department')} />
        <TextInput
          label="Designation"
          maxLength={80}
          hint="Empty means Analyst in mails."
          error={errors.designation?.message}
          {...register('designation')}
        />
        <TextInput label="Phone" type="tel" maxLength={20} hint="Shown in their mail signature." error={errors.phone?.message} {...register('phone')} />
        <Controller
          control={control}
          name="reportsTo"
          render={({ field, fieldState }) => (
            <SelectField
              label="Reports to"
              value={field.value}
              onChange={(event) => field.onChange(event.target.value)}
              error={fieldState.error?.message}
              hint="Places them under this person in the department tree."
            >
              <option value="">Nobody (top of the department)</option>
              {managers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}, {member.designation}
                </option>
              ))}
            </SelectField>
          )}
        />
        <label className="flex items-center gap-2.5 text-sm">
          <input id="details-wfh" type="checkbox" {...register('workFromHome')} className="h-4 w-4 accent-accent" />
          Works from home
        </label>
        <FormError>{formError(form)}</FormError>
      </form>
    </Dialog>
  );
}

const HALF = { first: 'first half', second: 'second half' };

// A leave recorded from "Adjust balance": it shows with the balance changes
// and, as approved, with the year's leave.
function RecordedLeave({ leave, onRemove }) {
  const canRemove = Boolean(onRemove);
  const note = leave.reason && leave.reason !== 'Recorded by admin' ? leave.reason : '';
  return (
    <li className="flex items-start justify-between gap-2 border-b border-line py-2 pl-5 pr-3 text-sm last:border-b-0">
      <div className="min-w-0 py-1">
        <p className="font-medium">
          <span className="tabular-nums">-{leave.days}</span> {leave.leaveType?.name}
        </p>
        <p className="tabular-nums text-muted">
          Leave taken {dayRange(leave.from, leave.to)}
          {HALF[leave.session] ? `, ${HALF[leave.session]}` : leave.from === leave.to ? ', full day' : ''}
        </p>
        {note && <p className="break-words text-muted">{note}</p>}
        <p className="text-xs text-muted">
          {leave.recordedBy?.name}, {slashDate(isoFromCreatedAt(leave.createdAt))}
        </p>
      </div>
      {canRemove && (
        <div className="flex shrink-0">
          <IconButton label={`Remove recorded ${leave.leaveType?.name}`} onClick={onRemove}>
            <Trash2 className="h-4 w-4" />
          </IconButton>
        </div>
      )}
    </li>
  );
}

export default function EmployeeDetail() {
  const appPath = useAppPath();
  const { id } = useParams();
  const { user: me } = useAuth();
  const [adjusting, setAdjusting] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [toggling, setToggling] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();
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

  const remove = useMutation({
    mutationFn: () => api.delete(`/admin/employees/${id}`),
    onSuccess: () => {
      toast.success(`${data.user.name} deleted`);
      setDeleting(false);
      queryClient.removeQueries({ queryKey: ['employee', id] });
      queryClient.invalidateQueries();
      navigate(appPath('/admin/employees'), { replace: true });
    },
    onError: (issue) => {
      toast.error('Could not delete them', issue.message);
      setDeleting(false);
    },
  });

  const removeChange = useMutation({
    mutationFn: (item) =>
      api.delete(`/admin/employees/${id}/${item.kind === 'leave' ? 'leaves' : 'adjustments'}/${item.id}`),
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

  const { user, balances, monthly, adjustments, recent, recorded = [], year } = data;
  // Someone above you (your manager, say) can be looked at but not changed.
  const canChange = data.canChange !== false;
  // Balance changes and the leave recorded from "Adjust balance", newest first.
  const changes = [
    ...adjustments.map((item) => ({ ...item, kind: 'change' })),
    ...recorded.map((leave) => ({ ...leave, kind: 'leave' })),
  ].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

  return (
    <div className="space-y-4">
      <Reveal>
        <Link
          to={appPath('/admin/employees')}
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
          {canChange ? (
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
              {data.canDelete && (
                <Button variant="danger" onClick={() => setDeleting(true)}>
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  Delete
                </Button>
              )}
            </div>
          ) : data.canDelete ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="danger" onClick={() => setDeleting(true)}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Delete
              </Button>
            </div>
          ) : (
            <p className="rounded-lg bg-sunken px-3 py-2 text-[13px] text-muted">
              View only: {user.name.split(' ')[0]} is above you, so only someone above them can change their details.
            </p>
          )}
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
          {recent.length === 0 && <p className="px-5 py-4 text-sm text-muted">No approved leave this year.</p>}
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
                    {HALF[leave.session] && `, ${HALF[leave.session]}`}
                  </p>
                  {leave.recordedBy && (
                    <p className="text-xs text-muted">Recorded by {leave.recordedBy.name} from Adjust balance</p>
                  )}
                </div>
                <StatusBadge status={leave.status} />
              </li>
            ))}
          </ul>
        </Panel>

        <Panel>
          <PanelTitle>Balance changes</PanelTitle>
          {changes.length === 0 && <p className="px-5 py-4 text-sm text-muted">No manual changes this year.</p>}
          <ul>
            {changes.map((item) =>
              item.kind === 'leave' ? (
                <RecordedLeave key={item.id} leave={item} onRemove={canChange ? () => setRemoving(item) : null} />
              ) : (
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
                  {canChange && (
                    <div className="flex shrink-0">
                      <IconButton label={`Edit ${item.leaveType?.name} change`} onClick={() => setAdjusting({ item })}>
                        <Pencil className="h-4 w-4" />
                      </IconButton>
                      <IconButton label={`Remove ${item.leaveType?.name} change`} onClick={() => setRemoving(item)}>
                        <Trash2 className="h-4 w-4" />
                      </IconButton>
                    </div>
                  )}
                </li>
              ),
            )}
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
        title={removing?.kind === 'leave' ? 'Remove this recorded leave?' : 'Remove this balance change?'}
        body={
          removing?.kind === 'leave'
            ? `${removing.leaveType?.name}, ${dayRange(removing.from, removing.to)}. It is taken off the year's leave, the ${removing.days} ${dayWord(removing.days)} go back to the balance, and the employee is told.`
            : removing
              ? `${removing.days > 0 ? '+' : ''}${removing.days} ${removing.leaveType?.name}. The balance goes back and the employee is told.`
              : ''
        }
        confirmLabel={removing?.kind === 'leave' ? 'Remove leave' : 'Remove change'}
        danger
        loading={removeChange.isPending}
        onConfirm={() => removeChange.mutate(removing)}
      />

      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        title={`Delete ${user.name}?`}
        body={`${user.name} (${user.employeeId}) is removed for good: their account, leave history, balances and notifications. They are signed out at once. Anyone who reported to them will need someone new. This cannot be undone.`}
        confirmLabel="Delete for good"
        danger
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
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
