import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Tabs } from '../../components/Tabs';
import { Button, ConfirmDialog, Dialog, Empty, IconButton, LoadError, PageHeading, Panel, Reveal, RowsSkeleton, TextInput } from '../../components/ui';
import { api } from '../../lib/api';
import { slashDate, weekday } from '../../lib/dates';
import { useToast } from '../../lib/toast';

const DATE_NOTE = 'Subject to change depending on the actual holiday date (as per past experience)';

function LeaveTypeDialog({ item, onClose }) {
  const [form, setForm] = useState({ annualQuota: item?.annualQuota ?? 0, name: item?.name ?? '', description: item?.description ?? '' });
  const [error, setError] = useState('');
  const queryClient = useQueryClient();
  const toast = useToast();

  const save = useMutation({
    mutationFn: () => api.patch(`/leave-types/${item.id}`, { ...form, annualQuota: Number(form.annualQuota) }),
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success('Leave type saved');
      onClose();
    },
    onError: (issue) => setError(issue.message),
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
      <form
        id="type-form"
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          setError('');
          save.mutate();
        }}
      >
        <TextInput label="Name" required maxLength={60} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        {item?.tracksBalance && (
          <TextInput
            label="Days per year"
            type="number"
            min="0"
            max="365"
            step="0.5"
            required
            value={form.annualQuota}
            hint="Applies to everyone. Use a balance adjustment for one person."
            onChange={(event) => setForm({ ...form, annualQuota: event.target.value })}
          />
        )}
        <TextInput label="Description" maxLength={240} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        {error && (
          <p role="alert" className="text-sm text-rejected">
            {error}
          </p>
        )}
      </form>
    </Dialog>
  );
}

function LeaveTypes() {
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
              <IconButton label={`Edit ${type.name}`} onClick={() => setEditing(type)}>
                <Pencil className="h-4 w-4" />
              </IconButton>
            </div>
          </li>
        ))}
      </ul>
      {editing && <LeaveTypeDialog item={editing} onClose={() => setEditing(null)} />}
    </Panel>
  );
}

function HolidayDialog({ open, item, year, onClose }) {
  const [form, setForm] = useState({
    name: item?.name ?? '',
    date: item?.date ?? `${year}-01-01`,
    restricted: item?.restricted ?? false,
    note: item?.note ?? DATE_NOTE,
  });
  const [error, setError] = useState('');
  const queryClient = useQueryClient();
  const toast = useToast();

  const save = useMutation({
    mutationFn: () => (item ? api.patch(`/holidays/${item.id}`, form) : api.post('/holidays', form)),
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success('Holiday saved');
      onClose();
    },
    onError: (issue) => setError(issue.message),
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
      <form
        id="holiday-form"
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          setError('');
          save.mutate();
        }}
      >
        <TextInput label="Name" required maxLength={80} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        <TextInput label="Date" type="date" required value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />
        <TextInput label="Note" maxLength={200} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} />
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={form.restricted}
            onChange={(event) => setForm({ ...form, restricted: event.target.checked })}
            className="h-5 w-5 accent-accent"
          />
          Restricted holiday, employees choose to avail it
        </label>
        {error && (
          <p role="alert" className="text-sm text-rejected">
            {error}
          </p>
        )}
      </form>
    </Dialog>
  );
}

function Holidays() {
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
        <Button variant="secondary" onClick={() => setDialog({ item: null })}>
          Add holiday
        </Button>
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
            <div className="flex shrink-0">
              <IconButton label={`Edit ${holiday.name}`} onClick={() => setDialog({ item: holiday })}>
                <Pencil className="h-4 w-4" />
              </IconButton>
              <IconButton label={`Remove ${holiday.name}`} onClick={() => setRemoving(holiday)}>
                <Trash2 className="h-4 w-4" />
              </IconButton>
            </div>
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
  const [tab, setTab] = useState('holidays');

  return (
    <div>
      <PageHeading title="Setup">The holiday list and the leave rules everyone works from.</PageHeading>
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
        {tab === 'holidays' ? <Holidays /> : <LeaveTypes />}
      </Reveal>
    </div>
  );
}
