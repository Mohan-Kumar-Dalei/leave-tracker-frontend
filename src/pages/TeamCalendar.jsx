import { useState } from 'react';
import { TeamCalendarView } from '../components/TeamCalendarView';
import { PageHeading, Reveal } from '../components/ui';

export default function TeamCalendar() {
  const now = new Date();
  const [{ year, month }, setShown] = useState({ year: now.getFullYear(), month: now.getMonth() });

  return (
    <div>
      <PageHeading title="Team calendar">See who is away. Click a date to see everyone on leave that day.</PageHeading>
      <Reveal delay={0.04}>
        <TeamCalendarView
          year={year}
          month={month}
          onMonthChange={(nextYear, nextMonth) => setShown({ year: nextYear, month: nextMonth })}
        />
      </Reveal>
    </div>
  );
}
