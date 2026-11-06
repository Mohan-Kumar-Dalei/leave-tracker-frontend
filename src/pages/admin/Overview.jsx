import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ReviewList } from '../../components/ReviewList';
import { BigNumber, Empty, LoadError, Panel, Reveal, RowsSkeleton } from '../../components/ui';
import { api } from '../../lib/api';
import { dayWord, longDate, shortRange, weekday } from '../../lib/dates';

function headline(pending) {
  if (pending === 0) return 'Nothing is waiting for you';
  return `${pending} ${pending === 1 ? 'request is' : 'requests are'} waiting for you`;
}

function Stat({ label, value }) {
  return (
    <div className="bg-surface p-4 sm:p-5">
      {value === undefined ? <div className="skeleton h-10 w-12" /> : <BigNumber value={value} size={2.5} />}
      <p className="mt-2 text-sm text-muted">{label}</p>
    </div>
  );
}

function PeopleList({ title, items, empty, describe }) {
  return (
    <Panel>
      <h2 className="border-b border-line px-5 py-3 text-[18px]">{title}</h2>
      {items.length === 0 && <p className="px-5 py-4 text-sm text-muted">{empty}</p>}
      <ul>
        {items.map((leave) => (
          <li key={leave.id} className="flex items-baseline justify-between gap-4 border-b border-line px-5 py-2.5 text-sm last:border-b-0">
            <span className="min-w-0 truncate font-medium">{leave.user?.name}</span>
            <span className="shrink-0 tabular-nums text-muted">{describe(leave)}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function UsageByType({ rows }) {
  const max = Math.max(1, ...rows.map((row) => row.days));

  return (
    <Panel>
      <h2 className="border-b border-line px-5 py-3 text-[18px]">Approved days this year, by leave type</h2>
      {rows.length === 0 && <p className="px-5 py-4 text-sm text-muted">No leave has been approved yet.</p>}
      <table className="w-full text-sm">
        <thead className="sr-only">
          <tr>
            <th>Leave type</th>
            <th>Approved days</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.code}
              className="border-b border-line last:border-b-0"
              title={`${row.name}: ${row.days} ${dayWord(row.days)} across ${row.requests} ${row.requests === 1 ? 'request' : 'requests'}`}
            >
              <td className="w-2/5 px-5 py-2.5 align-middle sm:w-1/3">{row.name}</td>
              <td className="py-2.5 pr-5 align-middle">
                <div className="flex items-center gap-3">
                  <div className="h-2 flex-1" aria-hidden="true">
                    <div className="h-full origin-left rounded-r-sm bg-accent" style={{ transform: `scaleX(${row.days / max})` }} />
                  </div>
                  <span className="w-10 text-right tabular-nums">{row.days}</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

export default function Overview() {
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: () => api.get('/admin/overview'),
  });

  if (isError) return <LoadError error={error} onRetry={refetch} />;

  return (
    <div className="space-y-6">
      <Reveal>
        {data ? (
          <h1 className="text-[40px] sm:text-[56px]">{headline(data.pendingCount)}</h1>
        ) : (
          <div className="skeleton h-16 w-96 max-w-full" />
        )}
        <p className="mt-3 text-base text-muted sm:text-lg">
          {data ? `${weekday(data.today)}, ${longDate(data.today)}.` : ''}{' '}
          {data && data.awayToday.length > 0
            ? `${data.awayToday.length} ${data.awayToday.length === 1 ? 'person is' : 'people are'} away today.`
            : data
              ? 'Everyone is in today.'
              : ''}
        </p>
      </Reveal>

      <Reveal delay={0.08}>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded border border-line bg-line lg:grid-cols-4">
          <Stat label="Waiting for a decision" value={data?.pendingCount} />
          <Stat label="Away today" value={data?.awayToday.length} />
          <Stat label="Active employees" value={data?.employees} />
          <Stat label="Days approved this month" value={data?.approvedDaysThisMonth} />
        </div>
      </Reveal>

      <div className="grid items-start gap-6 lg:grid-cols-[1.7fr_1fr]">
        <Reveal delay={0.14}>
          <Panel>
            <div className="flex items-center justify-between border-b border-line px-5 py-3">
              <h2 className="text-[18px]">Decide next</h2>
              <Link to="/admin/requests" className="text-sm text-accent underline-offset-4 hover:underline">
                All requests
              </Link>
            </div>
            {isPending && <RowsSkeleton />}
            {data?.pending.length === 0 && <Empty title="All caught up">New requests land here the moment they are sent.</Empty>}
            {data && <ReviewList items={data.pending} compact keepFinished={false} />}
          </Panel>
        </Reveal>

        <Reveal delay={0.2} className="space-y-6">
          <PeopleList
            title="Away today"
            items={data?.awayToday ?? []}
            empty="Everyone is in."
            describe={(leave) => `until ${shortRange(leave.to, leave.to)}`}
          />
          <PeopleList
            title="Away in the next 14 days"
            items={data?.nextUp ?? []}
            empty="No approved leave coming up."
            describe={(leave) => shortRange(leave.from, leave.to)}
          />
          <Panel>
            <h2 className="border-b border-line px-5 py-3 text-[18px]">Coming holidays</h2>
            {(data?.holidays ?? []).length === 0 && <p className="px-5 py-4 text-sm text-muted">No holidays are listed.</p>}
            <ul>
              {data?.holidays.map((holiday) => (
                <li key={holiday.id} className="flex items-baseline justify-between gap-4 border-b border-line px-5 py-2.5 text-sm last:border-b-0">
                  <span className="min-w-0 truncate font-medium">{holiday.name}</span>
                  <span className="shrink-0 tabular-nums text-muted">{shortRange(holiday.date, holiday.date)}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </Reveal>
      </div>

      {data && (
        <Reveal delay={0.1}>
          <UsageByType rows={data.byType} />
        </Reveal>
      )}
    </div>
  );
}
