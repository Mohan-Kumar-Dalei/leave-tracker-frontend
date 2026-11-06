import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  Award,
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Download,
  Info,
  List,
  MoreHorizontal,
  Palmtree,
  RefreshCw,
  Sparkles,
  Sun,
  Wallet,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../lib/auth';
import { ApplyLeaveDialog } from '../../components/ApplyLeave';
import { MonthlyBars } from '../../components/MonthlyBars';
import { StatusBadge } from '../../components/StatusBadge';
import { TeamCalendarView } from '../../components/TeamCalendarView';
import { Button, Empty, IconButton, LoadError, Panel, PanelTitle, Reveal, RowsSkeleton, SelectBox } from '../../components/ui';
import { api } from '../../lib/api';
import { dayRange, dayWord, longDate, slashDate, weekday } from '../../lib/dates';

const TYPE_LOOK = {
  CLSL: { icon: Sun, tile: 'bg-[#edf2ff] text-[#2f5bea]' },
  CO: { icon: RefreshCw, tile: 'bg-[#f1f6e4] text-[#5f8a12]' },
  EL: { icon: Award, tile: 'bg-[#e6f6ef] text-[#0e7f56]' },
  LWP: { icon: Wallet, tile: 'bg-[#fdeceb] text-[#c4362f]' },
  RH: { icon: Sparkles, tile: 'bg-[#e6f5fb] text-[#0b7ea4]' },
};

const fallbackLook = { icon: CalendarDays, tile: 'bg-sunken text-muted' };

function bookedDetail({ earlier, approved, pending }) {
  const parts = [`${approved} approved`, `${pending} pending`];
  if (earlier > 0) parts.unshift(`${earlier} from earlier records`);
  return parts.join(', ');
}

function BookedInfo({ balance }) {
  const detail = bookedDetail(balance);
  return (
    <span className="group relative inline-flex">
      <button type="button" aria-label={detail} className="grid h-5 w-5 place-items-center text-muted hover:text-ink">
        <Info className="h-3.5 w-3.5" />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full right-0 z-10 mb-1.5 hidden w-max max-w-56 rounded-lg bg-ink px-2.5 py-1.5 text-xs text-surface group-focus-within:block group-hover:block"
      >
        {detail}
      </span>
    </span>
  );
}

