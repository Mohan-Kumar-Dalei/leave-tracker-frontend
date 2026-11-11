import { CalendarDays, Palmtree } from 'lucide-react';
import { useMemo, useState } from 'react';
import { dayRange, dayWord, slashDate, weekday } from '../lib/dates';
import { StatusBadge } from './StatusBadge';
import { Button, Empty, Panel, RowsSkeleton, SelectBox } from './ui';

export const UPCOMING_FILTERS = [
  ['all', 'Upcoming Leaves & Holidays'],
  ['leave', 'Upcoming Leaves'],
  ['holiday', 'Upcoming Holidays'],
];

export const PAST_FILTERS = [
  ['all', 'Past Leaves & Holidays'],
  ['leave', 'Past Leaves'],
  ['holiday', 'Past Holidays'],
];

function EntryRow({ entry, onAvail }) {
  const isLeave = entry.kind === 'leave';
  const detail = isLeave ? (entry.detail ?? `${entry.days} ${dayWord(entry.days)}. ${entry.reason}`) : entry.note;

  return (
    // Laid out by the width of the list, not the screen: with the side column
    // the list is narrower, so the note moves to its own line until there is room.
    <li className="grid gap-x-4 gap-y-1 border-b border-line px-4 py-3 last:border-b-0 @xl:grid-cols-[150px_minmax(0,1fr)_auto] @xl:items-center @xl:px-5 @4xl:grid-cols-[170px_minmax(150px,240px)_1fr_90px]">
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
      <p className="min-w-0 text-[13px] text-muted @xl:order-last @xl:col-span-full @4xl:order-none @4xl:col-span-1">{detail}</p>
      <div className="justify-self-start @xl:justify-self-end">
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

export function EntryPanel({ filters, entries, loading, scroll, onAvail, label }) {
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
        <ul tabIndex={scroll ? 0 : undefined} className={`@container ${scroll ? 'max-h-96 overflow-y-auto' : ''}`}>
          {shown.map((entry) => (
            <EntryRow key={`${entry.kind}-${entry.id}`} entry={entry} onAvail={onAvail} />
          ))}
        </ul>
      )}
    </Panel>
  );
}
