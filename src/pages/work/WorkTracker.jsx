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
import { ChartSwitch, OutcomeChart, WorkReport, outcomesOf, useChartStyle } from './WorkReport';
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
  Field,
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
  'Unique',
  'Not Unique',
  'Integration Fixed',
  'Highlight to tech team',
  'Working fine',
  'Webpage issue',
  "Can't be fixed",
  'Pending (doubt)',
  'Already existing',
  'Integrated',
];

// Where the work is done (a Google Sheet or a Contify admin page), as a link.
function WorkSource({ entry }) {
  if (!entry?.sourceName && !entry?.sourceUrl) return null;
  const name = entry.sourceName || 'Open the sheet';
  return entry.sourceUrl ? (
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
    <span>Work in {name}</span>
  );
}

// The kind of work and its piece, as one name: "Sourcing › Sourcing Error Report".
export const workName = (entry) =>
  entry.category && entry.category.toLowerCase() !== entry.task.toLowerCase() ? `${entry.category} › ${entry.task}` : entry.task;

// What came of the work: lines of a name and a count, saved on their own.
// Each save adds to what is there, then the box is empty again; what was
// saved shows above as plain text and goes into the day's comment.
function Counts({ entry, person, day }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [lines, setLines] = useState([]);
  const [error, setError] = useState('');
  const saved = (entry?.breakdown ?? []).filter((line) => line.count > 0);
  const save = useMutation({
    mutationFn: () =>
      api.put('/work/entries', {
        user: person.id,
        date: day.date,
        task: entry.task,
        addBreakdown: lines.map((line) => ({ label: line.label.trim(), count: Number(line.count) })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work'] });
      toast.success('Counts saved', 'Added to your comments for the day.');
      setLines([]);
    },
    onError: (issue) => setError(issue.message),
  });
  const submit = () => {
    if (!lines.length) return setError('Add a line first.');
    const bad = lines.find((line) => !line.label.trim() || line.count === '' || Number.isNaN(Number(line.count)) || Number(line.count) < 0);
    if (bad) return setError('Give every line a name and a count of 0 or more.');
    setError('');
    return save.mutate();
  };

  return (
    <div className="col-span-full rounded-lg border border-line bg-sunken/60 p-3">
      <p className="text-[13px] font-semibold">What came of it</p>
      <p className="mt-0.5 mb-2 text-sm text-muted">
        {saved.length
          ? `Saved: ${saved.map((line) => `${line.label} ${line.count}`).join(', ')}`
          : 'Nothing counted yet, like Fixed 46 or Working fine 22.'}
      </p>
      <ul className="space-y-2">
        {lines.map((line, index) => (
          // eslint-disable-next-line react/no-array-index-key
          <li key={index} className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <input
                value={line.label}
                maxLength={40}
                aria-label="What"
                placeholder="Fixed"
                onChange={(event) => setLines(lines.map((item, i) => (i === index ? { ...item, label: event.target.value } : item)))}
                className={`${inputClass(error && !line.label.trim())} h-9!`}
              />
            </div>
            <div className="w-24 shrink-0">
              <input
                value={line.count}
                inputMode="numeric"
                aria-label={`How many ${line.label || ''}`.trim()}
                placeholder="0"
                onChange={(event) => setLines(lines.map((item, i) => (i === index ? { ...item, count: event.target.value } : item)))}
                className={`${inputClass(error && (line.count === '' || Number.isNaN(Number(line.count))))} h-9! text-right tabular-nums`}
              />
            </div>
            <IconButton label={`Remove ${line.label || 'this line'}`} onClick={() => setLines(lines.filter((_, i) => i !== index))}>
              <X className="h-4 w-4" />
            </IconButton>
          </li>
        ))}
      </ul>
      {error && <p className="mt-2 text-sm text-rejected">{error}</p>}
      <div className="mt-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => {
            setError('');
            setLines([...lines, { label: OUTCOMES.find((name) => !lines.some((line) => line.label === name)) ?? '', count: '' }]);
          }}
          className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add a line
        </button>
        {lines.length > 0 && (
          <Button variant="secondary" loading={save.isPending} onClick={submit}>
            Save counts
          </Button>
        )}
      </div>
    </div>
  );
}

