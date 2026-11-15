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
const roleRank = (text = '') => {
  const index = ROLE_ORDER.findIndex((word) => text.toLowerCase().includes(word));
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
// that column while the left part stays put. `shift` is how far that column
// has scrolled: the blue line still starts level with the chosen card on the
// left, so it stays joined to it and runs to the chosen person wherever they
// have scrolled to.
function Gap({ left, right, part = 'all', shift = 0 }) {
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
  // Where the line from the left meets this part, in its own scrolled space.
  const joinY = part === 'right' ? Math.min(fromY + shift, height) : fromY;
  const ys = lines ? right.items.map((_, row) => centre(row)) : [];
  const top = lines ? Math.min(joinY, ys[0]) : 0;
  const bottom = lines ? Math.max(joinY, ys[ys.length - 1]) : 0;
  const grey = 'var(--color-line)';
  const blue = 'var(--color-accent)';

  return (
    <div className="relative shrink-0" style={{ width, height }} aria-hidden="true">
      {lines && (
        <svg width={width} height={height} className="absolute inset-0">
          <g transform={`translate(${-offset} 0)`}>
            <path d={`M${SPINE} ${top} V${bottom}`} stroke={grey} strokeWidth="1.5" fill="none" />
            {ys.map((y) => (
              <path key={y} d={`M${SPINE} ${y} H${GAP}`} stroke={grey} strokeWidth="1.5" fill="none" />
            ))}
            <path d={`M${BADGE_LEFT + BADGE_W} ${fromY} H${SPINE}`} stroke={blue} strokeWidth="2" fill="none" />
            {to >= 0 && (
              <path
                d={`M${SPINE} ${joinY} V${ys[to]} H${GAP}`}
                stroke={blue}
                strokeWidth="2"
                fill="none"
                strokeLinejoin="round"
              />
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
  const [shift, setShift] = useState(0);

  if (split) {
    const before = columns.slice(0, -1);
    const last = columns[columns.length - 1];
    const parent = before[before.length - 1];
    return (
      <div ref={box} className="overflow-x-auto rounded-xl border border-line bg-surface p-4 shadow-card">
        <div className="flex w-max items-start">
          {before.map((column, index) => (
            <Fragment key={column.key}>
              <ColumnList column={column} width={width} />
              {index < before.length - 1 ? (
                <Gap left={column} right={before[index + 1]} />
              ) : (
                <Gap left={parent} right={last} part="left" />
              )}
            </Fragment>
          ))}
          <div
            onScroll={(event) => setShift(event.currentTarget.scrollTop)}
            className="max-h-[calc(100dvh-380px)] min-h-72 overflow-y-auto overscroll-contain pr-1 lg:max-h-[calc(100dvh-250px)]"
          >
            <div className="flex items-start">
              <Gap left={parent} right={last} part="right" shift={shift} />
              <ColumnList column={last} width={width} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={box}
      className="max-h-[calc(100dvh-346px)] min-h-72 overflow-auto overscroll-contain rounded-xl border border-line bg-surface p-4 shadow-card lg:max-h-[calc(100dvh-216px)]"
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
    for (const member of data.members) result[member.department] = (result[member.department] ?? 0) + 1;
    return result;
  }, [data.members]);

  const leads = useMemo(() => new Set(data.members.map((member) => member.reportsTo).filter(Boolean)), [data.members]);

  const people = useMemo(
    () =>
      data.members
        .filter((member) => member.department === department)
        .sort(
          (a, b) =>
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
            tag={member.role !== 'admin' && leads.has(member.id) ? 'Team Lead' : null}
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
          tag={depth > 0 && children.has(member.id) ? 'Team Lead' : null}
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
