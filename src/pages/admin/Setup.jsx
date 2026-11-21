import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Tabs } from '../../components/Tabs';
import { z } from 'zod';
import { Button, ConfirmDialog, Dialog, Empty, FormError, IconButton, LoadError, PageHeading, Panel, Reveal, RowsSkeleton, TextInput } from '../../components/ui';
import { api } from '../../lib/api';
import { formError, rules, showServerError, useZodForm } from '../../lib/forms';
import { slashDate, weekday } from '../../lib/dates';
import { useToast } from '../../lib/toast';
import { useAuth } from '../../lib/auth';
import { positionOf } from '../../lib/home';

const DATE_NOTE = 'Subject to change depending on the actual holiday date (as per past experience)';

const typeRules = z.object({
  name: z.string().trim().min(2, 'Write the name.').max(60, 'Keep the name under 60 characters.'),
  annualQuota: z
    .string()
    .trim()
    .min(1, 'Enter the days per year.')
    .refine((value) => !Number.isNaN(Number(value)), 'Enter a number.')
    .refine((value) => Number(value) >= 0 && Number(value) <= 365, 'Use a number from 0 to 365.')
    .refine((value) => Number.isInteger(Number(value) * 2), 'Use whole or half days.'),
  description: rules.text(240, 'The description'),
});

