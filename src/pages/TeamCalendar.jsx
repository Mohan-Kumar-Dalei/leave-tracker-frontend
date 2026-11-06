import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { ApplyLeaveDialog } from '../components/ApplyLeave';
import { CalendarGrid } from '../components/CalendarGrid';
import { StatusBadge } from '../components/StatusBadge';
import { Button, LoadError, PageHeading, Panel, PanelTitle, Reveal } from '../components/ui';
import { api } from '../lib/api';
import { dayWord, monthKey, monthLabel, shortRange } from '../lib/dates';

const shortName = (name = '') => {
  const [first, last] = name.split(' ');
  return last ? `${first} ${last[0]}.` : first;
};

function describe(leave) {
  const parts = [leave.name];
  if (leave.leaveType) parts.push(leave.leaveType);
  if (leave.session !== 'full') parts.push('half day');
  return parts.join(', ');
}

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
          label: shortName(leave.name),
          detail: describe(leave),
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
      {leaves.length === 0 && <p className="px-4 py-4 text-sm text-muted">Nobody has leave booked this month.</p>}
      <ul className="max-h-[32rem] overflow-y-auto">
        {leaves.map((leave) => (
          <li key={leave.id} className="border-b border-line px-4 py-2.5 last:border-b-0">
            <div className="flex items-center justify-between gap-3">
              <p className="min-w-0 truncate text-sm font-medium">{leave.name}</p>
              <StatusBadge status={leave.status} />
            </div>
            <p className="mt-0.5 text-[13px] tabular-nums text-muted">
              {shortRange(leave.from, leave.to)}, {leave.days} {dayWord(leave.days)}
            </p>
            {leave.leaveType && <p className="text-[13px] text-muted">{leave.leaveType}</p>}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export default function TeamCalendar() {
  const now = new Date();
  const [{ year, month }, setShown] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [applying, setApplying] = useState(false);

  const { data, isError, error, refetch } = useQuery({
    queryKey: ['team-calendar', year, month],
    queryFn: () => api.get(`/team-calendar?month=${monthKey(year, month)}`),
    placeholderData: keepPreviousData,
  });

  const events = useMemo(() => toEvents(data), [data]);
  const today = data?.today ?? now.toISOString().slice(0, 10);

  return (
    <div>
      <PageHeading
        title="Team calendar"
        actions={<Button onClick={() => setApplying(true)}>Apply Leave</Button>}
      >
        See who is away, then pick your dates. Click a date to see everyone on leave that day.
      </PageHeading>

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
        <MonthLeaves leaves={data?.leaves ?? []} title={`Leave in ${monthLabel(year, month)}`} />
      </Reveal>

      <ApplyLeaveDialog open={applying} today={today} onClose={() => setApplying(false)} />
    </div>
  );
}