function WorkLine({ entry, person, day, today, onDone, wide = false, assigners = {}, types = [] }) {
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
  const adding = !entry;
  // The achieved box starts empty: what was saved shows under it, and a new
  // number replaces it.
  const form = useZodForm(
    z.object({
      category: adding ? z.string().min(1, 'Pick the work.') : z.string(),
      task: z.string().trim().max(60, 'Keep it under 60 characters.'),
      target: countRule('The target'),
      achieved: countRule('Achieved'),
      overtime: countRule('OT'),
    }),
    {
      category: entry?.category ?? '',
      task: entry?.task ?? '',
      target: entry ? String(entry.target ?? 0) : '',
      achieved: '',
      overtime: entry?.overtime ? String(entry.overtime) : '',
    },
  );
  const { errors } = form.formState;

  const save = useMutation({
    mutationFn: (fields) =>
      api.put('/work/entries', {
        user: person.id,
        date: day.date,
        ...(adding ? { category: fields.category } : {}),
        task: adding ? fields.task.trim() || fields.category : entry.task,
        ...(mayTarget && fields.target !== '' ? { target: toCount(fields.target) } : {}),
        ...(mayFill
          ? {
              ...(fields.achieved !== '' ? { achieved: toCount(fields.achieved) } : {}),
              overtime: toCount(fields.overtime) ?? 0,
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

  const piece = entry?.category && entry.category.toLowerCase() !== entry.task.toLowerCase();
  const chip = (
    <span
      className={`min-w-12 rounded-md px-2 py-1 text-center text-sm font-semibold tabular-nums ${
        difference === null ? 'bg-sunken text-muted' : difference < 0 ? 'bg-rejected-soft text-rejected' : 'bg-approved-soft text-approved'
      }`}
      title="Achieved minus target"
    >
      {difference === null ? '—' : signed(difference)}
    </span>
  );

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((fields) => save.mutate(fields))}
      className="mt-3 rounded-xl border border-line bg-surface p-3 sm:p-4"
    >
      {entry ? (
        <div className="mb-3 flex items-start gap-2">
          <div className="min-w-0 flex-1">
            {piece && <p className="text-[11px] font-medium tracking-wide text-muted uppercase">{entry.category}</p>}
            <p className="leading-snug font-semibold [overflow-wrap:anywhere]">{entry.task}</p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
              {setBy && <span>{setBy}</span>}
              {setBy && (entry.sourceUrl || entry.sourceName) && <span aria-hidden="true">·</span>}
              <WorkSource entry={entry} />
            </p>
          </div>
          {chip}
          {(person.canLead || own) && (
            <IconButton label={`Remove ${workName(entry)}`} onClick={() => remove.mutate()} className="-my-1">
              <Trash2 className="h-4 w-4" />
            </IconButton>
          )}
        </div>
      ) : (
        <div className="mb-3 grid gap-3 sm:grid-cols-2">
          <Field
            label="Work"
            hint={types.length ? undefined : 'No work types for this department yet. The assistant manager adds them under Work types.'}
            error={errors.category?.message}
          >
            {(id) => (
              <SelectBox
                id={id}
                className="w-full"
                error={errors.category?.message}
                value={form.watch('category')}
                onChange={(event) => form.setValue('category', event.target.value, { shouldValidate: true })}
              >
                <option value="">Pick the work</option>
                {types.map((type) => (
                  <option key={type.id} value={type.name}>
                    {type.name}
                  </option>
                ))}
              </SelectBox>
            )}
          </Field>
          <TextInput
            label="Piece of it (optional)"
            placeholder="Sourcing Error Report"
            error={errors.task?.message}
            {...form.register('task')}
          />
        </div>
      )}
      <div className={`grid grid-cols-3 gap-3 ${wide ? 'sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-start' : ''}`}>
        <TextInput label="Target" inputMode="decimal" disabled={!mayTarget} error={errors.target?.message} {...form.register('target')} />
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
        <div className={`col-span-3 flex items-center justify-end gap-2 ${wide ? 'sm:col-span-1 sm:mt-[25px]' : ''}`}>
          {!entry && chip}
          <Button type="submit" variant="secondary" loading={save.isPending}>
            Save
          </Button>
        </div>
      </div>
      {entry && mayFill && (
        <div className="mt-3">
          <Counts entry={entry} person={person} day={day} />
        </div>
      )}
      {formError(form) && (
        <div className="mt-3">
          <FormError>{formError(form)}</FormError>
        </div>
      )}
    </form>
  );
}

/* Comments on a day, like the comments people put on a cell in the Google
   Sheet with Ctrl+Alt+M: what they did ("Total no. of URLs inspected 120,
   fixed 46..."), and their lead's answer. */

const EXAMPLE =
  'Sourcing Error Report:- 53\n----------------------------\nFixed :- 46\n----------------------------\nHighlight to tech team :- 5\n----------------------------';

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
              {/* A leave comment is written by the app, at no particular time. */}
              {!comment.fromLeave && (
                <span className="text-muted">
                  {' '}
                  · {postedAt(comment.createdAt)}
                  {comment.editedAt ? ' · edited' : ''}
                </span>
              )}
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
  const form = useZodForm(z.object({ text: z.string().trim().min(1, 'Write the comment.').max(4000, 'Keep it under 4000 characters.') }), {
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

function DayDialog({ open, person, day, total, today, tasks, comments, focusComment, onClose, assigners, types = [] }) {
  const [adding, setAdding] = useState(false);
  const entries = total?.entries ?? [];
  const mayChange = person?.canLead || person?.canFill;
  // Working from home is one piece of work a day.
  const canAdd = mayChange;
  return (
    <Dialog open={open} onClose={onClose} title={person ? `${person.name}, ${dayTitle(day.date)}` : ''} kind="modal">
      {person && (
        <div>
          {person.away?.[day.date] && (
            <p className="mb-2 rounded-lg bg-pending-soft px-3 py-2 text-sm text-pending">
              On {person.away[day.date] === 'full' ? 'leave' : 'half-day leave'} this day.
            </p>
          )}
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
                types={types}
              />
            ))
          ) : (
            <ul className="divide-y divide-line text-sm">
              {entries.map((entry) => (
                <li key={entry.id} className="flex justify-between gap-3 py-2">
                  <span>{workName(entry)}</span>
                  <span className="tabular-nums text-muted">
                    {entry.achieved ?? '—'} of {entry.target}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {adding && <WorkLine person={person} day={day} today={today} onDone={() => setAdding(false)} types={types} />}
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

/* The work types (Broken RSS, New Integration, Sourcing...), for an
   assistant manager or manager to add to or take away from. */

function WorkTypesDialog({ open, types, department, onClose }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const add = useMutation({
    mutationFn: () => api.post('/work/types', { name: name.trim(), department }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work'] });
      toast.success('Work type added');
      setName('');
    },
    onError: (issue) => setError(issue.message),
  });
  const remove = useMutation({
    mutationFn: (id) => api.delete(`/work/types/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['work'] }),
    onError: (issue) => toast.error('Could not remove it', issue.message),
  });
  return (
    <Dialog open={open} onClose={onClose} title={`Work types, ${department}`} kind="modal">
      <p className="mb-3 text-sm text-muted">
        The kinds of work this department does. Team leads pick from these when they set targets. Work already given keeps its name.
      </p>
      <ul className="divide-y divide-line rounded-lg border border-line">
        {types.map((type) => (
          <li key={type.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
            <span>{type.name}</span>
            <IconButton label={`Remove ${type.name}`} onClick={() => remove.mutate(type.id)}>
              <Trash2 className="h-4 w-4" />
            </IconButton>
          </li>
        ))}
        {types.length === 0 && (
          <li className="px-3 py-3 text-sm text-muted">No work types yet. Add the kinds of work this department does.</li>
        )}
      </ul>
      <form
        noValidate
        className="mt-3 flex items-start gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim().length < 2) return setError('Name the work, like Snapshot.');
          setError('');
          return add.mutate();
        }}
      >
        <div className="min-w-0 flex-1">
          <input
            value={name}
            maxLength={60}
            aria-label="New work type"
            placeholder="New work type"
            onChange={(event) => setName(event.target.value)}
            className={inputClass(Boolean(error))}
          />
          {error && <p className="mt-1.5 text-sm text-rejected">{error}</p>}
        </div>
        <Button type="submit" loading={add.isPending}>
          Add
        </Button>
      </form>
    </Dialog>
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
      category: z.string().min(1, 'Pick the work.'),
      date: z.string().min(1, 'Pick the day.'),
    }),
    { category: '', date: start },
  );
  const { errors } = form.formState;
  const [pickError, setPickError] = useState('');
  // The pieces of the work, each with its target. A piece without a name is
  // the work itself.
  const [lines, setLines] = useState([{ task: '', target: '', url: '' }]);
  const badLink = (url) => url.trim() !== '' && (!/^https?:\/\/\S+$/i.test(url.trim()) || url.trim().length > 500);
  const [linesError, setLinesError] = useState('');
  const checkLines = () => {
    const bad = lines.find(
      (line) => line.target === '' || Number.isNaN(Number(line.target)) || Number(line.target) < 0 || Number(line.target) > 100000,
    );
    if (bad) {
      setLinesError('Give every piece a daily target from 0 to 100000.');
      return false;
    }
    if (lines.some((line) => badLink(line.url))) {
      setLinesError('Paste a link that starts with https://, or leave it empty.');
      return false;
    }
    const names = lines.map((line) => line.task.trim().toLowerCase());
    if (new Set(names).size !== names.length) {
      setLinesError('Name each piece of work once.');
      return false;
    }
    setLinesError('');
    return true;
  };

  const save = useMutation({
    mutationFn: ({ date, ...fields }) =>
      api.post('/work/targets', {
        ...fields,
        from: date,
        to: date,
        lines: lines.map((line) => ({
          task: line.task.trim(),
          target: Number(line.target),
          ...(line.url.trim() ? { sourceUrl: line.url.trim() } : {}),
        })),
        users: [...picked],
      }),
    onSuccess: ({ set }) => {
      queryClient.invalidateQueries({ queryKey: ['work'] });
      if (set === 0) toast.error('No target set', 'That day is a Sunday or a holiday, or they are on leave.');
      else toast.success('Targets set', `${set} ${set === 1 ? 'person' : 'people'}. Anyone on leave that day was left out.`);
      onClose();
    },
    onError: (issue) => showServerError(form, issue, ['category', 'date']),
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
            const linesOk = checkLines();
            if (picked.size === 0) {
              setPickError('Pick at least one person.');
              return;
            }
            if (linesOk) save.mutate(fields);
          },
          () => {
            checkLines();
            if (picked.size === 0) setPickError('Pick at least one person.');
          },
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
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Field
              label="Work"
              hint={
                (sheet.types ?? []).length
                  ? undefined
                  : 'No work types for this department yet. The assistant manager adds them under Work types.'
              }
              error={errors.category?.message}
            >
              {(id) => (
                <SelectBox
                  id={id}
                  className="w-full"
                  error={errors.category?.message}
                  value={form.watch('category')}
                  onChange={(event) => form.setValue('category', event.target.value, { shouldValidate: true })}
                >
                  <option value="">Pick the work</option>
                  {(sheet.types ?? []).map((type) => (
                    <option key={type.id} value={type.name}>
                      {type.name}
                    </option>
                  ))}
                </SelectBox>
              )}
            </Field>
          </div>
          <fieldset className="col-span-2">
            <legend className="mb-1.5 text-[13px] font-medium">Pieces of it, each with a daily target and where it is done</legend>
            <ul className="space-y-3">
              {lines.map((line, index) => (
                // eslint-disable-next-line react/no-array-index-key
                <li key={index} className="space-y-2 rounded-lg border border-line p-2">
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <input
                        value={line.task}
                        maxLength={60}
                        aria-label="Piece of the work"
                        placeholder="Work name"
                        onChange={(event) => setLines(lines.map((item, i) => (i === index ? { ...item, task: event.target.value } : item)))}
                        className={`${inputClass(false)} h-10!`}
                      />
                    </div>
                    <div className="w-28 shrink-0">
                      <input
                        value={line.target}
                        inputMode="decimal"
                        aria-label="Daily target"
                        placeholder="Target"
                        onChange={(event) =>
                          setLines(lines.map((item, i) => (i === index ? { ...item, target: event.target.value } : item)))
                        }
                        className={`${inputClass(linesError && (line.target === '' || Number.isNaN(Number(line.target))))} h-10! text-right tabular-nums`}
                      />
                    </div>
                    {lines.length > 1 && (
                      <IconButton label="Remove this piece" onClick={() => setLines(lines.filter((_, i) => i !== index))}>
                        <X className="h-4 w-4" />
                      </IconButton>
                    )}
                  </div>
                  <input
                    value={line.url}
                    type="url"
                    maxLength={500}
                    aria-label="Link of the sheet or page"
                    placeholder="Link of the sheet or page it is done on (optional)"
                    onChange={(event) => setLines(lines.map((item, i) => (i === index ? { ...item, url: event.target.value } : item)))}
                    className={`${inputClass(linesError && badLink(line.url))} h-10!`}
                  />
                </li>
              ))}
            </ul>
            {linesError && <p className="mt-1.5 text-sm text-rejected">{linesError}</p>}
            <button
              type="button"
              onClick={() => setLines([...lines, { task: '', target: '', url: '' }])}
              className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add a piece of work
            </button>
          </fieldset>
          <div className="col-span-2">
            <TextInput label="Day" type="date" error={errors.date?.message} {...form.register('date')} />
          </div>
        </div>
        <p className="text-sm text-muted">
          Not on a Sunday or a holiday, or for anyone on leave that day. The link opens from their My work.
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
  const canAdd = true;

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[2fr_1fr]">
      <Panel>
        <PanelTitle>Today, {dayTitle(day.date)}</PanelTitle>
        <div className="px-4 pb-3 sm:px-5">
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
              types={sheet.types ?? []}
              wide
            />
          ))}
          {adding && <WorkLine person={me} day={day} today={sheet.today} onDone={() => setAdding(false)} types={sheet.types ?? []} wide />}
          {canAdd && !adding && (
            <Button variant="ghost" className="mt-2" onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              {entries.length ? 'Add other work' : 'Add work'}
            </Button>
          )}
          <Comments person={me} day={day} comments={notes[`${me.id}|${day.date}`]} tasks={entries.map((entry) => entry.task)} />
        </div>
      </Panel>
      <div className="space-y-4">
        <Panel>
          <PanelTitle>{monthTitle(sheet.month)}</PanelTitle>
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
        <MyOutcomes entries={sheet.entries.filter((entry) => entry.date <= sheet.today)} me={me} when={monthTitle(sheet.month)} />
      </div>
    </div>
  );
}

// What came of my work this month (Fixed, Working fine...): in all, then by
// each piece of work, and a chart of it, as a circle or as bars.
function MyOutcomes({ entries: all, me, when }) {
  const [style, setStyle] = useChartStyle();
  const [whose, setWhose] = useState('mine');
  const entries = whose === 'mine' ? all.filter((entry) => entry.user === me.id) : all;
  const title = `${whose === 'mine' ? me.name : 'Everyone'}: what came of it`;
  // Counted out of what was done: my 135 achieved, not the sum of the counts.
  const done = entries.reduce((sum, entry) => sum + (entry.achieved ?? 0), 0);
  const items = outcomesOf(entries);
  const byWork = new Map();
  for (const entry of entries) {
    if (!(entry.breakdown ?? []).some((line) => line.count > 0)) continue;
    const name = workName(entry);
    byWork.set(name, [...(byWork.get(name) ?? []), entry]);
  }
  return (
    <Panel>
      <div className="flex min-h-12 items-center justify-between gap-2 border-b border-line px-4 py-2 sm:px-5">
        <h2 className="text-sm font-semibold">What came of it</h2>
        {items.length > 0 && <ChartSwitch value={style} onChange={setStyle} picture={{ title, subtitle: when, items, done }} compact />}
      </div>
      <div className="flex items-center justify-between gap-2 px-4 pt-3 sm:px-5">
        <div role="group" aria-label="Whose work" className="inline-flex rounded-lg border border-line bg-surface p-0.5">
          {[
            ['mine', 'Mine'],
            ['all', 'Everyone'],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={whose === key}
              onClick={() => setWhose(key)}
              className={`h-7 rounded-md px-3 text-xs font-medium ${whose === key ? 'bg-accent-soft text-accent' : 'text-muted hover:text-ink'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted tabular-nums">
          Done <span className="font-semibold text-ink">{done}</span>
        </p>
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-5 text-sm text-muted sm:px-5">
          {whose === 'mine' ? 'Nothing counted yet. Save counts under your work, like Fixed 46.' : 'Nobody has counted anything yet.'}
        </p>
      ) : (
        <div className="space-y-4 px-4 py-4 sm:px-5">
          <dl className="grid grid-cols-2 gap-2">
            {items.map((item) => (
              <div key={item.label} className="rounded-lg bg-sunken px-3 py-2">
                <dt className="truncate text-xs text-muted">{item.label}</dt>
                <dd className="mt-0.5 text-lg font-semibold tabular-nums">{item.count}</dd>
              </div>
            ))}
          </dl>
          {byWork.size > 0 && (
            <ul className="space-y-1.5 text-sm">
              {[...byWork].map(([name, list]) => (
                <li key={name}>
                  <p className="font-medium [overflow-wrap:anywhere]">{name}</p>
                  <p className="text-xs text-muted">
                    {outcomesOf(list)
                      .map((item) => `${item.label} ${item.count}`)
                      .join(' · ')}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-line pt-4">
            <OutcomeChart items={items} style={style} size={150} stacked done={done} />
          </div>
        </div>
      )}
    </Panel>
  );
}

export default function WorkTracker() {
  const { user } = useAuth();
  const [month, setMonth] = useState(null);
  const [department, setDepartment] = useState(null);
  // The work tracker opens on the dashboard.
  const [tab, setTab] = useState('dashboard');
  const [opened, setOpened] = useState(null);
  const [setting, setSetting] = useState(false);
  const [typesOpen, setTypesOpen] = useState(false);
  const [readingKey, setReading] = useState(null); // { title, user, date }
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
  const reading = readingKey ? { title: readingKey.title, list: notes[`${readingKey.user}|${readingKey.date}`] ?? [] } : null;

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
    <div className="flex flex-col lg:h-[calc(100dvh-129px)] lg:min-h-[440px]">
      <div className="shrink-0">
        <PageHeading
          title="Work tracker"
          actions={
            <>
              {sheet.canManageTypes && (
                <Button variant="secondary" onClick={() => setTypesOpen(true)}>
                  Work types
                </Button>
              )}
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
              { id: 'dashboard', label: 'Dashboard' },
              ...(me ? [{ id: 'mine', label: 'My work' }] : []),
              { id: 'sheet', label: 'Team sheet' },
              ...(sheet.canLead ? [{ id: 'report', label: 'Report' }] : []),
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
        <div className="h-[78dvh] min-h-[420px] lg:h-auto lg:min-h-0 lg:flex-1">
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
        <div className="-mx-1 px-1 pb-2 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
          {shownTab === 'report' ? (
            <WorkReport key={`${sheet.month}|${sheet.department}`} sheet={sheet} />
          ) : shownTab === 'mine' && me ? (
            <MyDay sheet={sheet} me={me} totals={totals} tasks={sheet.tasks} notes={notes} />
          ) : (
            <WorkDashboard
              key={`${sheet.month}|${sheet.department}`}
              sheet={sheet}
              me={me}
              notes={notes}
              search={search}
              onComments={(title, list) => setReading({ title, user: list[0]?.user, date: list[0]?.date })}
            />
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
        types={sheet.types ?? []}
        onClose={() => setOpened(null)}
      />
      {setting && <TargetsDialog open sheet={sheet} onClose={() => setSetting(false)} />}
      {typesOpen && <WorkTypesDialog open types={sheet.types ?? []} department={sheet.department} onClose={() => setTypesOpen(false)} />}
      <Dialog
        open={Boolean(reading)}
        onClose={() => setReading(null)}
        title={reading ? `Comments, ${reading.title}` : 'Comments'}
        kind="modal"
      >
        {reading && <CommentList comments={reading.list} />}
      </Dialog>
    </div>
  );
}
