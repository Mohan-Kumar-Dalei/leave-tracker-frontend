import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Avatar } from './ProfilePhoto';

// Two org views in the style of Zoho People, laid out left to right in
// columns. A count sits beside each card that has people under it; the line
// from the chosen card runs to the next column, and the way to the chosen
// person is drawn in blue. Choosing a card again opens the person's profile.
//
//   DepartmentTree: departments, then who is in the chosen one and their role.
//   EmployeeTree:   who reports to whom; each column is the team of the person
//                   chosen in the column before it.

const CARD = 52; // card height
const ROW = 68; // card plus the space under it
const COLUMN = 264; // widest a column gets
const MIN_COLUMN = 168; // narrowest before the box scrolls sideways
const GAP = 84;
const BADGE_LEFT = 10;
const BADGE_W = 36;
const SPINE = GAP - 18;

const centre = (row) => row * ROW + CARD / 2;
const heightOf = (rows) => Math.max(rows, 1) * ROW - (ROW - CARD);

const initialsOf = (name) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');

// Senior roles first, the way the team reads its own chart.
const ROLE_ORDER = ['director', 'admin', 'manager', 'team lead', 'lead', 'senior', 'technical', 'associate', 'analyst'];
// Whether someone belongs under a department: their own, or one they manage.
export const inDepartment = (member, department) =>
  member.department === department || (member.manages ?? []).includes(department);

// HR first, then a manager ahead of an assistant manager, then the rest.
export const roleRank = (text = '') => {
  const lower = text.toLowerCase().trim();
  if (lower === 'hr' || lower.startsWith('hr ') || lower.includes('human resource')) return -1;
  const index = ROLE_ORDER.findIndex((word) => lower.includes(word));
  if (ROLE_ORDER[index] === 'manager' && lower.includes('assistant')) return index + 0.5;
  return index === -1 ? ROLE_ORDER.length : index;
};

function PersonCard({ member, on, tag, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ height: CARD }}
      className={`flex w-full items-center gap-3 rounded-xl border px-3 text-left transition-colors ${
        on ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:bg-bg'
      }`}
    >
      <Avatar user={member} size={36} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{member.name}</span>
        <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted">
          <span className="truncate">{member.designation}</span>
          {tag && (
            <span className="shrink-0 rounded bg-accent-soft px-1.5 py-px text-[10px] font-semibold text-accent">
              {tag}
            </span>
          )}
          {member.workFromHome && (
            <span className="shrink-0 rounded bg-sunken px-1.5 py-px text-[10px] font-semibold">WFH</span>
          )}
        </span>
      </span>
    </button>
  );
}

function DepartmentCard({ name, on, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ height: CARD }}
      className={`flex w-full items-center gap-3 rounded-xl border px-3 text-left transition-colors ${
        on ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:bg-bg'
      }`}
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-sunken text-xs font-semibold text-muted">
        {initialsOf(name)}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{name}</span>
    </button>
  );
}

