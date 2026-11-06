import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { monthGrid, monthLabel, slashDate, weekday } from '../lib/dates';
import { IconButton } from './ui';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const CHIP = {
  holiday: 'bg-sunken text-ink',
  approved: 'bg-accent-soft text-accent',
  pending: 'bg-pending-soft text-pending',
};

const LEGEND = [
  ['approved', 'Approved'],
  ['pending', 'Pending'],
  ['holiday', 'Holiday'],
];

// Month view. Wide screens show names inside the cells. On phones the cells are
// too small for names, so a cell shows a count and the chosen day lists below.
export function CalendarGrid({ year, month, today, eventsByDay, onMonthChange, minMonth, maxMonth }) {
  const cells = useMemo(() => monthGrid(year, month), [year, month]);
  const [picked, setPicked] = useState(null);

  const inMonth = picked && cells.includes(picked);
  const selected = inMonth ? picked : cells.includes(today) ? today : cells.find(Boolean);
  const selectedEvents = eventsByDay[selected] ?? [];

  const step = (delta) => {
    const next = new Date(Date.UTC(year, month + delta, 1));
    onMonthChange(next.getUTCFullYear(), next.getUTCMonth());
  };

  const atStart = minMonth !== undefined && month <= minMonth;
  const atEnd = maxMonth !== undefined && month >= maxMonth;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-3 py-2 sm:px-4">
        <div className="flex items-center gap-1">
          <IconButton label="Previous month" disabled={atStart} onClick={() => step(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </IconButton>
          <h2 className="min-w-36 text-center text-[15px]">{monthLabel(year, month)}</h2>
          <IconButton label="Next month" disabled={atEnd} onClick={() => step(1)}>
            <ChevronRight className="h-4 w-4" />
          </IconButton>
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 px-1 text-[13px] text-muted">
          {LEGEND.map(([tone, label]) => (
            <li key={tone} className="flex items-center gap-1.5">
              <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-sm ${CHIP[tone]} ring-1 ring-inset ring-current/25`} />
              {label}
            </li>
          ))}
        </ul>
      </div>

      <div className="grid grid-cols-7 border-b border-line bg-bg text-center text-xs font-medium text-muted">
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
              className={`flex min-h-14 min-w-0 flex-col items-stretch justify-start border-b border-r border-line p-1 text-left sm:min-h-[104px] sm:p-1.5 ${
                weekend ? 'bg-bg/60' : ''
              } ${cell === selected ? 'bg-accent-soft' : ''} ${index % 7 === 6 ? 'border-r-0' : ''}`}
            >
              {cell && (
                <>
                  <span
                    className={`inline-grid h-6 w-6 place-items-center rounded-full text-xs font-medium tabular-nums ${
                      isToday ? 'bg-accent text-on-accent' : 'text-muted'
                    }`}
                  >
                    {Number(cell.slice(8))}
                  </span>
                  <span className="mt-1 hidden space-y-0.5 sm:block">
                    {events.slice(0, 3).map((event) => (
                      <span
                        key={event.key}
                        title={event.detail}
                        className={`block truncate rounded px-1.5 py-0.5 text-[11px] font-medium ${CHIP[event.tone]}`}
                      >
                        {event.label}
                      </span>
                    ))}
                    {events.length > 3 && <span className="block px-1.5 text-[11px] text-muted">{events.length - 3} more</span>}
                  </span>
                  {events.length > 0 && (
                    <span className="mt-0.5 block text-center text-xs font-medium tabular-nums text-accent sm:hidden">{events.length}</span>
                  )}
                </>
              )}
            </button>
          );
        })}
      </div>

      <div className="p-4">
        <p className="text-sm font-medium">
          {slashDate(selected)}, {weekday(selected)}
        </p>
        {selectedEvents.length === 0 && <p className="mt-1 text-sm text-muted">Nobody is on leave and there is no holiday on this day.</p>}
        <ul className="mt-2 space-y-2">
          {selectedEvents.map((event) => (
            <li key={event.key} className="flex items-center gap-2 text-sm">
              <span aria-hidden="true" className={`h-2.5 w-2.5 shrink-0 rounded-sm ${CHIP[event.tone]} ring-1 ring-inset ring-current/25`} />
              <span className="min-w-0">{event.detail}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
