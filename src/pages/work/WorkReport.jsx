import { useEffect, useState } from 'react';
import { BarChart3, Download, PieChart } from 'lucide-react';
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
export function outcomesOf(entries) {
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

function Bars({ items, plain = false }) {
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
          {!plain && (
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
          )}
        </li>
      ))}
    </ul>
  );
}

const STYLE_KEY = 'lt-work-chart';
const savedStyle = () => {
  try {
    return localStorage.getItem(STYLE_KEY) === 'bars' ? 'bars' : 'ring';
  } catch {
    return 'ring';
  }
};

// The chart as a PNG picture, the way it is shown (a circle or bars), with its
// title, to put in a mail or a deck.
const esc = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const FONT = "Inter, 'Segoe UI', Arial, sans-serif";

function chartSvg({ title, subtitle, items, style }) {
  const width = 760;
  const total = items.reduce((sum, item) => sum + item.count, 0);
  const most = Math.max(1, ...items.map((item) => item.count));
  const pct = (count) => (total ? Math.round((count / total) * 100) : 0);
  const top = subtitle ? 96 : 76;
  const parts = [];
  let height;
  if (style === 'bars') {
    items.forEach((item, index) => {
      const y = top + index * 52;
      const colour = COLOURS[index % COLOURS.length];
      parts.push(
        `<rect x="32" y="${y + 4}" width="10" height="10" rx="2" fill="${colour}"/>`,
        `<text x="50" y="${y + 14}" font-size="15" fill="#12141a">${esc(item.label)}</text>`,
        `<text x="${width - 32}" y="${y + 14}" font-size="15" text-anchor="end" fill="#12141a"><tspan font-weight="600">${item.count}</tspan><tspan fill="#626979"> · ${pct(item.count)}%</tspan></text>`,
        `<rect x="32" y="${y + 24}" width="${width - 64}" height="10" rx="5" fill="#eef0f3"/>`,
        `<rect x="32" y="${y + 24}" width="${Math.max(4, ((width - 64) * item.count) / most)}" height="10" rx="5" fill="${colour}"/>`,
      );
    });
    height = top + items.length * 52 + 40;
  } else {
    const r = 78;
    const cx = 32 + r + 16;
    const cy = top + r + 16;
    const length = 2 * Math.PI * r;
    let offset = 0;
    parts.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#eef0f3" stroke-width="26"/>`);
    items.forEach((item, index) => {
      const part = total ? (item.count / total) * length : 0;
      parts.push(
        `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${COLOURS[index % COLOURS.length]}" stroke-width="26" stroke-dasharray="${part} ${length}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${cx} ${cy})"/>`,
      );
      offset += part;
    });
    parts.push(
      `<text x="${cx}" y="${cy + 6}" font-size="30" font-weight="700" text-anchor="middle" fill="#12141a">${total}</text>`,
      `<text x="${cx}" y="${cy + 26}" font-size="12" text-anchor="middle" fill="#626979">counted</text>`,
    );
    const left = cx + r + 56;
    const rowsTop = cy - (items.length * 34) / 2 + 6;
    items.forEach((item, index) => {
      const y = rowsTop + index * 34;
      parts.push(
        `<rect x="${left}" y="${y}" width="12" height="12" rx="3" fill="${COLOURS[index % COLOURS.length]}"/>`,
        `<text x="${left + 22}" y="${y + 11}" font-size="15" fill="#12141a">${esc(item.label)}</text>`,
        `<text x="${width - 32}" y="${y + 11}" font-size="15" text-anchor="end" fill="#12141a"><tspan font-weight="600">${item.count}</tspan><tspan fill="#626979"> · ${pct(item.count)}%</tspan></text>`,
      );
    });
    height = Math.max(cy + r + 48, rowsTop + items.length * 34 + 32);
  }
  return {
    width,
    height,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${FONT}">
<rect width="100%" height="100%" fill="#ffffff"/>
<text x="32" y="48" font-size="22" font-weight="700" fill="#12141a">${esc(title)}</text>
${subtitle ? `<text x="32" y="74" font-size="14" fill="#626979">${esc(subtitle)}</text>` : ''}
${parts.join('\n')}
</svg>`,
  };
}

export async function downloadChart({ title, subtitle, items, style }) {
  const { svg, width, height } = chartSvg({ title, subtitle, items, style });
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
      image.src = url;
    });
    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const context = canvas.getContext('2d');
    context.scale(scale, scale);
    context.drawImage(image, 0, 0);
    const png = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    const link = document.createElement('a');
    link.href = URL.createObjectURL(png);
    link.download = `${[title, subtitle]
      .filter(Boolean)
      .join(' ')
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase()}.png`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function ChartSwitch({ value, onChange, picture }) {
  return (
    <div className="inline-flex shrink-0 items-center gap-1">
      <div role="group" aria-label="Chart" className="inline-flex shrink-0 rounded-lg border border-line bg-surface p-0.5">
        {[
          ['ring', 'Circle', PieChart],
          ['bars', 'Bars', BarChart3],
        ].map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            aria-pressed={value === key}
            title={label}
            onClick={() => onChange(key)}
            className={`inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium ${
              value === key ? 'bg-accent-soft text-accent' : 'text-muted hover:text-ink'
            }`}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>
      {picture && (
        <button
          type="button"
          title="Download the chart as a picture (PNG)"
          aria-label="Download the chart"
          onClick={() => downloadChart({ ...picture, style: value })}
          className="inline-flex h-8 items-center gap-1 rounded-lg border border-line bg-surface px-2 text-xs font-medium text-muted hover:text-ink"
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          PNG
        </button>
      )}
    </div>
  );
}

export function useChartStyle() {
  const [style, setStyle] = useState(savedStyle);
  const change = (next) => {
    setStyle(next);
    try {
      localStorage.setItem(STYLE_KEY, next);
    } catch {
      // Only a convenience: the chart still shows.
    }
  };
  return [style, change];
}

// What came of the work as a ring with its key beside it, or as bars.
export function OutcomeChart({ items, style, size = 140, stacked = false }) {
  if (style === 'bars') return <Bars key="bars" items={items} />;
  return (
    <div className={`flex flex-col items-center gap-5 ${stacked ? '[&>ul]:w-full' : 'sm:flex-row sm:items-center'}`}>
      <Ring key="ring" items={items} size={size} />
      <Bars items={items} plain />
    </div>
  );
}

function Card({ title, entries, when, big = false }) {
  const [style, setStyle] = useChartStyle();
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
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted tabular-nums">
            Done <span className="font-semibold text-ink">{done}</span> of {target} · {people} {people === 1 ? 'person' : 'people'}
          </p>
          {items.length > 0 && (
            <ChartSwitch value={style} onChange={setStyle} picture={{ title: `${title}: what came of it`, subtitle: when, items }} />
          )}
        </div>
      </div>
      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">Nothing counted yet (Fixed, Working fine...).</p>
      ) : (
        <OutcomeChart items={items} style={style} size={big ? 168 : 140} />
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
  const when =
    period === 'day'
      ? dayName(date)
      : new Date(`${sheet.month}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });

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
          <Card title="All work" entries={entries} when={when} big />
          <div className="grid gap-4 lg:grid-cols-2">
            {kinds.map((kind) => (
              <Card key={kind} title={kind} entries={entries.filter((entry) => kindOf(entry) === kind)} when={when} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