// The space between two columns: the counts beside the cards on its left,
// and the lines from the chosen card to the cards on its right. It can be
// drawn in two parts: `left` (counts and the line out of the chosen card) and
// `right` (the line down the next column), so the right part can scroll with
// that column while the left part stays put. In the right part the blue line
// runs from the top of the column to the chosen person; the line from the
// chosen card on the left up to that top is drawn separately and stays still
// (see Columns), so nothing has to follow the scroll and the two always meet.
function Gap({ left, right, part = 'all', joinFrom = 0 }) {
  const rows =
    part === 'left'
      ? left.items.length
      : part === 'right'
        ? (right?.items.length ?? 0)
        : Math.max(left.items.length, right?.items.length ?? 0);
  const height = heightOf(rows);
  const offset = part === 'right' ? SPINE - 1 : 0;
  const width = part === 'left' ? SPINE - 1 : part === 'right' ? GAP - SPINE + 1 : GAP;
  const from = left.items.findIndex((item) => item.id === left.chosen);
  const to = right ? right.items.findIndex((item) => item.id === right.chosen) : -1;
  const lines = right && from >= 0 && right.items.length > 0;
  const fromY = centre(from);
  // Where the blue line enters: level with the chosen card, or for a column
  // that scrolls on its own, at its top.
  // When the chosen person sits higher than the chosen card, the line starts
  // at the card's level instead (`joinFrom`), so it never runs past them.
  const joinY = part === 'right' ? joinFrom : fromY;
  const ys = lines ? right.items.map((_, row) => centre(row)) : [];
  const top = lines ? Math.min(joinY, ys[0]) : 0;
  const bottom = lines ? Math.max(joinY, ys[ys.length - 1]) : 0;
  const grey = 'var(--color-line)';
  const blue = 'var(--color-accent)';

  return (
    <div className="relative shrink-0" style={{ width, height }} aria-hidden="true">
      {/* A short grey tie from each other card to its count. */}
      {part !== 'right' && (
        <svg width={BADGE_LEFT} height={height} className="absolute left-0 top-0">
          {left.items.map((item, row) =>
            item.count > 0 && !(lines && item.id === left.chosen) ? (
              <path key={item.id} d={`M0 ${centre(row)} H${BADGE_LEFT}`} stroke={grey} strokeWidth="1.5" fill="none" />
            ) : null,
          )}
        </svg>
      )}
      {lines && (
        <svg width={width} height={height} className="absolute inset-0">
          <g transform={`translate(${-offset} 0)`}>
            <path d={`M${SPINE} ${top} V${bottom}`} stroke={grey} strokeWidth="1.5" fill="none" />
            {ys.map((y) => (
              <path key={y} d={`M${SPINE} ${y} H${GAP}`} stroke={grey} strokeWidth="1.5" fill="none" />
            ))}
            {/* Card to its count, and count on to the spine, so the chosen
                card is joined all the way. */}
            <path
              key={`out-${fromY}`}
              d={`M0 ${fromY} H${SPINE}`}
              stroke={blue}
              strokeWidth="2"
              fill="none"
              pathLength="1"
              className="tree-draw"
            />
            {to >= 0 && (
              <>
                <path
                  key={`in-${joinY}-${ys[to]}`}
                  d={`M${SPINE} ${joinY} V${ys[to]} H${GAP}`}
                  stroke={blue}
                  strokeWidth="2"
                  fill="none"
                  strokeLinejoin="round"
                  pathLength="1"
                  className="tree-draw tree-draw-late"
                />
                {/* A small light travelling along the chosen line. */}
                <path
                  key={`flow-${joinY}-${ys[to]}`}
                  d={`M${SPINE} ${joinY} V${ys[to]} H${GAP}`}
                  stroke="white"
                  strokeOpacity="0.85"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                  pathLength="1"
                  className="tree-flow"
                />
              </>
            )}
          </g>
        </svg>
      )}
      {part !== 'right' &&
        left.items.map((item, row) =>
          item.count > 0 ? (
            <span
              key={item.id}
              style={{ top: centre(row), left: BADGE_LEFT, minWidth: BADGE_W }}
              className={`absolute grid h-6 -translate-y-1/2 place-items-center rounded-md px-1.5 text-xs font-semibold tabular-nums ${
                item.id === left.chosen && lines
                  ? 'bg-accent text-on-accent'
                  : 'border border-line bg-surface text-muted'
              }`}
            >
              {item.count}
            </span>
          ) : null,
        )}
    </div>
  );
}

function ColumnList({ column, width }) {
  return (
    <ul className="shrink-0" style={{ width }} aria-label={column.label}>
      {column.items.map((item) => (
        <li key={item.id} style={{ height: CARD, marginBottom: ROW - CARD }}>
          {item.card}
        </li>
      ))}
    </ul>
  );
}

