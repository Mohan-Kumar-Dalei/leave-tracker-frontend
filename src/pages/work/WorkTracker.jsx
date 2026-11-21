import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Download, MessageSquarePlus, Plus, Search, Target, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { z } from 'zod';
import { Tabs } from '../../components/Tabs';
import { WorkDashboard } from './WorkDashboard';
import {
  Button,
  Dialog,
  Empty,
  FormError,
  IconButton,
  LoadError,
  PageHeading,
  Panel,
  PanelTitle,
  Reveal,
  RowsSkeleton,
  SelectBox,
  TextArea,
  TextInput,
} from '../../components/ui';
import { api, toQuery } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { formError, showServerError, useZodForm } from '../../lib/forms';
import { useToast } from '../../lib/toast';

// The work tracker: the team's daily target sheet, as it was kept in Google
// Sheets, but filled in here. A team lead sets the targets; each person fills
// in what they did; the difference shows plus or minus by itself, and the
// month exports as the same sheet.

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const shiftMonth = (month, by) => {
  const [year, number] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, number - 1 + by, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
};
const monthTitle = (month) => {
  const [year, number] = month.split('-').map(Number);
  return `${MONTHS[number - 1]} ${year}`;
};
const dayTitle = (date) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });

// Plus for more than the target, minus for less.
const signed = (value) => (value > 0 ? `+${value}` : String(value));
const tone = (value) => (value > 0 ? 'text-approved' : value < 0 ? 'text-rejected' : 'text-muted');

// The old sheet's colours, a little softer, and dimmed in the dark theme.
const ROW = {
  target: 'bg-[#e8e8e8] dark:bg-white/[0.06]',
  set: 'bg-[#d4eee1] dark:bg-[#b7e1cd]/15',
  achieved: 'bg-[#fbe3cf] dark:bg-[#f9cb9c]/12',
  overtime: 'bg-[#dbe8f5] dark:bg-[#9fc5e8]/12',
  difference: 'bg-[#e6f1e0] dark:bg-[#93c47d]/10',
  sunday: 'bg-[#cfcfcf] dark:bg-white/[0.12]',
};

// Each person's day: the sum of their pieces of work.
function totalsOf(entries) {
  const totals = {};
  for (const entry of entries) {
    const key = `${entry.user}|${entry.date}`;
    totals[key] ??= {
      target: 0,
      achieved: 0,
      overtime: 0,
      filled: false,
      entries: [],
    };
    const total = totals[key];
    total.target += entry.target ?? 0;
    total.overtime += entry.overtime ?? 0;
    if (entry.achieved !== null && entry.achieved !== undefined) {
      total.achieved += entry.achieved;
      total.filled = true;
    }
    total.entries.push(entry);
  }
  return totals;
}

const countRule = (label) =>
  z
    .string()
    .trim()
    .refine((value) => value === '' || (!Number.isNaN(Number(value)) && Number(value) >= 0), `${label} must be 0 or more.`)
    .refine((value) => value === '' || Number(value) <= 100000, `${label} is too big.`);
const toCount = (value) => (value === '' || value === undefined ? undefined : Number(value));

/* One person's day: their pieces of work, with the target (for a lead) and
   what was achieved (for them, or a lead). */

