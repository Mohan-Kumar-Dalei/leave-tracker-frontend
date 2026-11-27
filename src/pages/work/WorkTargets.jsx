import { useState } from 'react';
import { Download, UsersRound, CalendarDays } from 'lucide-react';
import { DEPTH_X, DEPTH_Y, ShapesChart, box, savePng, shapesMarkup } from './Bars3D';
import { SelectBox } from '../../components/ui';

// Target and done, by work type: for everyone a team lead set a target for
// (Broken RSS, say), how much they were given, how much they did and the
// percentage, person by person or day by day, for one day or the month. Each
// chart downloads as a PNG picture.

const kindOf = (entry) => entry.category || entry.task;
const percent = (done, target) => (target > 0 ? Math.round((done / target) * 100) : null);

// The colour of a bar by how much of its target was done.
const BANDS = [
  [100, '#0e9f6e', '100% or more'],
  [75, '#2f5bea', '75 to 99%'],
  [50, '#f2a93b', '50 to 74%'],
  [0, '#e5484d', 'Under 50%'],
];
const colourFor = (pct) => (pct === null ? '#c3c8d2' : BANDS.find(([floor]) => pct >= floor)[1]);

// The shapes of the chart, `width` wide: lying bars for people, standing
// columns for days (in 3D). The bar is what was done; the dark line is the
// target.
function targetShapes({ rows, width, vertical, top = 0 }) {
  const most = Math.max(1, ...rows.map((row) => Math.max(row.target, row.done)));
  const shapes = [];
  if (!vertical) {
    const room = width;
    rows.forEach((row, index) => {
      const y = top + 14 + index * 58;
      const at = (value) => (room * value) / most;
      shapes.push(
        { kind: 'text', x: 0, y: y + 14, text: row.label, tone: 'ink', size: 13, weight: 600 },
        {
          kind: 'text',
          x: width,
          y: y + 14,
          text: `${row.done} / ${row.target}`,
          tone: 'ink',
          size: 13,
          anchor: 'end',
          after: row.pct === null ? '' : ` · ${row.pct}%`,
        },
        { kind: 'rect', x: 0, y: y + 26, w: Math.max(3, at(row.target)), h: 14, fill: 'track', r: 3 },
      );
      if (row.done > 0)
        shapes.push({ kind: 'rect', x: 0, y: y + 26, w: Math.max(3, at(row.done)), h: 14, fill: colourFor(row.pct), r: 3, bar: true });
      if (row.target > 0)
        shapes.push({ kind: 'line', x1: at(row.target), y1: y + 21, x2: at(row.target), y2: y + 45, tone: 'ink', width: 2 });
    });
    return { shapes, height: top + 14 + rows.length * 58 + 4, floor: 0 };
  }
  const chart = 180;
  const slot = width / Math.max(1, rows.length);
  const column = Math.max(6, Math.min(34, slot * 0.55));
  const floor = top + 40 + chart;
  shapes.push({ kind: 'line', x1: 0, y1: floor + 0.5, x2: width, y2: floor + 0.5 });
  rows.forEach((row, index) => {
    const x = index * slot + (slot - column - DEPTH_X) / 2;
    const middle = x + (column + DEPTH_X) / 2;
    const done = row.done > 0 ? Math.max(3, (chart * row.done) / most) : 0;
    const target = (chart * row.target) / most;
    if (done) shapes.push(...box(x, floor - done, column, done, colourFor(row.pct)));
    if (row.target > 0) {
      shapes.push({ kind: 'line', x1: x - 3, y1: floor - target, x2: x + column + DEPTH_X + 2, y2: floor - target, tone: 'ink', width: 2 });
    }
    if (row.pct !== null && slot >= 20) {
      shapes.push({
        kind: 'text',
        x: middle,
        y: floor - Math.max(done + DEPTH_Y, target) - 8,
        text: `${row.pct}%`,
        tone: 'muted',
        size: slot >= 34 ? 11 : 9,
        anchor: 'middle',
      });
    }
    if (slot >= 14 || index % 2 === 0)
      shapes.push({ kind: 'text', x: middle, y: floor + 16, text: row.label, tone: 'muted', size: 11, anchor: 'middle' });
  });
  return { shapes, height: floor + 26, floor };
}

