import { useQuery } from '@tanstack/react-query';
import { CalendarCheck2, Clock3, Palmtree, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ReviewList } from '../../components/ReviewList';
import { HomeSidebar } from '../../components/HomeSidebar';
import { MandalaBackdrop } from '../../components/MandalaCorner';
import { Empty, LoadError, Panel, PanelTitle, Reveal, RowsSkeleton } from '../../components/ui';
import { api } from '../../lib/api';
import { dayWord, longDate, shortRange, weekday } from '../../lib/dates';

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

function PeopleList({ title, items, empty, describe }) {
  return (
    <Panel>
      <PanelTitle>{title}</PanelTitle>
      {items.length === 0 && <p className="px-5 py-4 text-sm text-muted">{empty}</p>}
      <ul>
        {items.map((leave) => (
          <li
            key={leave.id}
            className="flex items-baseline justify-between gap-4 border-b border-line px-4 py-2.5 text-sm last:border-b-0 sm:px-5"
          >
            <span className="min-w-0 truncate font-medium">{leave.user?.name}</span>
            <span className="shrink-0 text-[13px] tabular-nums text-muted">{describe(leave)}</span>
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
            <tr
              key={row.code}
              className="border-b border-line last:border-b-0"
              title={`${row.name}: ${row.days} ${dayWord(row.days)}`}
            >
              <td className="w-2/5 px-4 py-2.5 align-middle sm:w-1/3 sm:px-5">{row.name}</td>
              <td className="py-2.5 pr-4 align-middle sm:pr-5">
                <div className="flex items-center gap-3">
                  <div className="h-2 flex-1" aria-hidden="true">
                    <div
                      className="h-full origin-left rounded-r bg-accent"
                      style={{ transform: `scaleX(${row.days / max})` }}
                    />
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

function subtitle(data) {
  const date = `${weekday(data.today)}, ${longDate(data.today)}.`;
  const away = data.awayToday.length;
  if (away === 0) return `${date} Everyone is in today.`;
  return `${date} ${away} ${away === 1 ? 'person is' : 'people are'} away today.`;
}

export default function Overview() {
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: () => api.get('/admin/overview'),
  });

  if (isError) return <LoadError error={error} onRetry={refetch} />;

  return (
    <div className="space-y-4">
      <Reveal className="pb-2">
        <h1 className="text-[22px] sm:text-2xl">Overview</h1>
        <p className="mt-1 text-sm text-muted">{data ? subtitle(data) : ' '}</p>
      </Reveal>
      <div className="grid items-start gap-4 lg:grid-cols-[264px_minmax(0,1fr)]">
        <aside className="order-last lg:order-first">
          <HomeSidebar />
        </aside>
        <div className="min-w-0 space-y-4">
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
          <div className="grid items-start gap-4 2xl:grid-cols-[1.8fr_1fr] 2xl:grid-rows-[auto_1fr]">
            <Reveal delay={0.08} className="2xl:col-start-1 2xl:row-start-1">
              <Panel>
                <PanelTitle
                  action={
                    <Link
                      to="/admin/requests"
                      className="text-[13px] font-medium text-accent hover:underline underline-offset-4"
                    >
                      View all
                    </Link>
                  }
                >
                  Pending requests
                </PanelTitle>
                {isPending && <RowsSkeleton />}
                {data?.pending.length === 0 && (
                  <Empty title="All caught up">New requests appear here as soon as they are sent.</Empty>
                )}
                {data && <ReviewList items={data.pending} compact keepFinished={false} />}
              </Panel>
            </Reveal>

            <Reveal delay={0.12} className="space-y-4 2xl:col-start-2 2xl:row-span-2 2xl:row-start-1">
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
                <PanelTitle>Coming holidays</PanelTitle>
                {(data?.holidays ?? []).length === 0 && (
                  <p className="px-5 py-4 text-sm text-muted">No holidays are listed.</p>
                )}
                <ul>
                  {data?.holidays.map((holiday) => (
                    <li
                      key={holiday.id}
                      className="flex items-baseline justify-between gap-4 border-b border-line px-4 py-2.5 text-sm last:border-b-0 sm:px-5"
                    >
                      <span className="min-w-0 truncate font-medium">{holiday.name}</span>
                      <span className="shrink-0 text-[13px] tabular-nums text-muted">
                        {shortRange(holiday.date, holiday.date)}
                      </span>
                    </li>
                  ))}
                </ul>
              </Panel>
            </Reveal>

            {data && (
              <Reveal delay={0.1} className="2xl:col-start-1 2xl:row-start-2">
                <UsageByType rows={data.byType} />
              </Reveal>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