function WorkLine({ entry, person, day, today, onDone, wide = false }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const future = day.date > today;
  const form = useZodForm(
    z.object({
      task: z.string().trim().min(1, 'Name the work.').max(60, 'Keep it under 60 characters.'),
      target: countRule('The target'),
      achieved: countRule('Achieved'),
      overtime: countRule('OT'),
    }),
    {
      task: entry?.task ?? '',
      target: entry ? String(entry.target ?? 0) : '',
      achieved: entry?.achieved === null || entry?.achieved === undefined ? '' : String(entry.achieved),
      overtime: entry?.overtime ? String(entry.overtime) : '',
    },
  );
  const { errors } = form.formState;

  const save = useMutation({
    mutationFn: (fields) =>
      api.put('/work/entries', {
        user: person.id,
        date: day.date,
        task: fields.task,
        ...(person.canLead && fields.target !== '' ? { target: toCount(fields.target) } : {}),
        ...(person.canFill && !future
          ? {
              achieved: fields.achieved === '' ? null : toCount(fields.achieved),
              overtime: toCount(fields.overtime) ?? 0,
            }
          : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work'] });
      toast.success('Saved');
      onDone?.();
    },
    onError: (issue) => showServerError(form, issue, ['task', 'target', 'achieved', 'overtime']),
  });
  const remove = useMutation({
    mutationFn: () => api.delete(`/work/entries/${entry.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work'] });
      toast.success('Removed');
    },
    onError: (issue) => toast.error('Could not remove it', issue.message),
  });

  const achieved = form.watch('achieved');
  const target = form.watch('target');
  const difference = achieved !== '' && target !== '' ? Number(achieved) - Number(target) : null;

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((fields) => save.mutate(fields))}
      className={`grid grid-cols-3 gap-3 border-b border-line py-3 last:border-b-0 ${wide ? 'sm:grid-cols-[1.4fr_1fr_1fr_0.8fr_auto] sm:items-start' : ''}`}
    >
      <div className={wide ? 'col-span-3 sm:col-span-1' : 'col-span-3'}>
        <TextInput
          label="Work"
          list="work-tasks"
          disabled={!person.canLead && Boolean(entry)}
          error={errors.task?.message}
          {...form.register('task')}
        />
      </div>
      <TextInput
        label="Target"
        inputMode="decimal"
        disabled={!person.canLead}
        error={errors.target?.message}
        {...form.register('target')}
      />
      <TextInput
        label="Achieved"
        inputMode="decimal"
        disabled={!person.canFill || future}
        hint={future ? 'On the day' : undefined}
        error={errors.achieved?.message}
        {...form.register('achieved')}
      />
      <TextInput
        label="OT"
        inputMode="decimal"
        disabled={!person.canFill || future}
        error={errors.overtime?.message}
        {...form.register('overtime')}
      />
      <div className={`col-span-3 flex items-center justify-between gap-2 ${wide ? 'sm:col-span-1 sm:flex-col sm:items-end sm:pt-6' : ''}`}>
        <span className={`text-sm font-semibold tabular-nums ${difference === null ? 'text-muted' : tone(difference)}`}>
          {difference === null ? '—' : signed(difference)}
        </span>
        <div className="flex items-center gap-1">
          {entry && person.canLead && (
            <IconButton label={`Remove ${entry.task}`} onClick={() => remove.mutate()}>
              <Trash2 className="h-4 w-4" />
            </IconButton>
          )}
          <Button type="submit" variant="secondary" loading={save.isPending}>
            Save
          </Button>
        </div>
      </div>
      {formError(form) && (
        <div className="col-span-full">
          <FormError>{formError(form)}</FormError>
        </div>
      )}
    </form>
  );
}

/* Comments on a day, like the comments people put on a cell in the Google
   Sheet with Ctrl+Alt+M: what they did ("Total no. of URLs inspected 120,
   fixed 46..."), and their lead's answer. */

const EXAMPLE = 'Date 22.04.2026\nTask broken RSS\nTotal no. of URLs inspected 120\nNo. of Integrated/fixed RSS 46\nPending (doubt) 24';

// The comments of each day, by person and date.
function commentsOf(comments) {
  const byDay = {};
  for (const comment of comments) (byDay[`${comment.user}|${comment.date}`] ??= []).push(comment);
  return byDay;
}

const postedAt = (value) => new Date(value).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function Comments({ person, day, comments = [], focus = false, tasks = [] }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const form = useZodForm(z.object({ text: z.string().trim().min(1, 'Write the comment.').max(2000, 'Keep it under 2000 characters.') }), {
    text: '',
  });
  const { errors } = form.formState;
  const post = useMutation({
    mutationFn: ({ text }) => api.post('/work/comments', { user: person.id, date: day.date, text }),
    onSuccess: () => {
      form.reset({ text: '' });
      queryClient.invalidateQueries({ queryKey: ['work'] });
    },
    onError: (issue) => showServerError(form, issue, ['text']),
  });
  const remove = useMutation({
    mutationFn: (id) => api.delete(`/work/comments/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['work'] }),
    onError: (issue) => toast.error('Could not remove it', issue.message),
  });
  // The usual format, filled in with the day and the work.
  const fillFormat = () => {
    const [year, month, date] = day.date.split('-');
    form.setValue('text', `Date ${date}.${month}.${year}\nTask ${tasks[0] ?? ''}\n`, { shouldFocus: true });
  };
  const submit = form.handleSubmit((fields) => post.mutate(fields));

  return (
    <section aria-label="Comments" className="mt-4 border-t border-line pt-4">
      <h3 className="mb-2 text-sm font-semibold">
        Comments {comments.length > 0 && <span className="font-normal text-muted">({comments.length})</span>}
      </h3>
      {comments.length === 0 && !person.canFill && <p className="text-sm text-muted">No comments on this day.</p>}
      <ul className="space-y-2">
        {comments.map((comment) => (
          <li key={comment.id} className="rounded-lg border-l-4 border-[#f2a93b] bg-sunken px-3 py-2">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[13px]">
                <span className="font-semibold">{comment.author.name}</span>
                <span className="text-muted"> · {postedAt(comment.createdAt)}</span>
              </p>
              {comment.mine && (
                <IconButton label="Remove this comment" className="-my-1 -mr-2" onClick={() => remove.mutate(comment.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </IconButton>
              )}
            </div>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm">{comment.text}</p>
          </li>
        ))}
      </ul>
      {person.canFill && (
        <form noValidate onSubmit={submit} className="mt-3">
          <TextArea
            label="Add a comment"
            rows={4}
            data-autofocus={focus ? true : undefined}
            placeholder={EXAMPLE}
            hint="Ctrl+Enter posts it. It goes into the exported sheet as the cell's note."
            error={errors.text?.message}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) submit(event);
            }}
            {...form.register('text')}
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <button type="button" className="text-sm text-accent hover:underline" onClick={fillFormat}>
              Use the usual format
            </button>
            <Button type="submit" variant="secondary" loading={post.isPending}>
              <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
              Comment
            </Button>
          </div>
          <FormError>{formError(form)}</FormError>
        </form>
      )}
    </section>
  );
}

