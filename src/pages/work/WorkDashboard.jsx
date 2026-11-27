import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Trash2 } from 'lucide-react';
import { MandalaBackdrop, MandalaCorner } from '../../components/MandalaCorner';
import { useState } from 'react';
import { SegmentedTabs } from '../../components/Tabs';
import { ConfirmDialog, Empty, IconButton, Panel, PanelTitle, SelectBox } from '../../components/ui';
import { api } from '../../lib/api';
import { useToast } from '../../lib/toast';

// The work tracker's dashboard, for everyone: who was given what work and how
// much, and how much of it is done. A manager picks a piece of work to see who
// did it and how much; a team lead sees whether the people they gave work to
// finished it. Worked out from the same sheet data, so it is always in step.

const signed = (value) => (value > 0 ? `+${value}` : String(value));
const tone = (value) => (value > 0 ? 'text-approved' : value < 0 ? 'text-rejected' : 'text-muted');
const shortDay = (date) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

const STATUS = {
  done: ['Done', 'bg-approved-soft text-approved'],
  over: ['Done, more', 'bg-approved-soft text-approved'],
  short: ['Short', 'bg-rejected-soft text-rejected'],
  missing: ['Not filled', 'bg-pending-soft text-pending'],
  waiting: ['Pending', 'bg-cancelled-soft text-cancelled'],
  leave: ['On leave', 'bg-cancelled-soft text-cancelled'],
  ahead: ['On track', 'bg-approved-soft text-approved'],
  behind: ['Behind', 'bg-rejected-soft text-rejected'],
};

// What came of the work (Fixed, Working fine...), added up by label.
const tally = (into, breakdown = []) => {
  for (const line of breakdown) {
    const key = line.label.trim();
    into.set(key, (into.get(key) ?? 0) + (line.count ?? 0));
  }
  return into;
};

function Outcomes({ counts, className = '' }) {
  const list = [...counts].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  if (!list.length) return null;
  return <p className={`text-xs text-muted ${className}`}>{list.map(([label, n]) => `${label} ${n}`).join(' · ')}</p>;
}

// The kind of work an entry is (Sourcing...), and its full name.
const kindOf = (entry) => entry.category || entry.task;
const nameOf = (entry) =>
  entry.category && entry.category.toLowerCase() !== entry.task.toLowerCase() ? `${entry.category} › ${entry.task}` : entry.task;

// A comment count that opens the comments in a popup.
function CommentsButton({ said, title, onOpen }) {
  if (!said?.length) return null;
  return (
    <button
      type="button"
      onClick={() => onOpen?.(title, said)}
      aria-label={`${said.length} comment${said.length === 1 ? '' : 's'}`}
      className="ml-1.5 inline-flex items-center gap-0.5 rounded px-1 align-middle text-xs text-[#a8650b] hover:bg-sunken"
    >
      <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
      {said.length}
    </button>
  );
}

// Where the work is done: the sheets or pages its leads gave, as links.
function Places({ places }) {
  if (!places.size) return null;
  return (
    <p className="mt-1 flex flex-wrap gap-x-2 text-xs text-muted">
      {[...places.values()].map((place) =>
        place.url ? (
          <a
            key={place.key}
            href={place.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => event.stopPropagation()}
            className="text-accent hover:underline"
          >
            {place.name || 'Sheet'} ↗
          </a>
        ) : (
          <span key={place.key}>{place.name}</span>
        ),
      )}
    </p>
  );
}
const placeOf = (entry, places) => {
  if (!entry.sourceName && !entry.sourceUrl) return places;
  const key = `${entry.sourceName}|${entry.sourceUrl}`;
  if (!places.has(key)) places.set(key, { key, name: entry.sourceName, url: entry.sourceUrl });
  return places;
};

