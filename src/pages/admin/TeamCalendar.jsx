import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { CalendarGrid } from '../../components/CalendarGrid';
import { StatusBadge } from '../../components/StatusBadge';
import { LoadError, PageHeading, Panel, PanelTitle, Reveal } from '../../components/ui';
import { api } from '../../lib/api';
import { dayWord, monthKey, monthLabel, shortRange } from '../../lib/dates';

const shortName = (name = '') => {
  const [first, last] = name.split(' ');
  return last ? `${first} ${last[0]}.` : first;
};

function toEvents(data) {
  const byDay = {};
  const add = (day, event) => {
    byDay[day] ??= [];
    byDay[day].push(event);
  };

  const closed = new Set();
  for (const holiday of data?.holidays ?? []) {
    if (!holiday.restricted) closed.add(holiday.date);
    add(holiday.date, {
      key: `h-${holiday.id}`,
      tone: 'holiday',
      label: holiday.name,
      detail: `${holiday.name}${holiday.restricted ? ' (Restricted holiday)' : ''}`,
    });
  }

  for (const leave of data?.leaves ?? []) {
    const cursor = new Date(`${leave.from}T00:00:00.000Z`);
    const end = new Date(`${leave.to}T00:00:00.000Z`);
    while (cursor <= end) {
      const day = cursor.toISOString().slice(0, 10);
      const dayOff = [0, 6].includes(cursor.getUTCDay()) || closed.has(day);
      if (!dayOff) {
        add(day, {
          key: `l-${leave.id}-${day}`,
          tone: leave.status,
          label: shortName(leave.user?.name),
          detail: `${leave.user?.name}, ${leave.leaveType?.name}${leave.session === 'full' ? '' : ', half day'}`,
        });
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }
  return byDay;
}

function MonthLeaves({ leaves, title }) {
  return (
    <Panel>
      <PanelTitle>{title}</PanelTitle>
      {leaves.length === 0 && <p className="px-4 py-4 text-sm text-muted">No leave with dates in this month.</p>}
      <ul className="max-h-96 overflow-y-auto">
        {leaves.map((leave) => (
          <li key={leave.id} className="border-b border-line px-4 py-2.5 last:border-b-0">
            <div className="flex items-center justify-between gap-3">
              <p className="min-w-0 truncate text-sm font-medium">{leave.user?.name}</p>
              <StatusBadge status={leave.status} />
            </div>
            <p className="mt-0.5 text-[13px] tabular-nums text-muted">
              {shortRange(leave.from, leave.to)}, {leave.days} {dayWord(leave.days)}
            </p>
            <p className="text-[13px] text-muted">{leave.leaveType?.name}</p>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function SheetTotals({ rows }) {
  const total = rows.reduce((sum, row) => sum + row.days, 0);

  return (
    <Panel>
      <PanelTitle action={<span className="text-[13px] tabular-nums text-muted">{total} {dayWord(total)}</span>}>
        From the old sheet
      </PanelTitle>
      <p className="border-b border-line px-4 py-2 text-[13px] text-muted">
        The sheet has monthly totals, not dates, so these people cannot be placed on the calendar.
      </p>
      <ul className="max-h-72 overflow-y-auto">
        {rows.map((row) => (
          <li key={row.id} className="flex items-baseline justify-between gap-3 border-b border-line px-4 py-2 text-sm last:border-b-0">
            <span className="min-w-0 truncate">{row.name}</span>
            <span className="shrink-0 text-[13px] tabular-nums text-muted">
              {row.days} {dayWord(row.days)}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export default function TeamCalendar() {
  const now = new Date();
  const [{ year, month }, setShown] = useState({ year: now.getFullYear(), month: now.getMonth() });

  const { data, isError, error, refetch } = useQuery({
    queryKey: ['team-calendar', year, month],
    queryFn: () => api.get(`/admin/calendar?month=${monthKey(year, month)}`),
    placeholderData: keepPreviousData,
  });

  const events = useMemo(() => toEvents(data), [data]);
  const today = now.toISOString().slice(0, 10);

  return (
    <div>
      <PageHeading title="Team calendar">Click a date to see everyone on leave that day.</PageHeading>
      <Reveal delay={0.04} className="grid items-start gap-4 xl:grid-cols-[1fr_320px]">
        <Panel>
          {isError ? (
            <LoadError error={error} onRetry={refetch} />
          ) : (
            <CalendarGrid
              year={year}
              month={month}
              today={today}
              eventsByDay={events}
              onMonthChange={(nextYear, nextMonth) => setShown({ year: nextYear, month: nextMonth })}
            />
          )}
        </Panel>
        <div className="space-y-4">
          <MonthLeaves leaves={data?.leaves ?? []} title={`Leave in ${monthLabel(year, month)}`} />
          {(data?.earlier ?? []).length > 0 && <SheetTotals rows={data.earlier} />}
        </div>
      </Reveal>
    </div>
  );
}