const holidayRules = z.object({
  name: z.string().trim().min(2, 'Write the holiday name.').max(80, 'Keep the name under 80 characters.'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick the date.'),
  note: rules.text(200, 'The note'),
  restricted: z.boolean(),
});

function LeaveTypeDialog({ item, onClose }) {
  const form = useZodForm(typeRules, {
    annualQuota: String(item?.annualQuota ?? 0),
    name: item?.name ?? '',
    description: item?.description ?? '',
  });
  const { errors } = form.formState;
  const queryClient = useQueryClient();
  const toast = useToast();

  const save = useMutation({
    mutationFn: (fields) =>
      api.patch(`/leave-types/${item.id}`, {
        name: fields.name,
        description: fields.description,
        ...(item?.tracksBalance ? { annualQuota: Number(fields.annualQuota) } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success('Leave type saved');
      onClose();
    },
    onError: (issue) => showServerError(form, issue, ['name', 'annualQuota', 'description']),
  });

  return (
    <Dialog
      open={Boolean(item)}
      onClose={onClose}
      title="Edit leave type"
      kind="modal"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="type-form" loading={save.isPending}>
            Save
          </Button>
        </>
      }
    >
      <form id="type-form" className="space-y-4" noValidate onSubmit={form.handleSubmit((fields) => save.mutate(fields))}>
        <TextInput label="Name" maxLength={60} error={errors.name?.message} {...form.register('name')} />
        {item?.tracksBalance && (
          <TextInput
            label="Days per year"
            type="number"
            step="0.5"
            hint="Applies to everyone. Use a balance adjustment for one person."
            error={errors.annualQuota?.message}
            {...form.register('annualQuota')}
          />
        )}
        <TextInput label="Description" maxLength={240} error={errors.description?.message} {...form.register('description')} />
        <FormError>{formError(form)}</FormError>
      </form>
    </Dialog>
  );
}

function LeaveTypes({ canEdit }) {
  const [editing, setEditing] = useState(null);
  const { data, isPending, isError, error, refetch } = useQuery({ queryKey: ['leave-types'], queryFn: () => api.get('/leave-types') });

  return (
    <Panel>
      {isPending && <RowsSkeleton />}
      {isError && <LoadError error={error} onRetry={refetch} />}
      <ul>
        {data?.items.map((type) => (
          <li key={type.id} className="flex items-center justify-between gap-4 border-b border-line px-4 py-3 last:border-b-0 sm:px-5">
            <div className="min-w-0 text-sm">
              <p className="font-medium">{type.name}</p>
              <p className="text-muted">{type.description}</p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <p className="text-right text-sm tabular-nums text-muted">
                {type.tracksBalance ? `${type.annualQuota} days a year` : 'No limit'}
              </p>
              {canEdit && (
                <IconButton label={`Edit ${type.name}`} onClick={() => setEditing(type)}>
                  <Pencil className="h-4 w-4" />
                </IconButton>
              )}
            </div>
          </li>
        ))}
      </ul>
      {editing && <LeaveTypeDialog item={editing} onClose={() => setEditing(null)} />}
    </Panel>
  );
}

function HolidayDialog({ open, item, year, onClose }) {
  const form = useZodForm(holidayRules, {
    name: item?.name ?? '',
    date: item?.date ?? `${year}-01-01`,
    restricted: item?.restricted ?? false,
    note: item?.note ?? DATE_NOTE,
  });
  const { errors } = form.formState;
  const queryClient = useQueryClient();
  const toast = useToast();

  const save = useMutation({
    mutationFn: (fields) => (item ? api.patch(`/holidays/${item.id}`, fields) : api.post('/holidays', fields)),
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success('Holiday saved');
      onClose();
    },
    onError: (issue) => showServerError(form, issue, ['name', 'date', 'note']),
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={item ? 'Edit holiday' : 'Add a holiday'}
      kind="modal"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="holiday-form" loading={save.isPending}>
            Save
          </Button>
        </>
      }
    >
      <form id="holiday-form" className="space-y-4" noValidate onSubmit={form.handleSubmit((fields) => save.mutate(fields))}>
        <TextInput label="Name" maxLength={80} error={errors.name?.message} {...form.register('name')} />
        <TextInput label="Date" type="date" error={errors.date?.message} {...form.register('date')} />
        <TextInput label="Note" maxLength={200} error={errors.note?.message} {...form.register('note')} />
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" {...form.register('restricted')} className="h-5 w-5 accent-accent" />
          Restricted holiday, employees choose to avail it
        </label>
        <FormError>{formError(form)}</FormError>
      </form>
    </Dialog>
  );
}

function Holidays({ canEdit }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [dialog, setDialog] = useState(null);
  const [removing, setRemoving] = useState(null);
  const queryClient = useQueryClient();
  const toast = useToast();

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['holidays', String(year)],
    queryFn: () => api.get(`/holidays?year=${year}`),
  });

  const remove = useMutation({
    mutationFn: (id) => api.delete(`/holidays/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success('Holiday removed');
      setRemoving(null);
    },
    onError: (issue) => {
      toast.error('Could not remove it', issue.message);
      setRemoving(null);
    },
  });

  return (
    <Panel>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-2 sm:px-5">
        <div className="flex items-center gap-1">
          <IconButton label="Previous year" onClick={() => setYear(year - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </IconButton>
          <h2 className="px-1 text-[22px] tabular-nums">{year}</h2>
          <IconButton label="Next year" onClick={() => setYear(year + 1)}>
            <ChevronRight className="h-4 w-4" />
          </IconButton>
        </div>
        {canEdit && (
          <Button variant="secondary" onClick={() => setDialog({ item: null })}>
            Add holiday
          </Button>
        )}
      </div>

      {isPending && <RowsSkeleton />}
      {isError && <LoadError error={error} onRetry={refetch} />}
      {data?.items.length === 0 && <Empty title={`No holidays listed for ${year}`}>Add them here and they appear on every dashboard.</Empty>}
      <ul>
        {data?.items.map((holiday) => (
          <li key={holiday.id} className="flex items-center justify-between gap-4 border-b border-line px-4 py-2 last:border-b-0 sm:px-5">
            <div className="min-w-0 text-sm">
              <p className="font-medium">
                {holiday.name}
                {holiday.restricted && <span className="font-normal text-muted"> (Restricted holiday)</span>}
              </p>
              <p className="tabular-nums text-muted">
                {slashDate(holiday.date)}, {weekday(holiday.date)}
              </p>
            </div>
            {canEdit && (
              <div className="flex shrink-0">
                <IconButton label={`Edit ${holiday.name}`} onClick={() => setDialog({ item: holiday })}>
                  <Pencil className="h-4 w-4" />
                </IconButton>
                <IconButton label={`Remove ${holiday.name}`} onClick={() => setRemoving(holiday)}>
                  <Trash2 className="h-4 w-4" />
                </IconButton>
              </div>
            )}
          </li>
        ))}
      </ul>

      {dialog && <HolidayDialog open item={dialog.item} year={year} onClose={() => setDialog(null)} />}

      <ConfirmDialog
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        title={`Remove ${removing?.name ?? 'this holiday'}?`}
        body="It disappears from every dashboard. Days already booked around it do not change."
        confirmLabel="Remove holiday"
        danger
        loading={remove.isPending}
        onConfirm={() => remove.mutate(removing.id)}
      />
    </Panel>
  );
}

export default function Setup() {
  const { user } = useAuth();
  const [tab, setTab] = useState('holidays');
  // The lists are the same for the whole company: managers change them,
  // assistant managers see them.
  const canEdit = positionOf(user) === 'manager' || positionOf(user) === 'hr';

  return (
    <div>
      <PageHeading title="Setup">
        {canEdit
          ? 'The holiday list and the leave rules everyone works from.'
          : 'The holiday list and the leave rules everyone works from. Your manager changes them.'}
      </PageHeading>
      <Reveal delay={0.08}>
        <Tabs
          label="Setup sections"
          tabs={[
            { id: 'holidays', label: 'Holidays' },
            { id: 'types', label: 'Leave types' },
          ]}
          value={tab}
          onChange={setTab}
          className="mb-4"
        />
        {tab === 'holidays' ? <Holidays canEdit={canEdit} /> : <LeaveTypes canEdit={canEdit} />}
      </Reveal>
    </div>
  );
}