// A ring that fills as the work gets done.
function Ring({ share, size = 96 }) {
  const r = size / 2 - 8;
  const length = 2 * Math.PI * r;
  const done = Math.max(0, Math.min(1, share));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="shrink-0 -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="8" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={share >= 1 ? '#5fd3a0' : '#f2a93b'}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={`${length * done} ${length}`}
        className="transition-[stroke-dasharray] duration-700 ease-out"
      />
    </svg>
  );
}

// The dashboard's banner: navy, with the Odisha jhoti mandala in its corners,
// how much of the target is done as a ring, and the month's numbers.
function Hero({ eyebrow, title, target, achieved, due = target, facts = [] }) {
  const share = due > 0 ? achieved / due : achieved > 0 ? 1 : 0;
  const difference = achieved - due;
  return (
    <section className="relative isolate overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#1b2654_0%,#141c42_60%,#0f1534_100%)] p-5 text-white shadow-card sm:p-6">
      <MandalaCorner className="absolute -top-20 -right-16 -z-10 h-64 w-64 text-white opacity-[0.14]" />
      <MandalaCorner className="absolute -bottom-24 left-[42%] -z-10 h-56 w-56 text-[#f2a93b] opacity-[0.16]" />
      <MandalaCorner className="absolute -bottom-16 -left-14 -z-10 h-44 w-44 text-white opacity-[0.08]" />
      <div className="flex flex-wrap items-center gap-5">
        <div className="relative grid place-items-center">
          <Ring share={share} />
          <span className="absolute text-center">
            <span className="block text-xl font-semibold tabular-nums">{Math.round(share * 100)}%</span>
            <span className="block text-[10px] tracking-wide text-white/60 uppercase">done</span>
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium tracking-[0.14em] text-[#f5c26b] uppercase">{eyebrow}</p>
          <h2 className="mt-1 text-xl font-semibold sm:text-2xl">{title}</h2>
          <dl className="mt-3 grid grid-cols-3 gap-2 sm:max-w-md">
            {[
              ['Target', target],
              ['Achieved', achieved],
              ['Difference', signed(difference)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-white/[0.07] px-3 py-2 ring-1 ring-white/10 backdrop-blur-sm">
                <dt className="text-[11px] text-white/60">{label}</dt>
                <dd
                  className={`text-lg font-semibold tabular-nums ${
                    label === 'Difference' ? (difference > 0 ? 'text-[#5fd3a0]' : difference < 0 ? 'text-[#ff9b8f]' : '') : ''
                  }`}
                >
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        {facts.length > 0 && (
          <ul className="flex w-full flex-wrap gap-2 text-xs sm:w-auto sm:flex-col">
            {facts.map(([label, value, colour]) => (
              <li key={label} className="flex items-center gap-2 rounded-full bg-white/[0.07] px-3 py-1.5 ring-1 ring-white/10">
                <span className={`h-2 w-2 rounded-full ${colour}`} aria-hidden="true" />
                <span className="font-semibold tabular-nums">{value}</span>
                <span className="text-white/70">{label}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

// A panel with the mandala faintly behind its title.
function ArtPanel({ title, children }) {
  return (
    <section className="relative isolate overflow-hidden rounded-xl border border-line bg-surface shadow-card">
      <MandalaBackdrop className="-top-24 -right-20 h-48 w-48 text-[#a8650b]" />
      <h3 className="border-b border-line px-4 py-3 text-sm font-semibold sm:px-5">{title}</h3>
      {children}
    </section>
  );
}

function Status({ kind }) {
  const [label, colour] = STATUS[kind];
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${colour}`}>{label}</span>;
}

function Bar({ done, of }) {
  const share = of > 0 ? Math.min(1, done / of) : done > 0 ? 1 : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-sunken" aria-hidden="true">
      <div className={`h-full rounded-full ${done >= of ? 'bg-approved' : 'bg-accent'}`} style={{ width: `${share * 100}%` }} />
    </div>
  );
}

// Everyone under someone in the department tree: the people who report to
// them, the people who report to those, and so on.
function below(people, id) {
  const found = [];
  const seen = new Set([id]);
  for (let layer = [id]; layer.length;) {
    const next = people.filter((person) => layer.includes(person.reportsTo) && !seen.has(person.id));
    for (const person of next) seen.add(person.id);
    found.push(...next);
    layer = next.map((person) => person.id);
  }
  return found;
}

// The days a month view counts: up to today in this month, every working day
// in a month gone by, none in a month to come. Public holidays are off.
const countedDays = (sheet) => sheet.days.filter((day) => !day.off && day.date <= sheet.today).map((day) => day.date);

function TeamDashboard({ sheet, me, notes, search = '', onComments }) {
  const workingDays = sheet.days.filter((day) => !day.off);
  const inMonth = sheet.today >= sheet.days[0].date && sheet.today <= sheet.days.at(-1).date;
  const firstDay = inMonth ? sheet.today : (countedDays(sheet).at(-1) ?? workingDays[0]?.date);
  const myTeam = me ? below(sheet.people, me.id) : [];

  const [period, setPeriod] = useState('day');
  const [date, setDate] = useState(firstDay);
  const [work, setWork] = useState('all');
  const [whose, setWhose] = useState(myTeam.length ? 'mine' : 'all');
  // Removing set work: one person's piece of work, or a whole piece of work,
  // for the day picked or the whole month.
  const queryClient = useQueryClient();
  const toast = useToast();
  const [removing, setRemoving] = useState(null); // { title, ids }
  const remove = useMutation({
    mutationFn: (ids) => api.post('/work/entries/remove', { ids }),
    onSuccess: ({ removed }) => {
      queryClient.invalidateQueries({ queryKey: ['work'] });
      toast.success('Work removed', `${removed} ${removed === 1 ? 'day' : 'days'} of work taken off.`);
      setRemoving(null);
    },
    onError: (issue) => {
      toast.error('Could not remove it', issue.message);
      setRemoving(null);
    },
  });
  const leadable = (userId) => sheet.people.find((person) => person.id === userId)?.canLead;
  const entriesOf = (match) =>
    sheet.entries.filter((entry) => match(entry) && leadable(entry.user) && (period === 'day' ? entry.date === date : true));
  const when = period === 'day' ? shortDay(date) : 'the whole month';

  const words = search.trim().toLowerCase();
  const people = (whose === 'mine' ? myTeam : sheet.people).filter((person) => !words || person.label.toLowerCase().includes(words));
  const ids = new Set(people.map((person) => person.id));
  const order = new Map(sheet.people.map((person, index) => [person.id, index]));
  const byId = new Map(sheet.people.map((person) => [person.id, person]));

  const rows = (() => {
    const days = period === 'day' ? new Set([date]) : new Set(countedDays(sheet));
    const groups = new Map();
    for (const entry of sheet.entries) {
      if (!ids.has(entry.user) || !days.has(entry.date)) continue;
      if (work !== 'all' && kindOf(entry) !== work) continue;
      const key = `${entry.user}|${entry.task}`;
      const row = groups.get(key) ?? {
        user: entry.user,
        task: entry.task,
        kind: kindOf(entry),
        name: nameOf(entry),
        target: 0,
        achieved: 0,
        filled: 0,
        unfilled: 0,
        days: 0,
        by: new Set(),
        outcomes: new Map(),
        places: new Map(),
      };
      row.target += entry.target ?? 0;
      tally(row.outcomes, entry.breakdown);
      placeOf(entry, row.places);
      if (entry.targetBy) row.by.add(sheet.assigners?.[entry.targetBy] ?? 'Someone');
      row.days += 1;
      if (entry.achieved === null || entry.achieved === undefined) row.unfilled += entry.date < sheet.today ? 1 : 0;
      else {
        row.achieved += entry.achieved;
        row.filled += 1;
      }
      groups.set(key, row);
    }
    return [...groups.values()]
      .map((row) => {
        let status;
        if (period === 'day') {
          if (byId.get(row.user)?.away?.[date] === 'full') status = 'leave';
          else if (row.filled === 0) status = date < sheet.today ? 'missing' : 'waiting';
          else status = row.achieved > row.target ? 'over' : row.achieved === row.target ? 'done' : 'short';
        } else status = row.achieved >= row.target ? 'ahead' : 'behind';
        return { ...row, person: byId.get(row.user), status };
      })
      .sort((a, b) => order.get(a.user) - order.get(b.user) || a.task.localeCompare(b.task));
  })();

  const total = rows.reduce((sum, row) => ({ target: sum.target + row.target, achieved: sum.achieved + row.achieved }), {
    target: 0,
    achieved: 0,
  });
  // Counted by people, not by pieces of work: someone is done when all their
  // work is done, and not filled in when any of it is not.
  const workOf = new Map();
  for (const row of rows) workOf.set(row.user, [...(workOf.get(row.user) ?? []), row]);
  const finished = [...workOf.values()].filter((list) => list.every((row) => ['done', 'over', 'ahead'].includes(row.status))).length;
  const missing = [...workOf.values()].filter((list) => list.some((row) => row.status === 'missing' || row.unfilled > 0)).length;

  // Each piece of work: how many people, and how much of it is done.
  const byWork = [
    ...rows
      .reduce((map, row) => {
        const item = map.get(row.kind) ?? {
          task: row.kind,
          pieces: new Map(),
          people: new Set(),
          target: 0,
          achieved: 0,
          outcomes: new Map(),
          places: new Map(),
        };
        item.people.add(row.user);
        for (const [label, n] of row.outcomes) item.outcomes.set(label, (item.outcomes.get(label) ?? 0) + n);
        for (const [key, place] of row.places) item.places.set(key, place);
        item.target += row.target;
        item.achieved += row.achieved;
        if (row.task !== row.kind) {
          const piece = item.pieces.get(row.task) ?? { target: 0, achieved: 0 };
          piece.target += row.target;
          piece.achieved += row.achieved;
          item.pieces.set(row.task, piece);
        }
        return map.set(row.kind, item);
      }, new Map())
      .values(),
  ].sort((a, b) => b.target - a.target);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedTabs
          label="Period"
          tabs={[
            ['day', 'One day'],
            ['month', 'This month'],
          ]}
          value={period}
          onChange={setPeriod}
        />
        {period === 'day' && (
          <SelectBox aria-label="Day" value={date} onChange={(event) => setDate(event.target.value)}>
            {workingDays.map((day) => (
              <option key={day.date} value={day.date}>
                {shortDay(day.date)}
                {day.date === sheet.today ? ' (today)' : ''}
              </option>
            ))}
          </SelectBox>
        )}
        <SelectBox aria-label="Work" value={work} onChange={(event) => setWork(event.target.value)}>
          <option value="all">All work</option>
          {[...new Set([...(sheet.types ?? []).map((type) => type.name), ...sheet.entries.map(kindOf)])].map((kind) => (
            <option key={kind} value={kind}>
              {kind}
            </option>
          ))}
        </SelectBox>
        {myTeam.length > 0 && (
          <SegmentedTabs
            label="Whose work"
            tabs={[
              ['mine', `My team (${myTeam.length})`],
              ['all', 'Everyone'],
            ]}
            value={whose}
            onChange={setWhose}
          />
        )}
      </div>

      <Hero
        eyebrow={period === 'day' ? shortDay(date) : 'This month'}
        title={whose === 'mine' ? 'My team at work' : 'Team at work'}
        target={total.target}
        achieved={total.achieved}
        facts={[
          ['people with work', new Set(rows.map((row) => row.user)).size, 'bg-white'],
          ['done', finished, 'bg-[#5fd3a0]'],
          ...(missing ? [['not filled in', missing, 'bg-[#f2a93b]']] : []),
        ]}
      />

      {rows.length === 0 ? (
        <Empty title="No work given for this">
          {words
            ? 'Nobody by that name has work here.'
            : period === 'day'
              ? 'Nobody has a target on this day for this work.'
              : 'Nobody has a target for this work this month yet.'}
        </Empty>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[1fr_2fr]">
          <ArtPanel title="By work">
            <ul className="divide-y divide-line lg:max-h-[min(62vh,560px)] lg:overflow-y-auto">
              {byWork.map((item) => (
                <li key={item.task} className="relative">
                  {sheet.canLead &&
                    entriesOf((entry) => kindOf(entry) === item.task && people.some((person) => person.id === entry.user)).length > 0 && (
                      <IconButton
                        label={`Remove ${item.task}`}
                        className="absolute top-2 right-2 z-10 sm:right-3"
                        onClick={() =>
                          setRemoving({
                            title: `Remove ${item.task} for ${when}?`,
                            body: `It is taken off everyone you can set work for${whose === 'mine' ? ' in your team' : ''}, with what they filled in for it. This cannot be undone.`,
                            ids: entriesOf((entry) => kindOf(entry) === item.task && people.some((person) => person.id === entry.user)).map(
                              (entry) => entry.id,
                            ),
                          })
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </IconButton>
                    )}
                  <button
                    type="button"
                    onClick={() => setWork(work === item.task ? 'all' : item.task)}
                    className={`w-full px-4 py-3 pr-12 text-left hover:bg-sunken sm:px-5 sm:pr-14 ${work === item.task ? 'bg-accent-soft' : ''}`}
                  >
                    <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                      <span className="font-medium">{item.task}</span>
                      <span className="tabular-nums text-muted">
                        {item.achieved} / {item.target}
                      </span>
                    </div>
                    <Bar done={item.achieved} of={item.target} />
                    <p className="mt-1 text-xs text-muted">
                      {item.people.size} {item.people.size === 1 ? 'person' : 'people'}
                    </p>
                    {item.pieces.size > 0 && (
                      <ul className="mt-1.5 space-y-0.5 text-xs text-muted">
                        {[...item.pieces].map(([piece, n]) => (
                          <li key={piece} className="flex justify-between gap-3">
                            <span className="truncate">{piece}</span>
                            <span className="tabular-nums">
                              {n.achieved} / {n.target}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <Outcomes counts={item.outcomes} className="mt-1.5" />
                    <Places places={item.places} />
                  </button>
                </li>
              ))}
            </ul>
          </ArtPanel>

          <Panel>
            <PanelTitle>Who did what{period === 'day' ? `, ${shortDay(date)}` : ', this month'}</PanelTitle>
            <div className="overflow-x-auto lg:max-h-[min(62vh,560px)] lg:overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-surface">
                  <tr className="border-b border-line text-left text-xs text-muted">
                    <th className="px-4 py-2 font-medium sm:px-5">Person</th>
                    <th className="px-2 py-2 font-medium">Work</th>
                    <th className="px-2 py-2 text-right font-medium">Target</th>
                    <th className="px-2 py-2 text-right font-medium">Done</th>
                    <th className="px-2 py-2 text-right font-medium whitespace-nowrap">+/−</th>
                    <th className="px-2 py-2 font-medium">Status</th>
                    {sheet.canLead && (
                      <th className="w-10 px-2 py-2">
                        <span className="sr-only">Remove</span>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => {
                    const said = period === 'day' ? notes[`${row.user}|${date}`] : null;
                    const mine = entriesOf((entry) => entry.user === row.user && entry.task === row.task);
                    const first = index === 0 || rows[index - 1].user !== row.user;
                    const last = index === rows.length - 1 || rows[index + 1].user !== row.user;
                    const span = first ? rows.filter((other) => other.user === row.user).length : 0;
                    const piece = row.task.toLowerCase() !== row.kind.toLowerCase();
                    return (
                      <tr key={`${row.user}|${row.task}`} className={`align-top ${last ? 'border-b border-line last:border-b-0' : ''}`}>
                        {first && (
                          <td rowSpan={span} className="border-r border-line px-4 py-3 sm:px-5">
                            <p className="font-medium whitespace-nowrap">{row.person?.name}</p>
                            {(row.person?.workFromHome || said?.length > 0) && (
                              <p className="mt-0.5 flex items-center text-xs text-muted">
                                {row.person?.workFromHome && <span>WFH</span>}
                                <CommentsButton said={said} title={`${row.person?.name}, ${shortDay(date)}`} onOpen={onComments} />
                              </p>
                            )}
                          </td>
                        )}
                        <td className={`min-w-44 px-3 ${first ? 'pt-3' : 'pt-1.5'} ${last ? 'pb-3' : 'pb-1.5'}`}>
                          {piece && <p className="text-[11px] tracking-wide text-muted uppercase">{row.kind}</p>}
                          <p className="leading-snug [overflow-wrap:anywhere]">{row.task}</p>
                          {row.by.size > 0 && <p className="mt-0.5 text-xs text-muted">Set by {[...row.by].join(', ')}</p>}
                        </td>
                        <td className={`px-2 text-right tabular-nums ${first ? 'pt-3' : 'pt-1.5'}`}>{row.target}</td>
                        <td className={`px-2 text-right tabular-nums ${first ? 'pt-3' : 'pt-1.5'}`}>{row.filled ? row.achieved : '—'}</td>
                        <td
                          className={`px-2 text-right tabular-nums ${first ? 'pt-3' : 'pt-1.5'} ${row.filled ? tone(row.achieved - row.target) : 'text-muted'}`}
                        >
                          {row.filled ? signed(row.achieved - row.target) : ''}
                        </td>
                        <td className={`px-2 whitespace-nowrap ${first ? 'pt-2.5' : 'pt-1'}`}>
                          <Status kind={row.status} />
                          {period === 'month' && row.unfilled > 0 && (
                            <span className="ml-1.5 text-xs text-pending">
                              {row.unfilled} {row.unfilled === 1 ? 'day' : 'days'} not filled
                            </span>
                          )}
                        </td>
                        {sheet.canLead && (
                          <td className={`px-2 ${first ? 'pt-1.5' : 'pt-0'}`}>
                            {mine.length > 0 && (
                              <IconButton
                                label={`Remove ${row.name} for ${row.person?.name}`}
                                onClick={() =>
                                  setRemoving({
                                    title: `Remove ${row.name} for ${row.person?.name}?`,
                                    body: `For ${when}: ${mine.length} ${mine.length === 1 ? 'day' : 'days'} of work, with what was filled in for it. This cannot be undone.`,
                                    ids: mine.map((entry) => entry.id),
                                  })
                                }
                              >
                                <Trash2 className="h-4 w-4" />
                              </IconButton>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}
      <RemoveConfirm
        removing={removing}
        onClose={() => setRemoving(null)}
        loading={remove.isPending}
        onConfirm={() => remove.mutate(removing.ids)}
      />
    </div>
  );
}

/* An employee's own dashboard: only their work. What they were given, by
   whom and how much, and how much of it they have done. */

const dayLabel = (date) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

function RemoveConfirm({ removing, onClose, loading, onConfirm }) {
  return (
    <ConfirmDialog
      open={Boolean(removing)}
      onClose={onClose}
      title={removing?.title ?? ''}
      body={removing?.body ?? ''}
      confirmLabel="Remove work"
      danger
      loading={loading}
      onConfirm={onConfirm}
    />
  );
}

function MyDashboard({ sheet, me, notes, onComments }) {
  const workingDays = sheet.days.filter((day) => !day.off);
  const inMonth = sheet.today >= sheet.days[0].date && sheet.today <= sheet.days.at(-1).date;
  const [period, setPeriod] = useState('month');
  const [date, setDate] = useState(inMonth ? sheet.today : (workingDays.at(-1)?.date ?? sheet.days[0].date));

  const mine = sheet.entries
    .filter((entry) => entry.user === me.id && (period === 'month' || entry.date === date))
    .sort((a, b) => a.date.localeCompare(b.date) || a.task.localeCompare(b.task));
  const by = (entry) => (entry.targetBy ? (entry.targetBy === me.id ? 'You' : (sheet.assigners?.[entry.targetBy] ?? 'Your lead')) : '—');
  // What counts so far: days gone by, and today once filled in.
  const counts = (entry) =>
    entry.date < sheet.today || (entry.date === sheet.today && entry.achieved !== null && entry.achieved !== undefined);
  const statusOf = (entry) => {
    if (me.away?.[entry.date] === 'full') return 'leave';
    if (entry.achieved === null || entry.achieved === undefined) return entry.date < sheet.today ? 'missing' : 'waiting';
    return entry.achieved > entry.target ? 'over' : entry.achieved === entry.target ? 'done' : 'short';
  };

  const given = mine.reduce((sum, entry) => sum + (entry.target ?? 0), 0);
  const soFar = mine.filter(counts);
  const dueSoFar = soFar.reduce((sum, entry) => sum + (entry.target ?? 0), 0);
  const achieved = mine.reduce((sum, entry) => sum + (entry.achieved ?? 0), 0);
  const unfilled = mine.filter((entry) => statusOf(entry) === 'missing').length;

  // Each piece of work: the total given, by whom, and how much is done.
  const byWork = [
    ...mine
      .reduce((map, entry) => {
        const item = map.get(entry.task) ?? {
          task: entry.task,
          target: 0,
          due: 0,
          achieved: 0,
          days: 0,
          from: new Map(),
          outcomes: new Map(),
          places: new Map(),
        };
        tally(item.outcomes, entry.breakdown);
        placeOf(entry, item.places);
        item.target += entry.target ?? 0;
        if (counts(entry)) item.due += entry.target ?? 0;
        item.achieved += entry.achieved ?? 0;
        item.days += 1;
        const name = by(entry);
        item.from.set(name, (item.from.get(name) ?? 0) + (entry.target ?? 0));
        return map.set(entry.task, item);
      }, new Map())
      .values(),
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedTabs
          label="Period"
          tabs={[
            ['month', 'Whole month'],
            ['day', 'One day'],
          ]}
          value={period}
          onChange={setPeriod}
        />
        {period === 'day' && (
          <SelectBox aria-label="Day" value={date} onChange={(event) => setDate(event.target.value)}>
            {workingDays.map((day) => (
              <option key={day.date} value={day.date}>
                {dayLabel(day.date)}
                {day.date === sheet.today ? ' (today)' : ''}
              </option>
            ))}
          </SelectBox>
        )}
      </div>

      <Hero
        eyebrow={period === 'day' ? dayLabel(date) : 'This month'}
        title={`Hello, ${me.name.split(' ')[0]}`}
        target={dueSoFar}
        achieved={achieved}
        facts={[
          [`target for the ${period === 'month' ? 'month' : 'day'}`, given, 'bg-white'],
          [
            period === 'month' ? 'days with work' : 'pieces of work',
            period === 'month' ? new Set(mine.map((entry) => entry.date)).size : mine.length,
            'bg-[#5fd3a0]',
          ],
          ...(unfilled ? [['not filled in', unfilled, 'bg-[#f2a93b]']] : []),
        ]}
      />
      {unfilled > 0 && (
        <p className="text-sm text-pending">
          {unfilled} {unfilled === 1 ? 'day is' : 'days are'} not filled in yet. Fill them in from My work or the team sheet.
        </p>
      )}

      {mine.length === 0 ? (
        <Empty title="No work assigned">
          {period === 'day' ? 'Nobody has given you a target for this day yet.' : 'Nobody has given you a target this month yet.'}
        </Empty>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[1fr_2fr]">
          <ArtPanel title="My work">
            <ul className="divide-y divide-line lg:max-h-[min(62vh,560px)] lg:overflow-y-auto">
              {byWork.map((item) => (
                <li key={item.task} className="px-4 py-3 sm:px-5">
                  <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium">{item.task}</span>
                    <span className="tabular-nums text-muted">
                      {item.achieved} / {item.target}
                    </span>
                  </div>
                  <Bar done={item.achieved} of={item.due || item.target} />
                  <p className="mt-1.5 text-xs text-muted">
                    {[...item.from]
                      .filter(([name]) => name !== '—')
                      .map(([name, amount]) => `${amount} from ${name}`)
                      .join(' · ') || `${item.target} target`}
                    {' · '}
                    {item.days} {item.days === 1 ? 'day' : 'days'}
                  </p>
                  <Outcomes counts={item.outcomes} className="mt-2" />
                  <Places places={item.places} />
                </li>
              ))}
            </ul>
          </ArtPanel>

          <Panel>
            <PanelTitle>Assigned to me{period === 'day' ? `, ${dayLabel(date)}` : ''}</PanelTitle>
            <div className="overflow-x-auto lg:max-h-[min(62vh,560px)] lg:overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-surface">
                  <tr className="border-b border-line text-left text-xs text-muted">
                    <th className="px-4 py-2 font-medium sm:px-5">Day</th>
                    <th className="px-2 py-2 font-medium">Work</th>
                    <th className="px-2 py-2 font-medium">Assigned by</th>
                    <th className="px-2 py-2 text-right font-medium">Target</th>
                    <th className="px-2 py-2 text-right font-medium">Done</th>
                    <th className="px-2 py-2 text-right font-medium whitespace-nowrap">+/−</th>
                    <th className="px-4 py-2 font-medium sm:px-5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {mine.map((entry) => {
                    const filled = entry.achieved !== null && entry.achieved !== undefined;
                    const said = notes[`${me.id}|${entry.date}`];
                    return (
                      <tr
                        key={entry.id}
                        className={`border-b border-line last:border-b-0 ${entry.date === sheet.today ? 'bg-accent-soft/50' : ''}`}
                      >
                        <td className="px-4 py-2.5 whitespace-nowrap sm:px-5">
                          {dayLabel(entry.date)}
                          <CommentsButton said={said} title={dayLabel(entry.date)} onOpen={onComments} />
                        </td>
                        <td className="px-2 py-2.5">{nameOf(entry)}</td>
                        <td className="px-2 py-2.5 text-muted">{by(entry)}</td>
                        <td className="px-2 py-2.5 text-right tabular-nums">{entry.target}</td>
                        <td className="px-2 py-2.5 text-right tabular-nums">{filled ? entry.achieved : '—'}</td>
                        <td
                          className={`px-2 py-2.5 text-right tabular-nums ${filled ? tone(entry.achieved - entry.target) : 'text-muted'}`}
                        >
                          {filled ? signed(entry.achieved - entry.target) : ''}
                        </td>
                        <td className="px-4 py-2.5 sm:px-5">
                          <Status kind={statusOf(entry)} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}

// Someone with nobody under them sees only their own work; a team lead, an
// assistant manager or a manager sees the team's.
export function WorkDashboard({ sheet, me, notes, search, onComments }) {
  const leads = me && (me.position !== 'employee' || sheet.people.some((person) => person.reportsTo === me.id));
  if (me && !leads) return <MyDashboard sheet={sheet} me={me} notes={notes} onComments={onComments} />;
  return <TeamDashboard sheet={sheet} me={me} notes={notes} search={search} onComments={onComments} />;
}
