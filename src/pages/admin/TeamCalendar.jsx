import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { CalendarGrid } from '../../components/CalendarGrid';
import { LoadError, PageHeading, Panel, Reveal } from '../../components/ui';
import { api } from '../../lib/api';
import { monthKey } from '../../lib/dates';

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

  for (const holiday of data?.holidays ?? []) {
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
      const weekend = [0, 6].includes(cursor.getUTCDay());
      if (!weekend) {
        add(day, {
          key: `l-${leave.id}-${day}`,
          tone: leave.status,
          label: shortName(leave.user?.name),
          detail: `${leave.user?.name}, ${leave.leaveType?.name}`,
        });
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }
  return byDay;
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
      <PageHeading title="Team calendar">See who is away before you approve the next request.</PageHeading>
      <Reveal delay={0.08}>
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
      </Reveal>
    </div>
  );
}
