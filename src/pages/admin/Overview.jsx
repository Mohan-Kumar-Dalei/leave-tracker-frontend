import { useQuery } from '@tanstack/react-query';
import { CalendarCheck2, Clock3, Palmtree, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ReviewList } from '../../components/ReviewList';
import { HomeSidebar } from '../../components/HomeSidebar';
import { useTeam } from '../../components/TeamPeople';
import { MandalaBackdrop } from '../../components/MandalaCorner';
import { Empty, LoadError, Panel, PanelTitle, Reveal, RowsSkeleton } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { dayWord, greeting, longDate, shortRange, weekday } from '../../lib/dates';
import { useAppPath } from '../../hooks/useAppPath';

// The stat cards sit 2 or 4 to a row, so cards pair up the same way at every
// size: each pair shares one mandala, centred on the top edge in the gap
// between them (the first shows its top right corner, the second its top left).
function Stat({ label, value, icon: Icon, index, ink }) {
  const side = index % 2 === 0 ? '-right-[88px]' : '-left-[88px]';
  return (
    <div className="relative isolate flex min-h-28 flex-col justify-between overflow-hidden rounded-xl border border-line bg-surface p-4 shadow-card sm:p-5">
      <MandalaBackdrop className={`-top-[88px] h-44 w-44 ${side} ${ink}`} />
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-sm leading-5 text-muted">{label}</p>
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
      </div>
      {value === undefined ? (
        <div className="mt-3 h-9 w-14 animate-pulse rounded-lg bg-sunken motion-reduce:animate-none" />
      ) : (
        <p className="mt-3 text-[30px] font-semibold leading-9 tracking-tight tabular-nums">{value}</p>
      )}
    </div>
  );
}