function DayDialog({ open, person, day, total, today, tasks, comments, focusComment, onClose }) {
  const [adding, setAdding] = useState(false);
  const entries = total?.entries ?? [];
  const mayChange = person?.canLead || person?.canFill;
  // Working from home is one piece of work a day.
  const canAdd = mayChange && !(person?.workFromHome && entries.length > 0);
  return (
    <Dialog open={open} onClose={onClose} title={person ? `${person.name}, ${dayTitle(day.date)}` : ''} kind="modal">
      {person && (
        <div>
          <datalist id="work-tasks">
            {tasks.map((task) => (
              <option key={task} value={task} />
            ))}
          </datalist>
          {person.away?.[day.date] && (
            <p className="mb-2 rounded-lg bg-pending-soft px-3 py-2 text-sm text-pending">
              On {person.away[day.date] === 'full' ? 'leave' : 'half-day leave'} this day.
            </p>
          )}
          {person.workFromHome && <p className="mb-1 text-sm text-muted">Works from home: one piece of work a day.</p>}
          {entries.length === 0 && !adding && <p className="py-3 text-sm text-muted">No work set for this day yet.</p>}
          {mayChange ? (
            entries.map((entry) => (
              <WorkLine key={`${entry.id}-${entry.updatedAt}`} entry={entry} person={person} day={day} today={today} />
            ))
          ) : (
            <ul className="divide-y divide-line text-sm">
              {entries.map((entry) => (
                <li key={entry.id} className="flex justify-between gap-3 py-2">
                  <span>{entry.task}</span>
                  <span className="tabular-nums text-muted">
                    {entry.achieved ?? '—'} of {entry.target}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {adding && <WorkLine person={person} day={day} today={today} onDone={() => setAdding(false)} />}
          {canAdd && !adding && (
            <Button variant="ghost" className="mt-2" onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              {entries.length ? 'Add other work' : 'Add work'}
            </Button>
          )}
          <Comments person={person} day={day} comments={comments} focus={focusComment} tasks={entries.map((entry) => entry.task)} />
        </div>
      )}
    </Dialog>
  );
}

// A search box for people's names.
function SearchField({ value, onChange, label, className = '' }) {
  return (
    <label className={`relative block ${className}`}>
      <span className="sr-only">{label}</span>
      <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={label}
        className="h-10 w-full rounded-lg border border-line bg-surface pr-3 pl-9 text-base placeholder:text-muted focus:border-accent focus:ring-3 focus:ring-accent/20 focus:outline-none sm:text-sm"
      />
    </label>
  );
}

/* Setting a target for several people on one day. */

function TargetsDialog({ open, sheet, onClose }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const leadable = sheet.people.filter((person) => person.canLead);
  const [picked, setPicked] = useState(() => new Set());
  const [find, setFind] = useState('');
  const shown = leadable.filter((person) => person.label.toLowerCase().includes(find.trim().toLowerCase()));
  const allShown = shown.length > 0 && shown.every((person) => picked.has(person.id));
  const first = sheet.days[0].date;
  const lastDay = sheet.days[sheet.days.length - 1].date;
  const start = sheet.today >= first && sheet.today <= lastDay ? sheet.today : (sheet.days.find((day) => !day.sunday)?.date ?? first);
  const form = useZodForm(
    z.object({
      task: z.string().trim().min(1, 'Name the work, like Profiles.').max(60, 'Keep it under 60 characters.'),
      target: z
        .string()
        .trim()
        .min(1, 'Enter the daily target.')
        .refine((value) => !Number.isNaN(Number(value)) && Number(value) >= 0 && Number(value) <= 100000, 'Use a number from 0 to 100000.'),
      date: z.string().min(1, 'Pick the day.'),
    }),
    { task: sheet.tasks[0] ?? '', target: '', date: start },
  );
  const { errors } = form.formState;
  const [pickError, setPickError] = useState('');

  const save = useMutation({
    mutationFn: ({ date, ...fields }) =>
      api.post('/work/targets', {
        ...fields,
        from: date,
        to: date,
        target: Number(fields.target),
        users: [...picked],
      }),
    onSuccess: ({ set }) => {
      queryClient.invalidateQueries({ queryKey: ['work'] });
      if (set === 0) toast.error('No target set', 'That day is a Sunday or a holiday, or they are on leave.');
      else toast.success('Targets set', `${set} ${set === 1 ? 'person' : 'people'}. Anyone on leave that day was left out.`);
      onClose();
    },
    onError: (issue) => showServerError(form, issue, ['task', 'target', 'date']),
  });

  const toggle = (id) =>
    setPicked((now) => {
      const next = new Set(now);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Set daily targets"
      kind="modal"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="targets-form" loading={save.isPending}>
            Set targets
          </Button>
        </>
      }
    >
      <form
        id="targets-form"
        noValidate
        className="space-y-4"
        onSubmit={form.handleSubmit(
          (fields) => {
            if (picked.size === 0) {
              setPickError('Pick at least one person.');
              return;
            }
            save.mutate(fields);
          },
          () => picked.size === 0 && setPickError('Pick at least one person.'),
        )}
      >
        <fieldset>
          <div className="mb-1.5 flex items-center justify-between">
            <legend className="text-sm font-medium">People</legend>
            <span className="flex items-center gap-3 text-sm">
              {picked.size > 0 && <span className="text-muted">{picked.size} picked</span>}
              <button
                type="button"
                className="text-accent hover:underline"
                onClick={() =>
                  setPicked((now) => {
                    const next = new Set(now);
                    for (const person of shown) {
                      if (allShown) next.delete(person.id);
                      else next.add(person.id);
                    }
                    return next;
                  })
                }
              >
                {allShown ? 'Clear these' : find.trim() ? 'Pick these' : 'Everyone'}
              </button>
            </span>
          </div>
          <SearchField value={find} onChange={setFind} label="Search people" className="mb-2" />
          <div className={`max-h-48 overflow-y-auto rounded-lg border ${pickError ? 'border-rejected' : 'border-line'}`}>
            {shown.length === 0 && <p className="px-3 py-3 text-sm text-muted">Nobody by that name.</p>}
            {shown.map((person) => (
              <label key={person.id} className="flex min-h-10 items-center gap-3 border-b border-line px-3 text-sm last:border-b-0">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-accent"
                  checked={picked.has(person.id)}
                  onChange={() => {
                    toggle(person.id);
                    setPickError('');
                  }}
                />
                <span className="min-w-0 flex-1 truncate">{person.label}</span>
              </label>
            ))}
          </div>
          {pickError && <p className="mt-1.5 text-sm text-rejected">{pickError}</p>}
        </fieldset>
        <datalist id="target-tasks">
          {sheet.tasks.map((task) => (
            <option key={task} value={task} />
          ))}
        </datalist>
        <div className="grid grid-cols-2 gap-3">
          <TextInput label="Work" list="target-tasks" placeholder="Profiles" error={errors.task?.message} {...form.register('task')} />
          <TextInput
            label="Daily target"
            inputMode="decimal"
            placeholder="100"
            error={errors.target?.message}
            {...form.register('target')}
          />
          <div className="col-span-2">
            <TextInput label="Day" type="date" error={errors.date?.message} {...form.register('date')} />
          </div>
        </div>
        <p className="text-sm text-muted">
          Not on a Sunday or a holiday, or for anyone on leave that day. People working from home get this as their one piece of work.
        </p>
        <FormError>{formError(form)}</FormError>
      </form>
    </Dialog>
  );
}

/* The sheet itself. */

// Ctrl+Alt+M on a cell opens its comments, as in Google Sheets.
const isCommentKey = (event) => event.ctrlKey && event.altKey && event.key.toLowerCase() === 'm';

function Cell({ children, className = '', onClick, onComment, label, notes }) {
  const base = `relative h-8 min-w-12 border-b border-r border-line/70 px-1.5 text-center text-[13px] tabular-nums ${className}`;
  // A cell with comments has the sheet's little corner mark, and shows the
  // latest one when you point at it.
  const mark = notes?.length ? (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute top-0 right-0 h-0 w-0 border-t-[9px] border-l-[9px] border-t-[#f2a93b] border-l-transparent"
    />
  ) : null;
  const latest = notes?.at(-1);
  const title = latest ? `${latest.author.name}: ${latest.text}${notes.length > 1 ? `  (+${notes.length - 1} more)` : ''}` : undefined;
  if (!onClick)
    return (
      <td className={base} title={title}>
        {mark}
        {children}
      </td>
    );
  return (
    <td className={`${base} p-0`}>
      {mark}
      <button
        type="button"
        aria-label={`${label}${notes?.length ? `, ${notes.length} comment${notes.length > 1 ? 's' : ''}` : ''}`}
        title={title}
        aria-keyshortcuts={onComment ? 'Control+Alt+M' : undefined}
        onClick={onClick}
        onKeyDown={(event) => {
          if (onComment && isCommentKey(event)) {
            event.preventDefault();
            onComment();
          }
        }}
        className="h-full w-full px-1.5 hover:bg-accent/10 focus-visible:outline-2 focus-visible:outline-accent"
      >
        {children}
      </button>
    </td>
  );
}

function NameCell({ children, className = '', strong = false }) {
  return (
    <th
      scope="row"
      className={`sticky left-0 z-10 h-8 max-w-32 min-w-32 truncate border-b border-r border-line px-2 text-left text-[12px] sm:max-w-56 sm:min-w-44 sm:px-3 sm:text-[13px] ${strong ? 'font-semibold' : 'font-normal text-muted'} ${className}`}
    >
      {children}
    </th>
  );
}

function Sheet({ sheet, totals, notes, search = '', onOpen }) {
  const { days, today } = sheet;
  const words = search.trim().toLowerCase();
  const people = words ? sheet.people.filter((person) => person.label.toLowerCase().includes(words)) : sheet.people;
  const sum = (id, field) => days.reduce((total, day) => total + (day.sunday ? 0 : (totals[`${id}|${day.date}`]?.[field] ?? 0)), 0);
  const team = (date, field) => people.reduce((total, person) => total + (totals[`${person.id}|${date}`]?.[field] ?? 0), 0);
  const teamTotal = (field) => days.reduce((total, day) => total + (day.sunday ? 0 : team(day.date, field)), 0);

  // Difference: shown once the day has come (unfilled counts as 0, as in the sheet).
  const differenceOf = (total, day) => {
    if (day.sunday || day.date > today) return null;
    if (!total || (total.target === 0 && !total.filled)) return null;
    // Today waits until it is filled in.
    if (day.date === today && !total.filled) return null;
    return (total.filled ? total.achieved : 0) - total.target;
  };

  return (
    <div className="max-h-[70vh] overflow-auto rounded-xl border border-line bg-surface">
      <table className="border-separate border-spacing-0">
        <thead className="sticky top-0 z-20">
          <tr>
            <th className="sticky left-0 z-30 h-9 min-w-32 border-b border-r border-line sm:min-w-44 bg-[#fff59a] px-3 text-left text-[13px] font-semibold text-[#12141a] dark:bg-[#5c5520] dark:text-ink">
              {monthTitle(sheet.month)}
            </th>
            <th className="h-9 border-b border-r border-line bg-[#fff59a] px-2 text-[13px] font-semibold text-[#12141a] dark:bg-[#5c5520] dark:text-ink">
              Total
            </th>
            {days.map((day) => (
              <th
                key={day.date}
                title={day.holiday ?? undefined}
                className={`h-9 min-w-12 border-b border-r border-line px-1 text-center text-[12px] leading-tight ${
                  day.date === today
                    ? 'bg-accent text-on-accent'
                    : day.holiday
                      ? 'bg-[#fbd5a5] text-[#12141a] dark:bg-[#7a4f1d] dark:text-ink'
                      : 'bg-[#fff59a] text-[#12141a] dark:bg-[#5c5520] dark:text-ink'
                }`}
              >
                <span className="block font-semibold">{Number(day.date.slice(8))}</span>
                <span className="block font-normal opacity-80">{day.weekday}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[
            ['Total daily target', 'target', ROW.target],
            ['Total achieved', 'achieved', ROW.achieved],
            ['Additional (OT)', 'overtime', ROW.overtime],
          ].map(([label, field, colour]) => (
            <tr key={field}>
              <NameCell strong className={`bg-surface ${colour}`}>
                {label}
              </NameCell>
              <Cell className={`font-semibold ${colour}`}>{teamTotal(field) || ''}</Cell>
              {days.map((day) => (
                <Cell key={day.date} className={day.sunday ? ROW.sunday : colour}>
                  {day.sunday ? '' : team(day.date, field) || ''}
                </Cell>
              ))}
            </tr>
          ))}
          <tr>
            <NameCell strong className={`bg-surface ${ROW.difference}`}>
              Difference
            </NameCell>
            <Cell className={`font-semibold ${ROW.difference} ${tone(teamTotal('achieved') - teamTotal('target'))}`}>
              {signed(teamTotal('achieved') - teamTotal('target'))}
            </Cell>
            {days.map((day) => {
              const waiting = day.date === today && !people.some((person) => totals[`${person.id}|${day.date}`]?.filled);
              const value = day.sunday || day.date > today || waiting ? null : team(day.date, 'achieved') - team(day.date, 'target');
              return (
                <Cell
                  key={day.date}
                  className={`${day.sunday ? ROW.sunday : ROW.difference} ${value === null ? '' : tone(value)} font-medium`}
                >
                  {value === null ? '' : signed(value)}
                </Cell>
              );
            })}
          </tr>

          {people.map((person) => {
            const difference = sum(person.id, 'achieved') - sum(person.id, 'target');
            const said = (day) => notes[`${person.id}|${day.date}`];
            // Your own row (or your team's) opens to fill in; anyone else's
            // opens only to read its comments.
            const open = (day) => (day.sunday || !(person.canLead || person.canFill || said(day)) ? undefined : () => onOpen(person, day));
            const comment = (day) => (day.sunday || !(person.canFill || said(day)) ? undefined : () => onOpen(person, day, true));
            return [
              <tr key={`${person.id}-gap`} aria-hidden="true">
                <td colSpan={days.length + 2} className="h-3 border-b border-line bg-bg" />
              </tr>,
              <tr key={`${person.id}-target`}>
                <NameCell strong className="bg-surface">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate">{person.label}</span>
                    {person.position !== 'employee' && (
                      <span className="shrink-0 rounded bg-accent-soft px-1 text-[10px] font-semibold uppercase text-accent">
                        {
                          {
                            manager: 'Mgr',
                            assistantmanager: 'AM',
                            teamlead: 'TL',
                          }[person.position]
                        }
                      </span>
                    )}
                  </span>
                </NameCell>
                <Cell className={`font-semibold ${ROW.target}`}>{sum(person.id, 'target') || ''}</Cell>
                {days.map((day) => {
                  const total = totals[`${person.id}|${day.date}`];
                  const away = person.away?.[day.date];
                  return (
                    <Cell
                      key={day.date}
                      label={`${person.name}, ${day.date}: target`}
                      onClick={open(day)}
                      className={day.sunday ? ROW.sunday : total?.target ? ROW.set : ROW.target}
                    >
                      {day.sunday ? (
                        ''
                      ) : away && !total?.target ? (
                        <span className="text-[11px] font-semibold text-pending">{away === 'full' ? 'Leave' : '½'}</span>
                      ) : (
                        total?.target || ''
                      )}
                    </Cell>
                  );
                })}
              </tr>,
              <tr key={`${person.id}-achieved`}>
                <NameCell className={`bg-surface ${ROW.achieved}`}>Daily achieved</NameCell>
                <Cell className={`font-semibold ${ROW.achieved}`}>{sum(person.id, 'achieved') || ''}</Cell>
                {days.map((day) => {
                  const total = totals[`${person.id}|${day.date}`];
                  return (
                    <Cell
                      key={day.date}
                      label={`${person.name}, ${day.date}: achieved`}
                      onClick={open(day)}
                      onComment={comment(day)}
                      notes={said(day)}
                      className={day.sunday ? ROW.sunday : ROW.achieved}
                    >
                      {total?.filled ? total.achieved : ''}
                    </Cell>
                  );
                })}
              </tr>,
              <tr key={`${person.id}-ot`}>
                <NameCell className={`bg-surface ${ROW.overtime}`}>Additional (OT)</NameCell>
                <Cell className={`font-semibold ${ROW.overtime}`}>{sum(person.id, 'overtime') || ''}</Cell>
                {days.map((day) => (
                  <Cell key={day.date} className={day.sunday ? ROW.sunday : ROW.overtime}>
                    {totals[`${person.id}|${day.date}`]?.overtime || ''}
                  </Cell>
                ))}
              </tr>,
              <tr key={`${person.id}-difference`}>
                <NameCell className={`bg-surface ${ROW.difference}`}>Difference</NameCell>
                <Cell className={`font-semibold ${ROW.difference} ${tone(difference)}`}>{signed(difference)}</Cell>
                {days.map((day) => {
                  const value = differenceOf(totals[`${person.id}|${day.date}`], day);
                  return (
                    <Cell
                      key={day.date}
                      className={`${day.sunday ? ROW.sunday : ROW.difference} ${value === null ? '' : tone(value)} font-medium`}
                    >
                      {value === null ? '' : signed(value)}
                    </Cell>
                  );
                })}
              </tr>,
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}

/* My work: today's work for the person signed in, to fill in quickly. */

function MyDay({ sheet, me, totals, tasks, notes }) {
  const day = sheet.days.find((item) => item.date === sheet.today);
  const [adding, setAdding] = useState(false);
  if (!day) return <Empty title="This is not this month">Go to this month to fill in today's work.</Empty>;
  if (day.sunday) return <Empty title="Sunday is off">Nothing to fill in today.</Empty>;
  const total = totals[`${me.id}|${day.date}`];
  const entries = total?.entries ?? [];
  // So far: the days gone by, and today once it is filled in.
  const counted = sheet.days.filter((item) => {
    if (item.sunday || item.date > sheet.today) return false;
    return item.date < sheet.today || totals[`${me.id}|${item.date}`]?.filled;
  });
  const target = counted.reduce((sum, item) => sum + (totals[`${me.id}|${item.date}`]?.target ?? 0), 0);
  const achieved = counted.reduce((sum, item) => sum + (totals[`${me.id}|${item.date}`]?.achieved ?? 0), 0);
  const canAdd = !(me.workFromHome && entries.length > 0);

  return (
    <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
      <Panel>
        <PanelTitle>Today, {dayTitle(day.date)}</PanelTitle>
        <div className="px-4 pb-3 sm:px-5">
          <datalist id="work-tasks">
            {tasks.map((task) => (
              <option key={task} value={task} />
            ))}
          </datalist>
          {entries.length === 0 && !adding && (
            <p className="py-3 text-sm text-muted">No target set for today yet. You can still fill in what you did.</p>
          )}
          {entries.map((entry) => (
            <WorkLine key={`${entry.id}-${entry.updatedAt}`} entry={entry} person={me} day={day} today={sheet.today} wide />
          ))}
          {adding && <WorkLine person={me} day={day} today={sheet.today} onDone={() => setAdding(false)} wide />}
          {canAdd && !adding && (
            <Button variant="ghost" className="mt-2" onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              {entries.length ? 'Add other work' : 'Add work'}
            </Button>
          )}
          <Comments person={me} day={day} comments={notes[`${me.id}|${day.date}`]} tasks={entries.map((entry) => entry.task)} />
        </div>
      </Panel>
      <Panel>
        <PanelTitle>{monthTitle(sheet.month)} so far</PanelTitle>
        <dl className="grid grid-cols-3 gap-2 px-4 pb-4 text-center sm:px-5">
          {[
            ['Target', target, 'text-ink'],
            ['Achieved', achieved, 'text-ink'],
            ['Difference', signed(achieved - target), tone(achieved - target)],
          ].map(([label, value, colour]) => (
            <div key={label} className="rounded-lg bg-sunken px-2 py-3">
              <dt className="text-xs text-muted">{label}</dt>
              <dd className={`mt-1 text-lg font-semibold tabular-nums ${colour}`}>{value}</dd>
            </div>
          ))}
        </dl>
      </Panel>
    </div>
  );
}

export default function WorkTracker() {
  const { user } = useAuth();
  const [month, setMonth] = useState(null);
  const [department, setDepartment] = useState(null);
  const [tab, setTab] = useState('mine');
  const [opened, setOpened] = useState(null);
  const [setting, setSetting] = useState(false);
  const [search, setSearch] = useState('');

  const query = {
    month: month ?? undefined,
    department: department ?? undefined,
  };
  const {
    data: sheet,
    isPending,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['work', month, department],
    queryFn: () => api.get(`/work/sheet${toQuery(query)}`),
    placeholderData: (previous) => previous,
  });
  const totals = useMemo(() => totalsOf(sheet?.entries ?? []), [sheet]);
  const notes = useMemo(() => commentsOf(sheet?.comments ?? []), [sheet]);

  if (isPending) return <RowsSkeleton rows={8} />;
  if (isError) return <LoadError error={error} onRetry={refetch} />;

  const me = sheet.people.find((person) => person.id === user.id);
  // Someone not on this sheet (a manager looking at another department) has
  // no day of their own to fill in.
  const shownTab = me || tab !== 'mine' ? tab : 'dashboard';
  const exportHref = `/api/work/sheet.xlsx${toQuery({ month: sheet.month, department: sheet.department })}`;
  const openedTotal = opened ? totals[`${opened.person.id}|${opened.day.date}`] : null;
  const openedPerson = opened ? sheet.people.find((person) => person.id === opened.person.id) : null;

  return (
    <div>
      <PageHeading
        title="Work tracker"
        actions={
          <>
            {sheet.canLead && (
              <Button onClick={() => setSetting(true)}>
                <Target className="h-4 w-4" aria-hidden="true" />
                Set targets
              </Button>
            )}
            <a
              href={exportHref}
              download
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-line bg-surface px-3.5 text-sm font-medium hover:bg-sunken"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Export sheet
            </a>
          </>
        }
      >
        Daily targets and what everyone achieved, like the team sheet. Plus means more than the target, minus means less.
      </PageHeading>

      <Reveal delay={0.06} className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs
          label="Work tracker views"
          tabs={[
            ...(me ? [{ id: 'mine', label: 'My work' }] : []),
            { id: 'dashboard', label: 'Dashboard' },
            { id: 'sheet', label: 'Team sheet' },
          ]}
          value={shownTab}
          onChange={setTab}
        />
        <div className="flex flex-wrap items-center gap-2">
          {(shownTab === 'sheet' ||
            (shownTab === 'dashboard' &&
              (!me || me.position !== 'employee' || sheet.people.some((person) => person.reportsTo === me.id)))) && (
            <SearchField value={search} onChange={setSearch} label="Search people" className="w-full sm:w-56" />
          )}
          {sheet.departments.length > 1 && (
            <SelectBox aria-label="Department" value={sheet.department} onChange={(event) => setDepartment(event.target.value)}>
              {sheet.departments.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </SelectBox>
          )}
          <div className="flex items-center gap-1">
            <IconButton label="Previous month" onClick={() => setMonth(shiftMonth(sheet.month, -1))}>
              <ChevronLeft className="h-4 w-4" />
            </IconButton>
            <h2 className="min-w-36 text-center text-base font-semibold tabular-nums">{monthTitle(sheet.month)}</h2>
            <IconButton label="Next month" onClick={() => setMonth(shiftMonth(sheet.month, 1))}>
              <ChevronRight className="h-4 w-4" />
            </IconButton>
          </div>
        </div>
      </Reveal>

      <Reveal delay={0.1}>
        {shownTab === 'mine' && me ? (
          <MyDay sheet={sheet} me={me} totals={totals} tasks={sheet.tasks} notes={notes} />
        ) : shownTab === 'dashboard' ? (
          <WorkDashboard key={`${sheet.month}|${sheet.department}`} sheet={sheet} me={me} notes={notes} search={search} />
        ) : sheet.people.length === 0 ? (
          <Empty title="Nobody here yet">People in this department appear here.</Empty>
        ) : (
          <>
            <Sheet
              sheet={sheet}
              totals={totals}
              notes={notes}
              search={search}
              onOpen={(person, day, comment = false) => setOpened({ person, day, comment })}
            />
            <p className="mt-2 text-xs text-muted">
              Tap a day to set a target or fill in work. A corner mark means a comment: point at it to read it, or select a day and press
              Ctrl+Alt+M to add one. Today is highlighted; holidays are orange; Sundays are grey.
            </p>
          </>
        )}
      </Reveal>

      <DayDialog
        key={opened ? `${opened.person.id}|${opened.day.date}` : 'none'}
        open={Boolean(opened)}
        person={openedPerson}
        day={opened?.day ?? sheet.days[0]}
        total={openedTotal}
        today={sheet.today}
        tasks={sheet.tasks}
        comments={opened ? notes[`${opened.person.id}|${opened.day.date}`] : []}
        focusComment={Boolean(opened?.comment)}
        onClose={() => setOpened(null)}
      />
      {setting && <TargetsDialog open sheet={sheet} onClose={() => setSetting(false)} />}
    </div>
  );
}
