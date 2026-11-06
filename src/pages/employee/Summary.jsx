import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Download,
  Info,
  List,
  MoreHorizontal,
  Palmtree,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ApplyLeaveDialog } from '../../components/ApplyLeave';
import { CalendarGrid } from '../../components/CalendarGrid';
import { Stamp } from '../../components/Stamp';
import { BigNumber, Button, Empty, IconButton, LoadError, Panel, Reveal, RowsSkeleton, SelectBox } from '../../components/ui';
import { api } from '../../lib/api';
import { dayRange, dayWord, longDate, slashDate, weekday } from '../../lib/dates';

function BookedInfo({ balance }) {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label={`${balance.approved} approved, ${balance.pending} awaiting decision`}
        className="grid h-5 w-5 place-items-center text-muted hover:text-ink"
      >
        <Info className="h-3.5 w-3.5" strokeWidth={1.5} />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full right-0 z-10 mb-1 hidden whitespace-nowrap rounded bg-ink px-2.5 py-1.5 text-xs text-bg group-hover:block group-focus-within:block"
      >
        {balance.approved} approved, {balance.pending} awaiting decision
      </span>
    </span>
  );
}

function BalanceCell({ balance }) {
  const { leaveType, available, entitled, booked, approved } = balance;
  const tracks = leaveType.tracksBalance;
  const used = tracks && entitled > 0 ? Math.min(100, ((entitled - available) / entitled) * 100) : 0;

  return (
    <div className="bg-surface p-4 sm:p-5">
      <h3 className="min-h-10 text-base" title={leaveType.name}>
        {leaveType.name}
      </h3>
      <p className="mt-3 flex items-baseline gap-2">
        <BigNumber value={tracks ? available : approved} size={2.5} />
        <span className="text-sm text-muted">{tracks ? 'available' : `${dayWord(approved)} taken`}</span>
      </p>
      <div className="mt-3 h-1 overflow-hidden rounded-sm bg-sunken" aria-hidden="true">
        {tracks && <div className="h-full origin-left bg-accent" style={{ transform: `scaleX(${used / 100})` }} />}
      </div>
      <p className="mt-3 flex items-center justify-between text-sm text-muted">
        <span className="tabular-nums">
          {booked} booked{tracks ? ` of ${entitled}` : ''}
        </span>
        <BookedInfo balance={balance} />
      </p>
    </div>
  );
}

const UPCOMING_FILTERS = [
  ['all', 'Upcoming Leaves & Holidays'],
  ['leave', 'Upcoming Leaves'],
  ['holiday', 'Upcoming Holidays'],
];

const PAST_FILTERS = [
  ['all', 'Past Leaves & Holidays'],
  ['leave', 'Past Leaves'],
  ['holiday', 'Past Holidays'],
];

function EntryRow({ entry, onAvail }) {
  const isLeave = entry.kind === 'leave';
  return (
    <li className="grid gap-x-4 gap-y-1 border-b border-line px-4 py-3 last:border-b-0 sm:grid-cols-[minmax(170px,220px)_minmax(180px,300px)_1fr_auto] sm:items-center sm:px-5">
      <p className="text-sm tabular-nums text-ink">
        {isLeave && entry.from !== entry.to ? (
          dayRange(entry.from, entry.to)
        ) : (
          <>
            {slashDate(entry.from)}, {weekday(entry.from)}
          </>
        )}
      </p>
      <p className="flex items-center gap-2 text-sm font-medium">
        {isLeave ? (
          <Palmtree className="h-4 w-4 shrink-0 text-accent" strokeWidth={1.5} aria-hidden="true" />
        ) : (
          <CalendarDays className="h-4 w-4 shrink-0 text-muted" strokeWidth={1.5} aria-hidden="true" />
        )}
        <span className="min-w-0">
          {entry.title}
          {entry.restricted && <span className="font-normal text-muted"> (Restricted holiday)</span>}
        </span>
      </p>
      <p className="text-sm text-muted">
        {isLeave ? `${entry.days} ${dayWord(entry.days)}. ${entry.reason}` : entry.note}
      </p>
      <div className="min-h-9 justify-self-start sm:justify-self-end">
        {isLeave && <Stamp status={entry.status} />}
        {!isLeave && entry.availed && <span className="text-sm font-medium text-accent">Availed</span>}
        {!isLeave && entry.canAvail && (
          <Button variant="secondary" onClick={() => onAvail(entry)}>
            Avail
          </Button>
        )}
      </div>
    </li>
  );
}