// While the data is on its way the list shows loading rows, never its
// "nobody" line, which would be wrong until the answer is in.
function PeopleList({ title, items, empty, describe, loading }) {
  return (
    <Panel>
      <PanelTitle>{title}</PanelTitle>
      {loading && <RowsSkeleton rows={2} />}
      {!loading && items.length === 0 && <p className="px-5 py-4 text-sm text-muted">{empty}</p>}
      <ul>
        {items.map((leave) => (
          <li
            key={leave.id}
            className="flex items-baseline justify-between gap-4 border-b border-line px-4 py-2.5 text-sm last:border-b-0 sm:px-5"
          >
            <span className="flex min-w-0 items-baseline gap-2">
              <span className="truncate font-medium">{leave.user?.name}</span>
              {leave.department && (
                <span className="shrink-0 rounded bg-sunken px-1.5 py-px text-[11px] font-medium text-muted">{leave.department}</span>
              )}
              {leave.status === 'pending' && (
                <span className="shrink-0 rounded bg-pending-soft px-1.5 py-px text-[10px] font-semibold text-pending">Pending</span>
              )}
            </span>
            <span className="shrink-0 text-[13px] tabular-nums text-muted">{describe(leave)}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function UsageByType({ rows, className = '' }) {
  const max = Math.max(1, ...rows.map((row) => row.days));

  return (
    <Panel className={className}>
      <PanelTitle>Days used this year, by leave type</PanelTitle>
      {rows.length === 0 && <p className="px-5 py-4 text-sm text-muted">No leave has been used yet.</p>}
      <table className="w-full text-sm">
        <thead className="sr-only">
          <tr>
            <th>Leave type</th>
            <th>Days used</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.code} className="border-b border-line last:border-b-0" title={`${row.name}: ${row.days} ${dayWord(row.days)}`}>
              <td className="w-2/5 px-4 py-2.5 align-middle sm:w-1/3 sm:px-5">{row.name}</td>
              <td className="py-2.5 pr-4 align-middle sm:pr-5">
                <div className="flex items-center gap-3">
                  <div className="h-2 flex-1" aria-hidden="true">
                    <div className="h-full origin-left rounded-r bg-accent" style={{ transform: `scaleX(${row.days / max})` }} />
                  </div>
                  <span className="w-10 text-right font-medium tabular-nums">{row.days}</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

function subtitle(data, weekend = false) {
  const date = `${weekday(data.today)}, ${longDate(data.today)}.`;
  if (weekend) return `${date} It's the weekend, enjoy the day off.`;
  const away = data.awayToday.length;
  if (away === 0) return `${date} Everyone is in today.`;
  return `${date} ${away} ${away === 1 ? 'person is' : 'people are'} away today.`;
}

export default function Overview() {
  const appPath = useAppPath();
  const { user } = useAuth();
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: () => api.get('/admin/overview'),
  });
  // The same list the side column shows; it says when it is the weekend.
  const { data: team } = useTeam();

  if (isError) return <LoadError error={error} onRetry={refetch} />;

  return (
    <div className="space-y-4">
      <Reveal className="pb-2">
        <h1 className="text-[22px] sm:text-2xl">
          {greeting()}, {user.name.split(' ')[0]}
        </h1>
        {data ? (
          <p className="mt-1 text-sm text-muted">{subtitle(data, Boolean(team?.weekend))}</p>
        ) : (
          <p className="mt-2 h-4 w-64 max-w-full animate-pulse rounded bg-sunken motion-reduce:animate-none" aria-hidden="true" />
        )}
      </Reveal>
      {/* On a desktop the columns end level: the last panel of each takes up
          what is left, so no column is short of the others. */}
      <div className="grid items-start gap-4 lg:grid-cols-[264px_minmax(0,1fr)] lg:items-stretch">
        <aside className="order-last lg:order-first">
          <HomeSidebar />
        </aside>
        <div className="flex min-w-0 flex-col gap-4">
          <Reveal delay={0.04}>
            <div className="@container">
              <div className="grid grid-cols-2 gap-3 @2xl:grid-cols-4">
                <Stat index={0} ink="text-pending" label="Pending requests" value={data?.pendingCount} icon={Clock3} />
                <Stat index={1} ink="text-accent" label="Away today" value={data?.awayToday.length} icon={Palmtree} />
                <Stat index={2} ink="text-approved" label="Active employees" value={data?.employees} icon={Users} />
                <Stat
                  index={3}
                  ink="text-[#0b7ea4] dark:text-[#5cc8ec]"
                  label="Days used this month"
                  value={data?.approvedDaysThisMonth}
                  icon={CalendarCheck2}
                />
              </div>
            </div>
          </Reveal>

          {/* Wide screens: pending requests and the yearly usage on the left,
              the people and holiday lists down the right, so neither column
              leaves a gap. The second row takes up any extra height. */}
          <div className="grid flex-1 items-start gap-4 lg:grid-rows-[auto_auto_1fr] lg:items-stretch 2xl:grid-cols-[1.8fr_1fr] 2xl:grid-rows-[auto_1fr]">
            <Reveal delay={0.08} className="2xl:col-start-1 2xl:row-start-1">
              <Panel>
                <PanelTitle
                  action={
                    <Link
                      to={appPath('/admin/requests')}
                      className="text-[13px] font-medium text-accent hover:underline underline-offset-4"
                    >
                      View all
                    </Link>
                  }
                >
                  Pending requests
                </PanelTitle>
                {isPending && <RowsSkeleton />}
                {data?.pending.length === 0 && <Empty title="All caught up">New requests appear here as soon as they are sent.</Empty>}
                {data && <ReviewList items={data.pending} compact keepFinished={false} />}
              </Panel>
            </Reveal>

            <Reveal delay={0.12} className="flex flex-col gap-4 2xl:col-start-2 2xl:row-span-2 2xl:row-start-1">
              <PeopleList
                title="Away today"
                items={data?.awayToday ?? []}
                loading={isPending}
                empty="Everyone is in."
                describe={(leave) => `until ${shortRange(leave.to, leave.to)}`}
              />
              <PeopleList
                title="Away in the next 14 days"
                items={data?.nextUp ?? []}
                loading={isPending}
                empty="No leave coming up."
                describe={(leave) => shortRange(leave.from, leave.to)}
              />
              <Panel className="lg:flex-1">
                <PanelTitle>Coming holidays</PanelTitle>
                {isPending && <RowsSkeleton rows={2} />}
                {data && data.holidays.length === 0 && <p className="px-5 py-4 text-sm text-muted">No holidays are listed.</p>}
                <ul>
                  {data?.holidays.map((holiday) => (
                    <li
                      key={holiday.id}
                      className="flex items-baseline justify-between gap-4 border-b border-line px-4 py-2.5 text-sm last:border-b-0 sm:px-5"
                    >
                      <span className="min-w-0 truncate font-medium">{holiday.name}</span>
                      <span className="shrink-0 text-[13px] tabular-nums text-muted">{shortRange(holiday.date, holiday.date)}</span>
                    </li>
                  ))}
                </ul>
              </Panel>
            </Reveal>

            <Reveal delay={0.1} className="lg:flex lg:flex-col 2xl:col-start-1 2xl:row-start-2">
              {data ? (
                <UsageByType rows={data.byType} className="lg:flex-1" />
              ) : (
                <Panel className="lg:flex-1">
                  <PanelTitle>Days used this year, by leave type</PanelTitle>
                  <RowsSkeleton rows={3} />
                </Panel>
              )}
            </Reveal>
          </div>
        </div>
      </div>
    </div>
  );
}
