import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { api } from '../lib/api';
import { dayWord, monthKey, monthLabel, shortRange } from '../lib/dates';
import { CalendarGrid } from './CalendarGrid';
import { StatusBadge } from './StatusBadge';
import { LoadError, LoadingBar, Panel, PanelTitle, RowsSkeleton, SelectBox, StickyTop } from './ui';

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
      // Office holidays show in red, like Sundays; restricted ones are optional.
      tone: holiday.restricted ? 'restricted' : 'holiday',
      label: holiday.name,
      detail: `${holiday.name}${holiday.restricted ? ' (Restricted holiday)' : ''}`,
    });
  }

  for (const leave of data?.leaves ?? []) {
    const cursor = new Date(`${leave.from}T00:00:00.000Z`);
    const end = new Date(`${leave.to}T00:00:00.000Z`);
    while (cursor <= end) {
      const day = cursor.toISOString().slice(0, 10);
      const dayOff = (data.weekendDays ?? [0]).includes(cursor.getUTCDay()) || closed.has(day);
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

function MonthLeaves({ leaves, title, loading, showDepartment = false }) {
  return (
    <Panel>
      <PanelTitle>{title}</PanelTitle>
      {loading && <RowsSkeleton rows={3} />}
      {!loading && leaves.length === 0 && <p className="px-4 py-4 text-sm text-muted">Nobody has applied for leave this month.</p>}
      <ul className="lg:max-h-[32rem] lg:overflow-y-auto">
        {!loading &&
          leaves.map((leave) => (
            <li key={leave.id} className="border-b border-line px-4 py-2.5 last:border-b-0">
              <div className="flex items-center justify-between gap-3">
                <p className="min-w-0 truncate text-sm font-medium">{leave.name}</p>
                <StatusBadge status={leave.status} />
              </div>
              <p className="mt-0.5 text-[13px] tabular-nums text-muted">
                {shortRange(leave.from, leave.to)}, {leave.days} {dayWord(leave.days)}
              </p>
              {(leave.leaveType || (showDepartment && leave.department)) && (
                <p className="text-[13px] text-muted">
                  {[showDepartment && leave.department, leave.leaveType].filter(Boolean).join(' · ')}
                </p>
              )}
            </li>
          ))}
      </ul>
    </Panel>
  );
}

// The whole team's leave for a month. Admins see it on the Team calendar page and
// employees in the calendar view of My leave. Someone over several departments
// (a manager) picks one, or sees them all.
// With `heading` (the Team calendar page), the heading and the department
// picker are the page's top, which stays put on a desktop.
export function TeamCalendarView({ year, month, onMonthChange, minMonth, maxMonth, heading = null }) {
  const [department, setDepartment] = useState('');
  const { data, isError, error, refetch, isPlaceholderData, isFetching } = useQuery({
    queryKey: ['team-calendar', year, month, ...(department ? [department] : [])],
    queryFn: () =>
      api.get(`/team-calendar?month=${monthKey(year, month)}${department ? `&department=${encodeURIComponent(department)}` : ''}`),
    placeholderData: keepPreviousData,
  });
  const departments = data?.departments ?? [];
  const picker = departments.length > 0 && (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted">Department</span>
      <SelectBox aria-label="Department" value={department} onChange={(event) => setDepartment(event.target.value)}>
        <option value="">All departments</option>
        {departments.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </SelectBox>
    </div>
  );

  const events = useMemo(() => toEvents(data), [data]);
  const today = data?.today ?? new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      {heading ? (
        <StickyTop>
          {heading}
          {picker}
        </StickyTop>
      ) : (
        picker
      )}
      <div className="grid items-start gap-4 xl:grid-cols-[1fr_320px]">
        <Panel>
          <LoadingBar show={isFetching && (!data || isPlaceholderData)} />
          {isError ? (
            <LoadError error={error} onRetry={refetch} />
          ) : (
            <CalendarGrid
              year={year}
              month={month}
              today={today}
              eventsByDay={events}
              weekendDays={data?.weekendDays}
              minMonth={minMonth}
              maxMonth={maxMonth}
              onMonthChange={onMonthChange}
            />
          )}
        </Panel>
        <MonthLeaves
          leaves={data?.leaves ?? []}
          loading={!data || isPlaceholderData}
          title={`Leave in ${monthLabel(year, month)}${department ? `, ${department}` : ''}`}
          showDepartment={!department}
        />
      </div>
    </div>
  );
}
