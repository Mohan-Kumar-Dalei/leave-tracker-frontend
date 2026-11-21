import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  MessageSquare,
  MessageSquarePlus,
  Pencil,
  Plus,
  Search,
  Target,
  Trash2,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { z } from 'zod';
import { Tabs } from '../../components/Tabs';
import { SheetGrid } from './SheetGrid';
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
  RowsSkeleton,
  SelectBox,
  TextArea,
  TextInput,
  inputClass,
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

// What usually comes of the team's work, offered when counting it.
const OUTCOMES = [
  'Fixed',
  'Working fine',
  'Webpage issue',
  "Can't be fixed",
  'Pending (doubt)',
  'Already existing',
  'Integrated',
  'Highlight to tech team',
];

// Where the work is done (a Google Sheet or a Contify admin page), as a link.
function WorkSource({ entry }) {
  if (!entry?.sourceName && !entry?.sourceUrl) return null;
  const name = entry.sourceName || 'Open the sheet';
  return (
    <p className="col-span-full -mb-1 flex items-center gap-1.5 text-[13px] text-muted">
      <span>Work in:</span>
      {entry.sourceUrl ? (
        <a
          href={entry.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-medium text-accent hover:underline"
        >
          {name}
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      ) : (
        <span className="font-medium text-ink">{name}</span>
      )}
    </p>
  );
}

function WorkLine({ entry, person, day, today, onDone, wide = false, assigners = {} }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const future = day.date > today;
  // Work the person added for themselves (no lead set its target): they may
  // set its target and remove it. Work a lead assigned is the lead's.
  const self = person.canFill && !person.canLead;
  const own = self && (!entry || !entry.targetBy || entry.targetBy === person.id);
  const mayTarget = person.canLead || own;
  const mayFill = person.canFill && !future;
  // Who set this target, said under it.
  const setBy = !entry?.targetBy
    ? entry && own && entry.target > 0
      ? 'Your own target'
      : null
    : entry.targetBy === person.id
      ? 'Set by you'
      : `Set by ${assigners[entry.targetBy] ?? 'your lead'}`;
  const saved = entry?.achieved ?? null;
  // The achieved box starts empty: what was saved shows under it, and a new
  // number replaces it.
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
      achieved: '',
      overtime: entry?.overtime ? String(entry.overtime) : '',
    },
  );
  const { errors } = form.formState;

  // What came of the work: lines of a label and a count.
  const startLines = () => (entry?.breakdown ?? []).map((line) => ({ label: line.label, count: String(line.count) }));
  const [lines, setLines] = useState(startLines);
  const [linesError, setLinesError] = useState('');
  const linesChanged = JSON.stringify(lines) !== JSON.stringify(startLines());

  const save = useMutation({
    mutationFn: (fields) =>
      api.put('/work/entries', {
        user: person.id,
        date: day.date,
        task: fields.task,
        ...(mayTarget && fields.target !== '' ? { target: toCount(fields.target) } : {}),
        ...(mayFill
          ? {
              ...(fields.achieved !== '' ? { achieved: toCount(fields.achieved) } : {}),
              overtime: toCount(fields.overtime) ?? 0,
              ...(linesChanged ? { breakdown: lines.map((line) => ({ label: line.label.trim(), count: Number(line.count) })) } : {}),
            }
          : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work'] });
      toast.success('Saved');
      form.setValue('achieved', '');
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

  const typed = form.watch('achieved');
  const target = form.watch('target');
  const achieved = typed !== '' ? Number(typed) : saved;
  const difference = achieved !== null && target !== '' ? achieved - Number(target) : null;

  const submit = form.handleSubmit((fields) => {
    const bad = lines.find((line) => !line.label.trim() || line.count === '' || Number.isNaN(Number(line.count)) || Number(line.count) < 0);
    if (bad) {
      setLinesError('Give every line a name and a count of 0 or more.');
      return;
    }
    setLinesError('');
    save.mutate(fields);
  });

  return (
    <form
      noValidate
      onSubmit={submit}
      className={`grid grid-cols-3 gap-3 border-b border-line py-3 last:border-b-0 ${wide ? 'sm:grid-cols-[1.4fr_1fr_1fr_0.8fr_auto] sm:items-start' : ''}`}
    >
      <WorkSource entry={entry} />
      <div className={wide ? 'col-span-3 sm:col-span-1' : 'col-span-3'}>
        <TextInput
          label="Work"
          list="work-tasks"
          disabled={!mayTarget && Boolean(entry)}
          error={errors.task?.message}
          {...form.register('task')}
        />
      </div>
      <TextInput
        label="Target"
        inputMode="decimal"
        disabled={!mayTarget}
        hint={setBy ?? undefined}
        error={errors.target?.message}
        {...form.register('target')}
      />
      <TextInput
        label="Achieved"
        inputMode="decimal"
        disabled={!mayFill}
        placeholder={saved !== null ? String(saved) : undefined}
        hint={future ? 'On the day' : saved !== null ? `Saved: ${saved}` : undefined}
        error={errors.achieved?.message}
        {...form.register('achieved')}
      />
      <TextInput label="OT" inputMode="decimal" disabled={!mayFill} error={errors.overtime?.message} {...form.register('overtime')} />
      <div className={`col-span-3 flex h-10 items-center justify-end gap-1.5 ${wide ? 'sm:col-span-1 sm:mt-[25px]' : ''}`}>
        <span
          className={`mr-auto min-w-12 rounded-md px-2 py-1 text-center text-sm font-semibold tabular-nums ${
            difference === null ? 'text-muted' : difference < 0 ? 'bg-rejected-soft text-rejected' : 'bg-approved-soft text-approved'
          } ${wide ? 'sm:mr-0' : ''}`}
          title="Achieved minus target"
        >
          {difference === null ? '—' : signed(difference)}
        </span>
        <div className="flex items-center gap-1">
          <Button type="submit" variant="secondary" loading={save.isPending}>
            Save
          </Button>
          {entry && (person.canLead || own) && (
            <IconButton label={`Remove ${entry.task}`} onClick={() => remove.mutate()}>
              <Trash2 className="h-4 w-4" />
            </IconButton>
          )}
        </div>
      </div>

      {/* What came of it: Fixed 46, Working fine 22... saved as the day's comment. */}
      {(mayFill || lines.length > 0) && (
        <div className="col-span-full rounded-lg border border-line bg-sunken/60 p-3">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[13px] font-semibold">What came of it</p>
            {mayFill && <p className="text-xs text-muted">Saved with Save, and added to your comments for the day.</p>}
          </div>
          {lines.length === 0 && (
            <p className="mb-2 text-sm text-muted">Count it here, like Fixed 46, Working fine 22, Webpage issue 49.</p>
          )}
          <ul className="space-y-2">
            {lines.map((line, index) => (
              // eslint-disable-next-line react/no-array-index-key
              <li key={index} className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <input
                    value={line.label}
                    disabled={!mayFill}
                    maxLength={40}
                    aria-label="What"
                    placeholder="Fixed"
                    onChange={(event) => setLines(lines.map((item, i) => (i === index ? { ...item, label: event.target.value } : item)))}
                    className={`${inputClass(linesError && !line.label.trim())} h-9!`}
                  />
                </div>
                <div className="w-24 shrink-0">
                  <input
                    value={line.count}
                    disabled={!mayFill}
                    inputMode="numeric"
                    aria-label={`How many ${line.label || ''}`.trim()}
                    placeholder="0"
                    onChange={(event) => setLines(lines.map((item, i) => (i === index ? { ...item, count: event.target.value } : item)))}
                    className={`${inputClass(linesError && (line.count === '' || Number.isNaN(Number(line.count))))} h-9! text-right tabular-nums`}
                  />
                </div>
                {mayFill && (
                  <IconButton label={`Remove ${line.label || 'this line'}`} onClick={() => setLines(lines.filter((_, i) => i !== index))}>
                    <X className="h-4 w-4" />
                  </IconButton>
                )}
              </li>
            ))}
          </ul>
          {linesError && <p className="mt-2 text-sm text-rejected">{linesError}</p>}
          {mayFill && (
            <button
              type="button"
              onClick={() =>
                setLines([...lines, { label: OUTCOMES.find((name) => !lines.some((line) => line.label === name)) ?? '', count: '' }])
              }
              className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add a line
            </button>
          )}
        </div>
      )}
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

// A line for a day's comments: one button to read them and another to add
// one, each in its own popup, so reading and writing stay apart.
function Comments({ person, day, comments = [], tasks = [], startAdding = false }) {
  const [view, setView] = useState(false);
  const [add, setAdd] = useState(startAdding);
  const latest = comments.at(-1);
  return (
    <section aria-label="Comments" className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
      <MessageSquare className="h-4 w-4 shrink-0 text-[#a8650b]" aria-hidden="true" />
      <p className="min-w-0 flex-1 truncate text-sm">
        {latest ? (
          <>
            <span className="font-medium">{latest.author.name}:</span>{' '}
            <span className="text-muted">{latest.text.replace(/\s+/g, ' ')}</span>
          </>
        ) : (
          <span className="text-muted">No comments yet.</span>
        )}
      </p>
      <div className="flex shrink-0 items-center gap-2">
        <Button variant="secondary" disabled={!comments.length} onClick={() => setView(true)}>
          View comments{comments.length ? ` (${comments.length})` : ''}
        </Button>
        {person.canFill && (
          <Button variant="secondary" onClick={() => setAdd(true)}>
            <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
            Add comment
          </Button>
        )}
      </div>
      <Dialog open={view} onClose={() => setView(false)} title={`Comments, ${dayTitle(day.date)}`} kind="modal">
        {view && <CommentList comments={comments} />}
      </Dialog>
      <Dialog open={add} onClose={() => setAdd(false)} title={`Add a comment, ${dayTitle(day.date)}`} kind="modal">
        {add && <CommentForm person={person} day={day} tasks={tasks} onDone={() => setAdd(false)} />}
      </Dialog>
    </section>
  );
}

// Reading: the day's comments, oldest first; whoever wrote one may remove it.
function CommentList({ comments }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState(null); // { id, text }
  const change = useMutation({
    mutationFn: ({ id, text }) => api.patch(`/work/comments/${id}`, { text }),
    onSuccess: () => {
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ['work'] });
      toast.success('Comment saved');
    },
    onError: (issue) => toast.error('Could not save it', issue.message),
  });
  const remove = useMutation({
    mutationFn: (id) => api.delete(`/work/comments/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['work'] }),
    onError: (issue) => toast.error('Could not remove it', issue.message),
  });
  if (!comments.length) return <p className="text-sm text-muted">No comments on this day.</p>;
  return (
    <ul className="space-y-2">
      {comments.map((comment) => (
        <li key={comment.id} className="rounded-lg border-l-[3px] border-[#f2a93b] bg-sunken px-3 py-2">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[13px]">
              <span className="font-semibold">{comment.author.name}</span>
              <span className="text-muted">
                {' '}
                · {postedAt(comment.createdAt)}
                {comment.editedAt ? ' · edited' : ''}
              </span>
            </p>
            {comment.mine && editing?.id !== comment.id && (
              <div className="-my-1 -mr-2 flex">
                <IconButton label="Edit this comment" onClick={() => setEditing({ id: comment.id, text: comment.text })}>
                  <Pencil className="h-3.5 w-3.5" />
                </IconButton>
                <IconButton label="Remove this comment" onClick={() => remove.mutate(comment.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </IconButton>
              </div>
            )}
          </div>
          {editing?.id === comment.id ? (
            <div className="mt-1.5">
              <textarea
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
                rows={5}
                value={editing.text}
                aria-label="Edit the comment"
                onChange={(event) => setEditing({ ...editing, text: event.target.value })}
                className={`${inputClass(!editing.text.trim())} h-auto! resize-y py-2`}
              />
              <div className="mt-2 flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
                <Button disabled={!editing.text.trim()} loading={change.isPending} onClick={() => change.mutate(editing)}>
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <p className="mt-0.5 whitespace-pre-wrap break-words text-[13px] leading-5">{comment.text}</p>
          )}
        </li>
      ))}
    </ul>
  );
}

// Writing: one new comment for the day.
function CommentForm({ person, day, tasks = [], onDone }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const form = useZodForm(z.object({ text: z.string().trim().min(1, 'Write the comment.').max(2000, 'Keep it under 2000 characters.') }), {
    text: '',
  });
  const { errors } = form.formState;
  const post = useMutation({
    mutationFn: ({ text }) => api.post('/work/comments', { user: person.id, date: day.date, text }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work'] });
      toast.success('Comment added');
      onDone?.();
    },
    onError: (issue) => showServerError(form, issue, ['text']),
  });
  // The usual format, filled in with the day and the work.
  const fillFormat = () => {
    const [year, month, date] = day.date.split('-');
    form.setValue('text', `Date ${date}.${month}.${year}\nTask ${tasks[0] ?? ''}\n`, { shouldFocus: true });
  };
  const submit = form.handleSubmit((fields) => post.mutate(fields));
  return (
    <form noValidate onSubmit={submit}>
      <TextArea
        label="Comment"
        rows={5}
        data-autofocus
        placeholder={EXAMPLE}
        error={errors.text?.message}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) submit(event);
        }}
        {...form.register('text')}
      />
      <div className="mt-3 flex items-center justify-between gap-2">
        <button type="button" className="text-sm text-accent hover:underline" onClick={fillFormat} title="Ctrl+Enter posts it">
          Use the usual format
        </button>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" loading={post.isPending}>
            Comment
          </Button>
        </div>
      </div>
      <FormError>{formError(form)}</FormError>
    </form>
  );
}

function DayDialog({ open, person, day, total, today, tasks, comments, focusComment, onClose, assigners }) {
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
              <WorkLine
                key={`${entry.id}-${entry.updatedAt}`}
                entry={entry}
                person={person}
                day={day}
                today={today}
                assigners={assigners}
              />
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
          <Comments person={person} day={day} comments={comments} startAdding={focusComment} tasks={entries.map((entry) => entry.task)} />
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
      sourceName: z.string().trim().max(80, 'Keep it under 80 characters.'),
      sourceUrl: z
        .string()
        .trim()
        .max(500, 'That link is too long.')
        .refine((value) => value === '' || /^https?:\/\/\S+$/i.test(value), 'Paste a link that starts with https://'),
    }),
    { task: sheet.tasks[0] ?? '', target: '', date: start, sourceName: '', sourceUrl: '' },
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
          <TextInput
            label="Where (sheet or page)"
            placeholder="Broken RSS sheet, or Contify admin"
            maxLength={80}
            error={errors.sourceName?.message}
            {...form.register('sourceName')}
          />
          <TextInput
            label="Link"
            type="url"
            placeholder="https://docs.google.com/..."
            error={errors.sourceUrl?.message}
            {...form.register('sourceUrl')}
          />
        </div>
        <p className="text-sm text-muted">
          Not on a Sunday or a holiday, or for anyone on leave that day. People working from home get this as their one piece of work. The
          link opens from their My work.
        </p>
        <FormError>{formError(form)}</FormError>
      </form>
    </Dialog>
  );
}

/* My work: today's work for the person signed in, to fill in quickly. */

function MyDay({ sheet, me, totals, tasks, notes }) {
  const assigners = sheet.assigners ?? {};
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
    <div className="grid items-start gap-4 lg:grid-cols-[2fr_1fr]">
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
            <WorkLine
              key={`${entry.id}-${entry.updatedAt}`}
              entry={entry}
              person={me}
              day={day}
              today={sheet.today}
              assigners={assigners}
              wide
            />
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
        <dl className="grid grid-cols-3 gap-2 px-4 py-4 text-center sm:px-5">
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

  // The page fills the screen: its top stays put and only the part below
  // scrolls (the sheet scrolls inside itself, like the Google Sheet).
  return (
    <div className="flex h-[calc(100dvh-233px)] min-h-[440px] flex-col lg:h-[calc(100dvh-129px)]">
      <div className="shrink-0">
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

        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
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
            {shownTab !== 'sheet' && (
              <div className="flex items-center gap-1">
                <IconButton label="Previous month" onClick={() => setMonth(shiftMonth(sheet.month, -1))}>
                  <ChevronLeft className="h-4 w-4" />
                </IconButton>
                <h2 className="min-w-36 text-center text-base font-semibold tabular-nums">{monthTitle(sheet.month)}</h2>
                <IconButton label="Next month" onClick={() => setMonth(shiftMonth(sheet.month, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </IconButton>
              </div>
            )}
          </div>
        </div>
      </div>

      {shownTab === 'sheet' ? (
        <div className="min-h-0 flex-1">
          {sheet.people.length === 0 ? (
            <Empty title="Nobody here yet">People in this department appear here.</Empty>
          ) : (
            <SheetGrid
              key={`${sheet.month}|${sheet.department}`}
              sheet={sheet}
              totals={totals}
              notes={notes}
              search={search}
              onOpenDay={(person, day) => setOpened({ person, day })}
              onMonth={setMonth}
            />
          )}
        </div>
      ) : (
        <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1 pb-2">
          {shownTab === 'mine' && me ? (
            <MyDay sheet={sheet} me={me} totals={totals} tasks={sheet.tasks} notes={notes} />
          ) : (
            <WorkDashboard key={`${sheet.month}|${sheet.department}`} sheet={sheet} me={me} notes={notes} search={search} />
          )}
        </div>
      )}

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
        assigners={sheet.assigners ?? {}}
        onClose={() => setOpened(null)}
      />
      {setting && <TargetsDialog open sheet={sheet} onClose={() => setSetting(false)} />}
    </div>
  );
}
