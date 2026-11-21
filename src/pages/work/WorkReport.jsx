import { useEffect, useState } from 'react';
import { MandalaBackdrop } from '../../components/MandalaCorner';
import { SegmentedTabs } from '../../components/Tabs';
import { Empty, SelectBox } from '../../components/ui';

// The work report, for an assistant manager or manager: for each kind of work
// (Broken RSS, New Integration, Sourcing...), what came of it (Fixed, Working
// fine, Webpage issue...) as a ring, as bars and as plain numbers, for one day
// or the whole month.

const COLOURS = ['#2f5bea', '#0e9f6e', '#f2a93b', '#e5484d', '#8e4ec6', '#12a5b8', '#d6409f', '#7c8597'];
const dayName = (date) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const kindOf = (entry) => entry.category || entry.task;

// Adds up what came of the work, by name, biggest first.
function outcomesOf(entries) {
  const totals = new Map();
  for (const entry of entries) {
    for (const line of entry.breakdown ?? []) {
      const key = line.label.trim().toLowerCase();
      const was = totals.get(key);
      totals.set(key, { label: was?.label ?? line.label.trim(), count: (was?.count ?? 0) + (line.count ?? 0) });
    }
  }
  return [...totals.values()].filter((item) => item.count > 0).sort((a, b) => b.count - a.count);
}

// Grows in once it is on screen, so the ring turns and the bars fill.
function useShown() {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  return shown;
}

function Ring({ items, size = 148 }) {
  const shown = useShown();
  const total = items.reduce((sum, item) => sum + item.count, 0);
  const r = size / 2 - 14;
  const length = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-sunken)" strokeWidth="16" />
        {items.map((item, index) => {
          const part = total ? (item.count / total) * length : 0;
          const circle = (
            <circle
              key={item.label}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={COLOURS[index % COLOURS.length]}
              strokeWidth="16"
              strokeDasharray={`${shown ? part : 0} ${length}`}
              strokeDashoffset={-offset}
              style={{ transition: `stroke-dasharray 900ms cubic-bezier(.2,.7,.2,1) ${index * 90}ms` }}
            />
          );
          offset += part;
          return circle;
        })}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="text-2xl font-semibold tabular-nums">{total}</p>
          <p className="text-[11px] text-muted">counted</p>
        </div>
      </div>
    </div>
  );
}

function Bars({ items }) {
  const shown = useShown();
  const most = Math.max(1, ...items.map((item) => item.count));
  const total = items.reduce((sum, item) => sum + item.count, 0);
  return (
    <ul className="min-w-0 flex-1 space-y-2.5">
      {items.map((item, index) => (
        <li key={item.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ background: COLOURS[index % COLOURS.length] }}
                aria-hidden="true"
              />
              <span className="truncate">{item.label}</span>
            </span>
            <span className="shrink-0 tabular-nums">
              <span className="font-semibold">{item.count}</span>
              <span className="text-muted"> · {total ? Math.round((item.count / total) * 100) : 0}%</span>
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-sunken" aria-hidden="true">
            <div
              className="h-full rounded-full"
              style={{
                width: shown ? `${(item.count / most) * 100}%` : 0,
                background: COLOURS[index % COLOURS.length],
                transition: `width 800ms cubic-bezier(.2,.7,.2,1) ${index * 70}ms`,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Card({ title, entries, big = false }) {
  const items = outcomesOf(entries);
  const target = entries.reduce((sum, entry) => sum + (entry.target ?? 0), 0);
  const done = entries.reduce((sum, entry) => sum + (entry.achieved ?? 0), 0);
  const people = new Set(entries.map((entry) => entry.user)).size;
  const pieces = [...new Set(entries.map((entry) => entry.task))].filter((task) => task !== title);
  return (
    <section
      className={`relative isolate overflow-hidden rounded-xl border border-line bg-surface p-4 shadow-card sm:p-5 ${big ? '' : ''}`}
    >
      <MandalaBackdrop className="-top-24 -right-20 h-52 w-52 text-[#a8650b]" />
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-base font-semibold">{title}</h3>
          {pieces.length > 0 && <p className="mt-0.5 text-xs text-muted">{pieces.join(' · ')}</p>}
        </div>
        <p className="text-sm text-muted tabular-nums">
          Done <span className="font-semibold text-ink">{done}</span> of {target} · {people} {people === 1 ? 'person' : 'people'}
        </p>
      </div>
      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">Nothing counted yet (Fixed, Working fine...).</p>
      ) : (
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
          <Ring items={items} size={big ? 168 : 140} />
          <Bars items={items} />
        </div>
      )}
    </section>
  );
}

export function WorkReport({ sheet }) {
  const workingDays = sheet.days.filter((day) => !day.sunday);
  const inMonth = sheet.today >= sheet.days[0].date && sheet.today <= sheet.days.at(-1).date;
  const [period, setPeriod] = useState('month');
  const [date, setDate] = useState(inMonth ? sheet.today : (workingDays.at(-1)?.date ?? sheet.days[0].date));
  const entries = sheet.entries.filter((entry) => (period === 'day' ? entry.date === date : true));
  const kinds = [...new Set(entries.map(kindOf))].sort((a, b) => a.localeCompare(b));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedTabs
          label="Period"
          tabs={[
            ['month', 'This month'],
            ['day', 'One day'],
          ]}
          value={period}
          onChange={setPeriod}
        />
        {period === 'day' && (
          <SelectBox aria-label="Day" value={date} onChange={(event) => setDate(event.target.value)}>
            {workingDays.map((day) => (
              <option key={day.date} value={day.date}>
                {dayName(day.date)}
                {day.date === sheet.today ? ' (today)' : ''}
              </option>
            ))}
          </SelectBox>
        )}
      </div>
      {entries.length === 0 ? (
        <Empty title="No work given yet">{period === 'day' ? 'Nobody has work on this day.' : 'Nobody has work this month yet.'}</Empty>
      ) : (
        <>
          <Card title="All work" entries={entries} big />
          <div className="grid gap-4 lg:grid-cols-2">
            {kinds.map((kind) => (
              <Card key={kind} title={kind} entries={entries.filter((entry) => kindOf(entry) === kind)} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
