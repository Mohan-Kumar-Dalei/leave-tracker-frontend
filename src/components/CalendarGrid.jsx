import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { monthGrid, monthLabel, slashDate, weekday } from '../lib/dates';
import { IconButton } from './ui';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const CHIP = {
  holiday: 'bg-sunken text-ink',
  approved: 'bg-accent text-on-accent',
  pending: 'border border-dashed border-pending text-pending',
};

const LEGEND = [
  ['approved', 'Approved leave'],
  ['pending', 'Awaiting decision'],
  ['holiday', 'Holiday'],
];

// Month view. Wide screens show names inside the cells. On phones the cells are
// too small for names, so a cell shows a count and the chosen day lists below.
export function CalendarGrid({ year, month, today, eventsByDay, onMonthChange, minMonth, maxMonth }) {
  const cells = useMemo(() => monthGrid(year, month), [year, month]);
  const [picked, setPicked] = useState(null);

  const inMonth = picked && cells.includes(picked);
  const selected = inMonth ? picked : (cells.includes(today) ? today : cells.find(Boolean));
  const selectedEvents = eventsByDay[selected] ?? [];

  const step = (delta) => {
    const next = new Date(Date.UTC(year, month + delta, 1));
    onMonthChange(next.getUTCFullYear(), next.getUTCMonth());
  };

  const atStart = minMonth !== undefined && month <= minMonth;
  const atEnd = maxMonth !== undefined && month >= maxMonth;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="flex items-center gap-1">
          <IconButton label="Previous month" disabled={atStart} onClick={() => step(-1)}>
            <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
          </IconButton>
          <h2 className="min-w-44 text-center text-[22px]">{monthLabel(year, month)}</h2>
          <IconButton label="Next month" disabled={atEnd} onClick={() => step(1)}>
            <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
          </IconButton>
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
          {LEGEND.map(([tone, label]) => (
            <li key={tone} className="flex items-center gap-2">
              <span aria-hidden="true" className={`h-3 w-3 rounded-sm ${CHIP[tone]}`} />
              {label}
            </li>
          ))}
        </ul>
      </div>

      <div className="grid grid-cols-7 border-b border-line text-center text-sm text-muted">
        {WEEKDAYS.map((day) => (
          <div key={day} className="py-2">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((cell, index) => {
          const events = cell ? (eventsByDay[cell] ?? []) : [];
          const weekend = index % 7 >= 5;
          const isToday = cell === today;
          return (
            <button
              key={cell ?? `blank-${index}`}
              type="button"
              disabled={!cell}
              onClick={() => setPicked(cell)}
              aria-label={cell ? `${slashDate(cell)}, ${events.length} entries` : undefined}
              aria-pressed={cell === selected}
              className={`flex min-h-14 min-w-0 flex-col items-stretch justify-start border-b border-r border-line p-1 text-left sm:min-h-28 sm:p-2 ${
                weekend ? 'bg-bg' : ''
              } ${cell === selected ? 'max-sm:bg-sunken' : ''} ${index % 7 === 6 ? 'border-r-0' : ''}`}
            >
              {cell && (
                <>
                  <span
                    className={`inline-grid h-6 w-6 place-items-center rounded-sm text-sm tabular-nums ${
                      isToday ? 'bg-ink text-bg' : 'text-muted'
                    }`}
                  >
                    {Number(cell.slice(8))}
                  </span>
                  <span className="mt-1 hidden space-y-1 sm:block">
                    {events.slice(0, 3).map((event) => (
                      <span
                        key={event.key}
                        title={event.detail}
                        className={`block truncate rounded-sm px-1.5 py-0.5 text-xs ${CHIP[event.tone]}`}
                      >
                        {event.label}
                      </span>
                    ))}
                    {events.length > 3 && <span className="block text-xs text-muted">{events.length - 3} more</span>}
                  </span>
                  {events.length > 0 && (
                    <span className="mt-0.5 block text-center text-xs tabular-nums text-ink sm:hidden">{events.length}</span>
                  )}
                </>
              )}
            </button>
          );
        })}
      </div>

      <div className="p-4 sm:hidden">
        <p className="text-sm font-medium">
          {slashDate(selected)}, {weekday(selected)}
        </p>
        {selectedEvents.length === 0 && <p className="mt-1 text-sm text-muted">Nothing on this day.</p>}
        <ul className="mt-2 space-y-2">
          {selectedEvents.map((event) => (
            <li key={event.key} className="flex items-center gap-2 text-sm">
              <span aria-hidden="true" className={`h-3 w-3 shrink-0 rounded-sm ${CHIP[event.tone]}`} />
              <span className="min-w-0">{event.detail}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