function BalanceCard({ balance }) {
  const { leaveType, available, booked } = balance;
  const look = TYPE_LOOK[leaveType.code] ?? fallbackLook;
  const low = leaveType.tracksBalance && available <= 0;

  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-card">
      <div className="flex items-start gap-3">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${look.tile}`}>
          <look.icon className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
        <h3 className="min-h-9 text-[13px] font-medium leading-[18px] tracking-normal">{leaveType.name}</h3>
      </div>
      <dl className="mt-4 space-y-2 text-[13px]">
        {leaveType.tracksBalance && (
          <div className="flex items-baseline justify-between">
            <dt className="text-muted">Available</dt>
            <dd className={`text-xl font-semibold tabular-nums ${low ? 'text-muted' : 'text-approved'}`}>{available}</dd>
          </div>
        )}
        <div className="flex items-center justify-between">
          <dt className="text-muted">Booked</dt>
          <dd className="flex items-center gap-1 font-medium tabular-nums">
            {booked}
            <BookedInfo balance={balance} />
          </dd>
        </div>
      </dl>
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
    <li className="grid gap-x-4 gap-y-1 border-b border-line px-4 py-3 last:border-b-0 sm:grid-cols-[170px_minmax(150px,240px)_1fr_90px] sm:items-center sm:px-5">
      <p className="text-[13px] tabular-nums text-muted">
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
          <Palmtree className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
        ) : (
          <CalendarDays className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
        )}
        <span className="min-w-0">
          {entry.title}
          {entry.restricted && <span className="font-normal text-muted"> (Restricted)</span>}
        </span>
      </p>
      <p className="min-w-0 text-[13px] text-muted">
        {isLeave ? `${entry.days} ${dayWord(entry.days)}. ${entry.reason}` : entry.note}
      </p>
      <div className="justify-self-start sm:justify-self-end">
        {isLeave && <StatusBadge status={entry.status} />}
        {!isLeave && entry.availed && <span className="text-[13px] font-medium text-accent">Availed</span>}
        {!isLeave && entry.canAvail && (
          <Button variant="secondary" className="h-8!" onClick={() => onAvail(entry)}>
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
          className="w-full sm:w-64"
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
        <MoreHorizontal className="h-4 w-4" />
      </IconButton>
      {open && (
        <div className="absolute right-0 top-11 z-20 w-56 overflow-hidden rounded-xl border border-line bg-surface shadow-float">
          <a href={`/api/me/leaves.csv?year=${year}`} className="flex h-10 items-center gap-2.5 px-3 text-sm hover:bg-bg" onClick={() => setOpen(false)}>
            <Download className="h-4 w-4 text-muted" aria-hidden="true" />
            Download {year} as CSV
          </a>
        </div>
      )}
    </div>
  );
}

function subtitle(data) {
  const left = data.balances
    .filter((balance) => balance.leaveType.tracksBalance && !balance.leaveType.restrictedHolidayOnly)
    .reduce((sum, balance) => sum + balance.available, 0);
  const next = data.upcoming[0];
  const lead = `${left} ${dayWord(left)} of leave left in ${data.year}.`;
  if (!next) return lead;
  if (next.from <= data.today) return `${lead} ${next.title} is on now.`;
  return `${lead} Next up: ${next.title}, ${weekday(next.from)} ${longDate(next.from)}.`;
}

export default function Summary() {
  const { user } = useAuth();
  const [year, setYear] = useState(null);
  const [view, setView] = useState('list');
  const [month, setMonth] = useState(null);
  const [dialog, setDialog] = useState({ open: false, preset: null });

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['summary', year],
    queryFn: () => api.get(`/me/summary${year ? `?year=${year}` : ''}`),
    placeholderData: keepPreviousData,
  });

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
    <div className="space-y-4">
      <Reveal className="flex flex-wrap items-center justify-between gap-3 pb-2">
        <div className="min-w-0">
          <h1 className="text-[22px] sm:text-2xl">Welcome back, {user.name.split(' ')[0]}</h1>
          <p className="mt-1 text-sm text-muted">{data ? subtitle(data) : ' '}</p>
        </div>
        <Button className="max-sm:w-full" onClick={() => setDialog({ open: true, preset: null })}>
          Apply Leave
        </Button>
      </Reveal>

      <Reveal delay={0.04} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <p className="text-[13px] text-muted">
          Leave booked this year: <span className="font-medium tabular-nums text-ink">{data?.bookedThisYear ?? 0}</span>
          <span className="mx-2 text-line">|</span>
          Absent: <span className="font-medium tabular-nums text-ink">{data?.absent ?? 0}</span>
        </p>

        <div className="flex items-center rounded-lg border border-line bg-surface shadow-card">
          <IconButton label="Previous year" onClick={() => changeYear(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </IconButton>
          <p className="flex items-center gap-2 px-1 text-[13px] font-medium tabular-nums">
            <CalendarRange className="h-4 w-4 text-muted" aria-hidden="true" />
            01/01/{shownYear} - 31/12/{shownYear}
          </p>
          <IconButton label="Next year" onClick={() => changeYear(1)}>
            <ChevronRight className="h-4 w-4" />
          </IconButton>
        </div>

        <div className="flex items-center gap-2">
          <div role="group" aria-label="View" className="flex gap-0.5 rounded-lg bg-sunken p-0.5">
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
                className={`grid h-8 w-9 place-items-center rounded-md transition-colors max-sm:h-10 max-sm:w-11 ${
                  view === value ? 'bg-surface text-accent shadow-card' : 'text-muted hover:text-ink'
                }`}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
          <MoreMenu year={shownYear} />
        </div>
      </Reveal>

      <Reveal delay={0.08}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {data
            ? data.balances.map((balance) => <BalanceCard key={balance.leaveType.id} balance={balance} />)
            : Array.from({ length: 5 }, (_, index) => <div key={index} className="h-36 animate-pulse rounded-lg bg-sunken motion-reduce:animate-none" />)}
        </div>
      </Reveal>

      {view === 'list' ? (
        <>
          <Reveal delay={0.12}>
            <EntryPanel
              label="Filter upcoming"
              filters={UPCOMING_FILTERS}
              entries={data?.upcoming ?? []}
              loading={isPending}
              onAvail={avail}
            />
          </Reveal>
          <Reveal delay={0.16}>
            <EntryPanel
              label="Filter past"
              filters={PAST_FILTERS}
              entries={data?.past ?? []}
              loading={isPending}
              onAvail={avail}
              scroll
            />
          </Reveal>
          {data && data.monthly.some((days) => days > 0) && (
            <Reveal delay={0.2}>
              <Panel>
                <PanelTitle>Leave used by month, {shownYear}</PanelTitle>
                <MonthlyBars months={data.monthly} />
              </Panel>
            </Reveal>
          )}
        </>
      ) : (
        <Reveal>
          <TeamCalendarView
            year={shownYear}
            month={shownMonth}
            minMonth={0}
            maxMonth={11}
            onMonthChange={(_, next) => setMonth(next)}
          />
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