function EntryPanel({ filters, entries, loading, scroll, onAvail, label }) {
  const [filter, setFilter] = useState('all');
  const shown = useMemo(
    () => (filter === 'all' ? entries : entries.filter((entry) => entry.kind === filter)),
    [entries, filter],
  );

  return (
    <Panel>
      <div className="border-b border-line p-3 sm:px-5">
        <SelectBox
          aria-label={label}
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          className="w-full sm:w-72"
        >
          {filters.map(([value, text]) => (
            <option key={value} value={value}>
              {text}
            </option>
          ))}
        </SelectBox>
      </div>
      {loading && <RowsSkeleton rows={3} />}
      {!loading && shown.length === 0 && <Empty title="Nothing here yet" />}
      {!loading && shown.length > 0 && (
        <ul tabIndex={scroll ? 0 : undefined} className={scroll ? 'max-h-72 overflow-y-auto' : undefined}>
          {shown.map((entry) => (
            <EntryRow key={`${entry.kind}-${entry.id}`} entry={entry} onAvail={onAvail} />
          ))}
        </ul>
      )}
    </Panel>
  );
}

function MoreMenu({ year }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (!root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  return (
    <div ref={root} className="relative">
      <IconButton label="More actions" aria-expanded={open} onClick={() => setOpen((value) => !value)} className="border border-line bg-surface">
        <MoreHorizontal className="h-4 w-4" strokeWidth={1.5} />
      </IconButton>
      {open && (
        <div className="absolute right-0 top-12 z-20 w-56 rounded border border-line bg-surface shadow-[0_12px_32px_-16px_rgba(28,35,33,0.4)]">
          <a href={`/api/me/leaves.csv?year=${year}`} className="flex min-h-11 items-center gap-3 px-4 text-sm hover:bg-bg" onClick={() => setOpen(false)}>
            <Download className="h-4 w-4 text-muted" strokeWidth={1.5} />
            Download {year} as CSV
          </a>
        </div>
      )}
    </div>
  );
}

function headline(data) {
  const left = data.balances
    .filter((balance) => balance.leaveType.tracksBalance && !balance.leaveType.restrictedHolidayOnly)
    .reduce((sum, balance) => sum + balance.available, 0);
  return `You have ${left} ${dayWord(left)} of leave left in ${data.year}`;
}

function nextUp(data) {
  const next = data.upcoming[0];
  if (!next) return 'Nothing else is planned for this year.';
  const when = `${weekday(next.from)}, ${longDate(next.from)}`;
  return next.from <= data.today ? `${next.title} is on now.` : `Next up: ${next.title} on ${when}.`;
}

function toEvents(entries) {
  const byDay = {};
  for (const entry of entries) {
    const cursor = new Date(`${entry.from}T00:00:00.000Z`);
    const end = new Date(`${entry.to}T00:00:00.000Z`);
    while (cursor <= end) {
      const key = cursor.toISOString().slice(0, 10);
      byDay[key] ??= [];
      byDay[key].push({
        key: `${entry.kind}-${entry.id}-${key}`,
        tone: entry.kind === 'holiday' ? 'holiday' : entry.status,
        label: entry.title,
        detail: entry.title,
      });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }
  return byDay;
}

export default function Summary() {
  const [year, setYear] = useState(null);
  const [view, setView] = useState('list');
  const [month, setMonth] = useState(null);
  const [dialog, setDialog] = useState({ open: false, preset: null });

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['summary', year],
    queryFn: () => api.get(`/me/summary${year ? `?year=${year}` : ''}`),
    placeholderData: keepPreviousData,
  });

  const events = useMemo(() => (data ? toEvents([...data.upcoming, ...data.past]) : {}), [data]);

  if (isError && !data) return <LoadError error={error} onRetry={refetch} />;

  const shownYear = data?.year ?? new Date().getFullYear();
  const today = data?.today ?? new Date().toISOString().slice(0, 10);
  const shownMonth = data
    ? (month ?? (Number(today.slice(0, 4)) === shownYear ? Number(today.slice(5, 7)) - 1 : 0))
    : 0;

  const changeYear = (delta) => {
    setYear(shownYear + delta);
    setMonth(null);
  };

  const avail = (entry) =>
    setDialog({
      open: true,
      preset: { leaveTypeId: data.restrictedHolidayTypeId, from: entry.from, to: entry.to },
    });

  return (
    <div className="space-y-6">
      <Reveal className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {data ? (
            <>
              <h1 className="max-w-4xl text-[40px] text-balance sm:text-[56px]">{headline(data)}</h1>
              <p className="mt-3 text-base text-muted sm:text-lg">{nextUp(data)}</p>
            </>
          ) : (
            <div className="skeleton h-24 w-96 max-w-full" />
          )}
        </div>
        <Button className="max-sm:w-full" onClick={() => setDialog({ open: true, preset: null })}>
          Apply Leave
        </Button>
      </Reveal>

      <Reveal delay={0.08} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-y border-line py-2">
        <p className="text-sm text-muted">
          Leave booked this year: <span className="font-medium tabular-nums text-ink">{data?.bookedThisYear ?? 0}</span>
          <span className="mx-2 text-line">|</span>
          Absent: <span className="font-medium tabular-nums text-ink">{data?.absent ?? 0}</span>
        </p>

        <div className="flex items-center">
          <IconButton label="Previous year" onClick={() => changeYear(-1)}>
            <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
          </IconButton>
          <p className="flex items-center gap-2 text-sm tabular-nums">
            <CalendarRange className="h-4 w-4 text-muted" strokeWidth={1.5} aria-hidden="true" />
            01/01/{shownYear} - 31/12/{shownYear}
          </p>
          <IconButton label="Next year" onClick={() => changeYear(1)}>
            <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
          </IconButton>
        </div>

        <div className="flex items-center gap-2">
          <div role="group" aria-label="View" className="flex overflow-hidden rounded border border-line bg-surface">
            {[
              ['list', 'List view', List],
              ['calendar', 'Calendar view', CalendarDays],
            ].map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                aria-label={label}
                aria-pressed={view === value}
                title={label}
                onClick={() => setView(value)}
                className={`grid h-10 w-10 place-items-center transition-colors max-sm:h-11 max-sm:w-11 ${
                  view === value ? 'bg-accent text-on-accent' : 'text-muted hover:text-ink'
                }`}
              >
                <Icon className="h-4 w-4" strokeWidth={1.5} />
              </button>
            ))}
          </div>
          <MoreMenu year={shownYear} />
        </div>
      </Reveal>

      <Reveal delay={0.14}>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded border border-line bg-line lg:grid-cols-5 max-lg:[&>*:last-child:nth-child(odd)]:col-span-2">
          {data
            ? data.balances.map((balance) => <BalanceCell key={balance.leaveType.id} balance={balance} />)
            : Array.from({ length: 5 }, (_, index) => <div key={index} className="h-44 bg-surface" />)}
        </div>
      </Reveal>

      {view === 'list' ? (
        <>
          <Reveal delay={0.2}>
            <EntryPanel
              label="Filter upcoming"
              filters={UPCOMING_FILTERS}
              entries={data?.upcoming ?? []}
              loading={isPending}
              onAvail={avail}
            />
          </Reveal>
          <Reveal delay={0.26}>
            <EntryPanel
              label="Filter past"
              filters={PAST_FILTERS}
              entries={data?.past ?? []}
              loading={isPending}
              onAvail={avail}
              scroll
            />
          </Reveal>
        </>
      ) : (
        <Reveal>
          <Panel>
            <CalendarGrid
              key={shownYear}
              year={shownYear}
              month={shownMonth}
              today={today}
              eventsByDay={events}
              minMonth={0}
              maxMonth={11}
              onMonthChange={(_, next) => setMonth(next)}
            />
          </Panel>
        </Reveal>
      )}

      <ApplyLeaveDialog
        open={dialog.open}
        preset={dialog.preset}
        today={today}
        onClose={() => setDialog({ open: false, preset: null })}
      />
    </div>
  );
}