// The chart as a PNG: a title, the totals, the key, then the chart.
function download({ title, subtitle, totals, rows, vertical }) {
  const width = 760;
  const inner = width - 64 - DEPTH_X;
  const top = 128;
  const drawn = targetShapes({ rows, width: inner, vertical, top: DEPTH_Y });
  const height = top + drawn.height + 28;
  const esc = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const key = [...BANDS.map(([, colour, label]) => ({ colour, label })), { colour: null, label: 'Target' }];
  let x = 32;
  const keyMarkup = key
    .map(({ colour, label }) => {
      const mark = colour
        ? `<rect x="${x}" y="98" width="10" height="10" rx="2" fill="${colour}"/>`
        : `<line x1="${x}" y1="103" x2="${x + 12}" y2="103" stroke="#12141a" stroke-width="2"/>`;
      const out = `${mark}<text x="${x + 16}" y="107" font-size="12" fill="#626979">${esc(label)}</text>`;
      x += 26 + label.length * 6.4;
      return out;
    })
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="Inter, 'Segoe UI', Arial, sans-serif">
<rect width="100%" height="100%" fill="#ffffff"/>
<text x="32" y="46" font-size="22" font-weight="700" fill="#12141a">${esc(title)}</text>
<text x="32" y="72" font-size="14" fill="#626979">${esc(subtitle)} · ${esc(totals)}</text>
${keyMarkup}
<g transform="translate(32 ${top})">${shapesMarkup(drawn.shapes)}</g>
</svg>`;
  return savePng(svg, width, height, `${title} ${subtitle} ${vertical ? 'by day' : 'by person'}`);
}

export function TargetReport({ sheet, period, date, when }) {
  const kinds = [...new Set(sheet.entries.map(kindOf))].sort((a, b) => a.localeCompare(b));
  const [kind, setKind] = useState('all');
  const [view, setView] = useState('people');
  const shownKind = kind === 'all' || kinds.includes(kind) ? kind : 'all';
  const byDays = period === 'month' && view === 'days';

  // Work with a target, of this kind, on the day or the month up to today.
  const given = sheet.entries.filter(
    (entry) =>
      (entry.target ?? 0) > 0 &&
      (shownKind === 'all' || kindOf(entry) === shownKind) &&
      (period === 'day' ? entry.date === date : entry.date <= sheet.today),
  );
  const names = new Map(sheet.people.map((person) => [person.id, person.name]));
  const add = (map, key, label, entry) => {
    const row = map.get(key) ?? { label, target: 0, done: 0 };
    row.target += entry.target ?? 0;
    row.done += entry.achieved ?? 0;
    map.set(key, row);
  };
  const people = new Map();
  const days = new Map();
  for (const entry of given) {
    add(people, entry.user, names.get(entry.user) ?? 'Someone', entry);
    add(days, entry.date, String(Number(entry.date.slice(8))), entry);
  }
  const finish = (row) => ({ ...row, pct: percent(row.done, row.target) });
  const rows = byDays
    ? [...days.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, row]) => finish(row))
    : [...people.values()].map(finish).sort((a, b) => b.target - a.target || a.label.localeCompare(b.label));
  const target = given.reduce((sum, entry) => sum + (entry.target ?? 0), 0);
  const done = given.reduce((sum, entry) => sum + (entry.achieved ?? 0), 0);
  const pct = percent(done, target);
  const title = `${shownKind === 'all' ? 'All work' : shownKind}: target and done`;
  const totals = `${people.size} ${people.size === 1 ? 'person' : 'people'} · target ${target} · done ${done}${pct === null ? '' : ` · ${pct}%`}`;

  return (
    <section className="relative overflow-hidden rounded-xl border border-line bg-surface p-4 shadow-card sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold">Target and done</h3>
          <p className="mt-0.5 text-xs text-muted">Everyone given a target, {when}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SelectBox aria-label="Work type" value={shownKind} onChange={(event) => setKind(event.target.value)}>
            <option value="all">All work</option>
            {kinds.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </SelectBox>
          {period === 'month' && (
            <div role="group" aria-label="Show by" className="inline-flex rounded-lg border border-line bg-surface p-0.5">
              {[
                ['people', 'People', UsersRound],
                ['days', 'Days', CalendarDays],
              ].map(([key, label, Icon]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={view === key}
                  onClick={() => setView(key)}
                  className={`inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-xs font-medium ${
                    view === key ? 'bg-accent-soft text-accent' : 'text-muted hover:text-ink'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>
          )}
          {rows.length > 0 && (
            <button
              type="button"
              aria-label="Download the chart"
              title="Download the chart as a picture (PNG)"
              onClick={() => download({ title, subtitle: when, totals, rows, vertical: byDays })}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-line bg-surface px-2 text-xs font-medium text-muted hover:text-ink"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              PNG
            </button>
          )}
        </div>
      </div>

      <dl className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ['People given a target', people.size, 'text-ink'],
          ['Target', target, 'text-ink'],
          ['Done', done, 'text-ink'],
          [
            'Done %',
            pct === null ? '—' : `${pct}%`,
            pct === null
              ? 'text-muted'
              : pct >= 100
                ? 'text-approved'
                : pct >= 75
                  ? 'text-accent'
                  : pct >= 50
                    ? 'text-pending'
                    : 'text-rejected',
          ],
        ].map(([label, value, colour]) => (
          <div key={label} className="rounded-lg bg-sunken px-3 py-2.5">
            <dt className="text-xs text-muted">{label}</dt>
            <dd className={`mt-0.5 text-xl font-semibold tabular-nums ${colour}`}>{value}</dd>
          </div>
        ))}
      </dl>

      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">No targets set {period === 'day' ? 'for this day' : 'this month'} yet.</p>
      ) : (
        <>
          <ShapesChart
            key={`${shownKind}|${byDays}|${period}|${date}`}
            vertical={byDays}
            label={`${title}, ${byDays ? 'by day' : 'by person'}`}
            build={(width) => targetShapes({ rows, width, vertical: byDays, top: DEPTH_Y })}
          />
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-label="Key">
            {BANDS.map(([, colour, label]) => (
              <li key={label} className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: colour }} aria-hidden="true" />
                {label}
              </li>
            ))}
            <li className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-3 rounded bg-ink" aria-hidden="true" />
              Target
            </li>
          </ul>
        </>
      )}
    </section>
  );
}