// How wide each column can be so they all fit the box: as wide as COLUMN on a
// big screen, narrower on a laptop, and only below MIN_COLUMN (on phones) does
// the box scroll sideways.
function useColumnWidth(count, gaps, extra = 0) {
  const box = useRef(null);
  const [width, setWidth] = useState(COLUMN);
  useEffect(() => {
    const element = box.current;
    if (!element) return undefined;
    const fit = () => {
      const room = element.clientWidth - 32 - gaps * GAP - extra; // 32: the box padding
      setWidth(Math.max(MIN_COLUMN, Math.min(COLUMN, Math.floor(room / Math.max(count, 1)))));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    return () => observer.disconnect();
  }, [count, gaps, extra]);
  return [box, width];
}

// Columns of cards, left to right, with the gaps between them. The box fits
// the screen under the page heading and tabs, so the page itself stays still
// (phones also leave room for the bottom bar). With `scrollLast`, only the
// last column scrolls, with its line, and the columns before it stay put;
// otherwise the whole box scrolls.
function Columns({ columns, scrollLast = false }) {
  const split = scrollLast && columns.length > 1;
  const trailing = !split && columns[columns.length - 1]?.items.some((item) => item.count > 0) ? 1 : 0;
  const [box, width] = useColumnWidth(columns.length, columns.length - 1 + trailing, split ? 14 : 0);
  if (split) {
    const before = columns.slice(0, -1);
    const last = columns[columns.length - 1];
    const parent = before[before.length - 1];
    const fromRow = parent.items.findIndex((item) => item.id === parent.chosen);
    const toRow = last.items.findIndex((item) => item.id === last.chosen);
    const fromY = centre(fromRow);
    // The blue line in the scrolling column runs from its top down to the
    // chosen person. A thin cover sticks to the top of the column above the
    // department's row and hides the part of that line which would show above
    // the department. Once the chosen person scrolls up past the department
    // row, the cover is pushed up with them, so the line runs from the
    // department up to them. CSS alone does this, so nothing lags the scroll.
    // The chosen person higher than the department (e.g. the manager at the
    // top of a department lower in the list): the line goes from the
    // department's level straight up to them, with no cover or still part.
    const above = fromRow >= 0 && toRow >= 0 && centre(toRow) < fromY;
    const covered = fromRow >= 0 && toRow >= 0 && !above;
    return (
      <div ref={box} className="overflow-x-auto rounded-xl border border-line bg-surface p-4 shadow-card">
        <div className="flex w-max items-start">
          {before.map((column, index) => (
            <Fragment key={column.key}>
              <ColumnList column={column} width={width} />
              {index < before.length - 1 && <Gap left={column} right={before[index + 1]} />}
            </Fragment>
          ))}
          <div className="relative flex items-start">
            <Gap left={parent} right={last} part="left" />
            <div className="max-h-[calc(100dvh-425px)] min-h-72 overflow-y-auto overscroll-contain pr-1 lg:max-h-[calc(100dvh-307px)]">
              <div className="relative flex items-start">
                <Gap left={parent} right={last} part="right" joinFrom={above ? fromY : 0} />
                <ColumnList column={last} width={width} />
                {covered && (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute left-0 top-0 w-[3px]"
                    style={{ height: Math.max(centre(toRow) - 2, 0) }}
                  >
                    <div className="sticky top-0 z-20 bg-surface" style={{ height: fromY - 1 }}>
                      <span className="absolute left-[0.25px] top-0 h-full w-[1.5px] bg-line" />
                    </div>
                  </div>
                )}
              </div>
            </div>
            {/* The still part: from the department up to the top of the
                column, for when the chosen person has scrolled up past it.
                It sits over the column's lines but under the cover, which
                hides it while the chosen person is lower down. */}
            {covered && (
              <svg
                aria-hidden="true"
                width={SPINE + 2}
                height={fromY + 2}
                className="pointer-events-none absolute left-0 top-0 z-10"
              >
                <path d={`M${SPINE} ${fromY} V0`} stroke="var(--color-accent)" strokeWidth="2" fill="none" />
              </svg>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={box}
      className="max-h-[calc(100dvh-391px)] min-h-72 overflow-auto overscroll-contain rounded-xl border border-line bg-surface p-4 shadow-card lg:max-h-[calc(100dvh-273px)]"
    >
      <div className="flex w-max items-start">
        {columns.map((column, index) => (
          <Fragment key={column.key}>
            <ColumnList column={column} width={width} />
            {(index < columns.length - 1 || column.items.some((item) => item.count > 0)) && (
              <Gap left={column} right={columns[index + 1]} />
            )}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

// Departments, then everyone in the chosen one, senior roles first.
export function DepartmentTree({ data, department, onDepartment, onOpen }) {
  const [chosen, setChosen] = useState(null);

  const counts = useMemo(() => {
    const result = {};
    for (const member of data.members) {
      for (const name of new Set([member.department, ...(member.manages ?? [])])) result[name] = (result[name] ?? 0) + 1;
    }
    return result;
  }, [data.members]);

  const leads = useMemo(() => new Set(data.members.map((member) => member.reportsTo).filter(Boolean)), [data.members]);

  const people = useMemo(
    () =>
      data.members
        .filter((member) => inDepartment(member, department))
        .sort(
          (a, b) =>
            Number(b.role === 'owner') - Number(a.role === 'owner') ||
            Number((b.manages ?? []).includes(department)) - Number((a.manages ?? []).includes(department)) ||
            Number(b.role === 'admin') - Number(a.role === 'admin') ||
            Number(leads.has(b.id)) - Number(leads.has(a.id)) ||
            roleRank(a.designation) - roleRank(b.designation) ||
            a.name.localeCompare(b.name),
        ),
    [data.members, department, leads],
  );

  const columns = [
    {
      key: 'departments',
      label: 'Departments',
      chosen: department,
      items: data.departments.map((name) => ({
        id: name,
        count: counts[name] ?? 0,
        card: (
          <DepartmentCard
            name={name}
            on={name === department}
            onClick={() => {
              setChosen(null);
              onDepartment(name);
            }}
          />
        ),
      })),
    },
    {
      key: 'people',
      label: `People in ${department}`,
      chosen,
      items: people.map((member) => ({
        id: member.id,
        count: 0,
        card: (
          <PersonCard
            member={member}
            on={member.id === chosen}
            tag={member.role === 'employee' && (leads.has(member.id) || member.teamLead) ? 'Team Lead' : null}
            onClick={() => (member.id === chosen ? onOpen(member) : setChosen(member.id))}
          />
        ),
      })),
    },
  ];

  return <Columns columns={columns} scrollLast />;
}

// Who reports to whom. The first column is the people nobody above them; each
// next column is the team of the person chosen before it. The count beside a
// card is everyone under that person, at every level.
export function EmployeeTree({ data, onOpen }) {
  const { children, roots, under } = useMemo(() => {
    const ids = new Set(data.members.map((member) => member.id));
    const kids = new Map();
    const tops = [];
    for (const member of data.members) {
      const parent = member.reportsTo && ids.has(member.reportsTo) ? member.reportsTo : null;
      if (!parent) tops.push(member);
      else {
        if (!kids.has(parent)) kids.set(parent, []);
        kids.get(parent).push(member);
      }
    }
    const order = (a, b) =>
      Number(b.role === 'owner') - Number(a.role === 'owner') ||
      Number((b.manages ?? []).length > 0) - Number((a.manages ?? []).length > 0) ||
      Number(b.role === 'admin') - Number(a.role === 'admin') ||
      Number(kids.has(b.id)) - Number(kids.has(a.id)) ||
      roleRank(a.designation) - roleRank(b.designation) ||
      a.name.localeCompare(b.name);
    tops.sort(order);
    for (const list of kids.values()) list.sort(order);

    const total = new Map();
    const count = (id, seen = new Set()) => {
      if (total.has(id)) return total.get(id);
      if (seen.has(id)) return 0;
      seen.add(id);
      const sum = (kids.get(id) ?? []).reduce((acc, kid) => acc + 1 + count(kid.id, seen), 0);
      total.set(id, sum);
      return sum;
    };
    for (const member of data.members) count(member.id);
    return { children: kids, roots: tops, under: total };
  }, [data.members]);

  // The chosen card in each column; starts with the first person at the top open.
  const [path, setPath] = useState(() => (roots[0] && children.has(roots[0].id) ? [roots[0].id] : []));

  const byId = useMemo(() => new Map(data.members.map((member) => [member.id, member])), [data.members]);
  const columnLists = [roots];
  for (const id of path) {
    const kids = children.get(id);
    if (!kids?.length) break;
    columnLists.push(kids);
  }

  const columns = columnLists.map((list, depth) => ({
    key: depth === 0 ? 'top' : path[depth - 1],
    label: depth === 0 ? 'Top of the tree' : `${byId.get(path[depth - 1])?.name}'s team`,
    chosen: path[depth] ?? null,
    items: list.map((member) => ({
      id: member.id,
      count: under.get(member.id) ?? 0,
      card: (
        <PersonCard
          member={member}
          on={path[depth] === member.id}
          tag={depth > 0 && member.role === 'employee' && (children.has(member.id) || member.teamLead) ? 'Team Lead' : null}
          onClick={() => {
            if (path[depth] === member.id && path.length === depth + 1) onOpen(member);
            else setPath([...path.slice(0, depth), member.id]);
          }}
        />
      ),
    })),
  }));

  return <Columns columns={columns} />;
}
