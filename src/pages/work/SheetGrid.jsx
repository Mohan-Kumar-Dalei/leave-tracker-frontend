import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageSquarePlus, Trash2 } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../lib/api';
import { useToast } from '../../lib/toast';

// The team sheet, drawn the way the team's Google Sheet looks: column letters
// and row numbers, the yellow date row and orange weekday row frozen at the
// top, the label and Target columns frozen on the left, the team's totals,
// then four rows for each person. Same labels, colours, font and numbers
// (difference = achieved - target, every day, as the sheet's formulas do).
// A cell is picked with a click or the arrow keys; typing a number, Enter or
// a double click edits it in place; Ctrl+Alt+M comments on it, in a card
// beside the cell, as Google Sheets does. The month tabs sit along the bottom.

const COLOURS = {
  date: '#ffff00',
  weekday: '#f6b26b',
  target: '#cccccc',
  achieved: '#f9cb9c',
  overtime: '#9fc5e8',
  label: '#93c47d',
  set: '#b7e1cd',
  more: '#b7e1cd',
  less: '#f4c7c3',
  sunday: '#999999',
};
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const letter = (index) => {
  let name = '';
  for (let n = index; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  return name;
};
export const tabName = (month) => {
  const [year, number] = month.split('-').map(Number);
  return `${MONTHS_SHORT[number - 1]}-${year}`;
};

const ROW_H = 21;
const NUM_W = 46; // row numbers
const A_W = 230; // labels
const B_W = 64; // month totals
const DAY_W = 54;

// Initials and a steady colour for a comment's avatar, as Google draws them.
const AVATARS = ['#1a73e8', '#e8710a', '#188038', '#d93025', '#9334e6', '#12b5cb', '#e52592', '#f9ab00'];
const initials = (name) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');
const avatarColour = (name) => AVATARS[[...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % AVATARS.length];
const when = (value) => {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86400000);
  const time = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  if (date.toDateString() === today.toDateString()) return `${time} Today`;
  if (date.toDateString() === yesterday.toDateString()) return `${time} Yesterday`;
  return `${time} ${date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
};

function CommentCard({ person, day, thread, canWrite, startTyping, onClose, style, cardRef, popup = false }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [text, setText] = useState('');
  const [typing, setTyping] = useState(startTyping);
  const box = useRef(null);
  useEffect(() => {
    if (startTyping) box.current?.focus();
  }, [startTyping]);

  const post = useMutation({
    mutationFn: () => api.post('/work/comments', { user: person.id, date: day.date, text }),
    onSuccess: () => {
      setText('');
      setTyping(false);
      queryClient.invalidateQueries({ queryKey: ['work'] });
    },
    onError: (issue) => toast.error('Could not comment', issue.message),
  });
  const remove = useMutation({
    mutationFn: (id) => api.delete(`/work/comments/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['work'] }),
    onError: (issue) => toast.error('Could not delete it', issue.message),
  });
  const send = () => text.trim() && post.mutate();

  const card = (
    <div
      ref={cardRef}
      role="dialog"
      aria-modal={popup || undefined}
      aria-label={`Comments on ${person.name}, ${day.date}`}
      style={popup ? undefined : style}
      className={`${
        popup ? 'relative w-full max-w-md rounded-t-2xl sm:rounded-2xl' : 'absolute z-40 w-[300px] rounded-lg'
      } bg-white text-[13px] text-[#202124] shadow-[0_1px_3px_rgba(60,64,67,.3),0_4px_8px_3px_rgba(60,64,67,.15)]`}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      {popup && (
        <div className="flex items-center justify-between border-b border-[#e8eaed] px-4 py-3">
          <p className="font-medium">
            {person.name} · {day.date.slice(8)}/{day.date.slice(5, 7)}
          </p>
          <button type="button" onClick={onClose} className="rounded-full px-3 py-1 text-[#1a73e8] hover:bg-[#f1f6fe]">
            Close
          </button>
        </div>
      )}
      {thread.length > 0 && (
        <ul className={`${popup ? 'max-h-[50dvh]' : 'max-h-72'} overflow-y-auto`}>
          {thread.map((comment, index) => (
            <li key={comment.id} className={`px-3 pt-3 ${index ? 'border-t border-[#e8eaed]' : ''} pb-2`}>
              <div className="flex items-start gap-2">
                <span
                  aria-hidden="true"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[12px] font-medium text-white"
                  style={{ background: avatarColour(comment.author.name) }}
                >
                  {initials(comment.author.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium leading-4">{comment.author.name}</p>
                  <p className="text-[11px] leading-4 text-[#5f6368]">{when(comment.createdAt)}</p>
                </div>
                {comment.mine && (
                  <button
                    type="button"
                    aria-label="Delete this comment"
                    onClick={() => remove.mutate(comment.id)}
                    className="grid h-7 w-7 place-items-center rounded-full text-[#5f6368] hover:bg-[#f1f3f4]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <p className="mt-1.5 whitespace-pre-wrap break-words leading-[18px]">{comment.text}</p>
            </li>
          ))}
        </ul>
      )}
      {canWrite ? (
        <div className={`p-3 ${thread.length ? 'border-t border-[#e8eaed]' : ''}`}>
          <textarea
            ref={box}
            value={text}
            rows={typing ? 3 : 1}
            onFocus={() => setTyping(true)}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) send();
            }}
            placeholder={thread.length ? 'Reply or add others with @' : 'Comment or add others with @'}
            aria-label={thread.length ? 'Reply' : 'Comment'}
            className="w-full resize-none rounded-[20px] border border-[#dadce0] px-3 py-1.5 text-[13px] leading-[18px] outline-none placeholder:text-[#80868b] focus:rounded-md focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8]"
          />
          {typing && (
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setText('');
                  setTyping(false);
                  if (!thread.length) onClose();
                }}
                className="h-8 rounded-full px-4 text-[13px] font-medium text-[#1a73e8] hover:bg-[#f1f6fe]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!text.trim() || post.isPending}
                onClick={send}
                className="h-8 rounded-full bg-[#1a73e8] px-4 text-[13px] font-medium text-white hover:bg-[#1765cc] disabled:bg-[#e8eaed] disabled:text-[#9aa0a6]"
              >
                {thread.length ? 'Reply' : 'Comment'}
              </button>
            </div>
          )}
        </div>
      ) : (
        thread.length === 0 && <p className="p-3 text-[#5f6368]">No comments.</p>
      )}
    </div>
  );
  if (!popup) return card;
  // On a phone the card would cover the cell: it opens over the page instead.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onMouseDown={onClose}>
      {card}
    </div>,
    document.body,
  );
}

export function SheetGrid({ sheet, totals, notes, search = '', onOpenDay, onMonth }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const box = useRef(null);
  const cardRef = useRef(null);
  const { days, today } = sheet;
  const words = search.trim().toLowerCase();
  const people = useMemo(
    () => (words ? sheet.people.filter((person) => person.label.toLowerCase().includes(words)) : sheet.people),
    [sheet.people, words],
  );
  const lastCol = 2 + days.length;
  const lastLetter = letter(lastCol);
  const todayCol = 3 + days.findIndex((day) => day.date === today);

  // The rows, as the Google Sheet has them.
  const rows = useMemo(() => {
    const list = [
      { kind: 'date' },
      { kind: 'weekday' },
      { kind: 'team', field: 'target', label: 'Total Daily Target', fill: COLOURS.target },
      { kind: 'team', field: 'achieved', label: 'Total Achieved', fill: COLOURS.achieved },
      { kind: 'team', field: 'overtime', label: 'Additional (OT)', fill: COLOURS.overtime },
      { kind: 'teamDifference', label: 'Difference (Daily Target-Achieved)' },
      { kind: 'blank' },
    ];
    for (const person of people) {
      list.push(
        { kind: 'target', person },
        { kind: 'achieved', person },
        { kind: 'overtime', person },
        { kind: 'difference', person },
        { kind: 'blank' },
      );
    }
    return list;
  }, [people]);

  const total = (person, day, field) => {
    const item = totals[`${person.id}|${day.date}`];
    if (field === 'target') return day.sunday ? 0 : (item?.target ?? 0);
    if (field === 'achieved') return item?.filled ? item.achieved : null;
    return item?.overtime || null;
  };

  // Every number the sheet shows, worked out once per change of data (not on
  // every click), so picking and typing stay quick.
  const sums = useMemo(() => {
    const team = { target: [], achieved: [], overtime: [] };
    days.forEach((day, i) => {
      for (const field of ['target', 'achieved', 'overtime']) {
        team[field][i] = people.reduce((sum, person) => sum + (total(person, day, field) ?? 0), 0);
      }
    });
    return team;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [people, days, totals]);

  const firstRows = useMemo(() => rows.map((row, index) => (row.kind === 'target' ? index + 1 : null)).filter(Boolean), [rows]);
  const dayAt = (c) => (c >= 3 ? days[c - 3] : null);

  function canEdit(row, day) {
    if (!day || day.sunday || !row?.person) return false;
    if (row.kind === 'target') {
      if (row.person.canLead) return true;
      // Their own added work (no lead set it): they may set its target.
      const entries = totals[`${row.person.id}|${day.date}`]?.entries ?? [];
      return row.person.canFill && entries.every((entry) => !entry.targetBy || entry.targetBy === row.person.id);
    }
    if (row.kind === 'achieved' || row.kind === 'overtime') return row.person.canFill && day.date <= today;
    return false;
  }

  // What each cell shows and how it is coloured.
  const matrix = useMemo(() => {
    const label = { achieved: 'Daily Achieved', overtime: 'Additional (OT)', difference: 'Difference (Target-Daily Achieved)' };
    return rows.map((row) => {
      const cells = [];
      const monthSum = (field) => days.reduce((sum, day) => sum + (total(row.person, day, field) ?? 0), 0);
      for (let c = 1; c <= lastCol; c += 1) {
        const day = dayAt(c);
        let value = '';
        let fill = '#ffffff';
        if (row.kind === 'date') {
          fill = COLOURS.date;
          value = c === 2 ? 'Target' : day ? `${Number(day.date.slice(8))}-${MONTHS_SHORT[Number(day.date.slice(5, 7)) - 1]}` : '';
        } else if (row.kind === 'weekday') {
          fill = COLOURS.weekday;
          value = day ? day.weekday : '';
        } else if (row.kind === 'blank') {
          value = '';
        } else if (c === 1) {
          value = row.kind === 'target' ? row.person.label : (row.label ?? label[row.kind]);
          fill =
            row.kind === 'team'
              ? row.fill
              : ({ target: COLOURS.target, achieved: COLOURS.achieved, overtime: COLOURS.overtime }[row.kind] ?? COLOURS.label);
        } else if (row.kind === 'team') {
          fill = row.fill;
          value = c === 2 ? sums[row.field].reduce((a, b) => a + b, 0) : sums[row.field][c - 3];
        } else if (row.kind === 'teamDifference' || row.kind === 'difference') {
          if (row.kind === 'teamDifference') {
            value =
              c === 2 ? days.reduce((sum, _d, i) => sum + sums.achieved[i] - sums.target[i], 0) : sums.achieved[c - 3] - sums.target[c - 3];
          } else {
            const diff = (d) => (d.sunday ? 0 : (total(row.person, d, 'achieved') ?? 0) - total(row.person, d, 'target'));
            value = c === 2 ? days.reduce((sum, d) => sum + diff(d), 0) : diff(day);
          }
          fill = day?.sunday ? COLOURS.sunday : value < 0 ? COLOURS.less : COLOURS.more;
        } else if (c === 2) {
          value = monthSum(row.kind);
          fill = { target: COLOURS.target, achieved: COLOURS.achieved, overtime: COLOURS.overtime }[row.kind];
        } else {
          const raw = total(row.person, day, row.kind);
          const empty = row.kind === 'target' && !day.sunday && !totals[`${row.person.id}|${day.date}`]?.target;
          value = empty ? '' : (raw ?? '');
          if (row.kind === 'target') fill = day.sunday ? COLOURS.sunday : value ? COLOURS.set : COLOURS.target;
          else fill = day.sunday ? COLOURS.sunday : row.kind === 'achieved' ? COLOURS.achieved : COLOURS.overtime;
        }
        const said = row.kind === 'achieved' && day ? notes[`${row.person.id}|${day.date}`] : null;
        cells.push({ value, fill, said: said?.length ? said : null });
      }
      return cells;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sums, totals, notes, days, lastCol]);

  const [picked, setPicked] = useState({ r: 2, c: Math.max(3, todayCol) });
  const [editing, setEditing] = useState(null); // { r, c, value }
  const [card, setCard] = useState(null); // { r, c, typing }
  const [cardPos, setCardPos] = useState(null);
  const [mark, setMark] = useState(null); // where the picked cell is, for its outline
  // Small screens get the comments in a popup instead of beside the cell.
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  useEffect(() => {
    const check = () => setNarrow(window.innerWidth < 768);
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // A cell's formula, for the bar above (only for the picked cell).
  const formulaOf = (r, c) => {
    const row = rows[r];
    const n = r + 1;
    const col = letter(c);
    if (!row || c === 1) return null;
    if (row.kind === 'team') {
      if (c === 2) return `=SUM(C${n}:${lastLetter}${n})`;
      return `=SUM(${firstRows.map((first) => `${col}${first + { target: 0, achieved: 1, overtime: 2 }[row.field]}`).join(',')})`;
    }
    if (row.kind === 'teamDifference') return `=${col}4-${col}3`;
    if (row.kind === 'difference') return `=${col}${n - 2}-${col}${n - 3}`;
    if (['target', 'achieved', 'overtime'].includes(row.kind) && c === 2) return `=SUM(C${n}:${lastLetter}${n})`;
    return null;
  };

  const ownerOf = (r, c) => {
    const row = rows[r];
    const day = dayAt(c);
    return row?.person && day ? { person: row.person, day } : null;
  };

  const save = useMutation({
    mutationFn: ({ person, day, field, value }) => {
      const entries = totals[`${person.id}|${day.date}`]?.entries ?? [];
      const latest = sheet.entries.filter((entry) => entry.user === person.id).at(-1);
      const task = entries[0]?.task ?? latest?.task ?? 'Daily work';
      const number = value === '' ? null : Number(value);
      const body = { user: person.id, date: day.date, task };
      if (field === 'target') body.target = number ?? 0;
      if (field === 'achieved') body.achieved = number;
      if (field === 'overtime') body.overtime = number ?? 0;
      return api.put('/work/entries', body);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['work'] }),
    onError: (issue) => toast.error('Not saved', issue.message),
  });

  const startEditing = (r, c, first = null) => {
    const row = rows[r];
    const day = dayAt(c);
    if (!canEdit(row, day)) return false;
    // Several pieces of work that day: they are edited one by one.
    if ((totals[`${row.person.id}|${day.date}`]?.entries ?? []).length > 1) {
      onOpenDay(row.person, day);
      return true;
    }
    const current = matrix[r][c - 1].value;
    setEditing({ r, c, value: first ?? (current === '' ? '' : String(current)) });
    return true;
  };

  const commit = (move = 1) => {
    if (!editing) return;
    const { r, c, value } = editing;
    const row = rows[r];
    const before = matrix[r][c - 1].value;
    const clean = value.trim();
    setEditing(null);
    if (clean !== '' && (Number.isNaN(Number(clean)) || Number(clean) < 0)) {
      toast.error('Not saved', 'Use a number of 0 or more.');
    } else if (String(before) !== clean) {
      save.mutate({ person: row.person, day: dayAt(c), field: row.kind, value: clean });
    }
    setPicked({ r: Math.min(rows.length - 1, r + move), c });
    box.current?.focus();
  };

  // Where a cell sits inside the scrolling sheet.
  const placeOf = (r, c) => {
    const container = box.current;
    const cell = container?.querySelector(`[data-r="${r}"][data-c="${c}"]`);
    if (!container || !cell) return null;
    const outer = container.getBoundingClientRect();
    const rect = cell.getBoundingClientRect();
    return {
      left: rect.left - outer.left + container.scrollLeft,
      top: rect.top - outer.top + container.scrollTop,
      width: rect.width,
      height: rect.height,
    };
  };

  // The blue outline of the picked cell is one element laid over the sheet,
  // so moving it never redraws the cells.
  useLayoutEffect(() => {
    setMark(placeOf(picked.r, picked.c));
    const cell = box.current?.querySelector(`[data-r="${picked.r}"][data-c="${picked.c}"]`);
    cell?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked, matrix]);

  // The comment card sits beside the cell it is about.
  useLayoutEffect(() => {
    if (!card) return setCardPos(null);
    const place = placeOf(card.r, card.c);
    const container = box.current;
    if (!place || !container) return undefined;
    let left = place.left + place.width + 6;
    if (left + 300 > container.scrollLeft + container.clientWidth) left = place.left - 306;
    setCardPos({ left: Math.max(container.scrollLeft + NUM_W + A_W, left), top: place.top });
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card]);

  // A click outside the card closes it.
  useEffect(() => {
    if (!card || narrow) return undefined;
    const close = (event) => {
      if (!cardRef.current?.contains(event.target)) setCard(null);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [card, narrow]);

  const onKeyDown = (event) => {
    if (editing) return;
    const { r, c } = picked;
    if (event.ctrlKey && event.altKey && event.key.toLowerCase() === 'm') {
      event.preventDefault();
      if (ownerOf(r, c)) setCard({ r, c, typing: true });
      return;
    }
    const moves = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1], Tab: [0, event.shiftKey ? -1 : 1] };
    if (moves[event.key]) {
      event.preventDefault();
      const [dr, dc] = moves[event.key];
      setCard(null);
      setPicked({ r: Math.min(rows.length - 1, Math.max(0, r + dr)), c: Math.min(lastCol, Math.max(1, c + dc)) });
      return;
    }
    if (event.key === 'Enter' || event.key === 'F2') {
      event.preventDefault();
      if (!startEditing(r, c)) setPicked({ r: Math.min(rows.length - 1, r + 1), c });
      return;
    }
    if (/^[0-9]$/.test(event.key)) {
      if (startEditing(r, c, event.key)) event.preventDefault();
      return;
    }
    if ((event.key === 'Delete' || event.key === 'Backspace') && canEdit(rows[r], dayAt(c))) {
      event.preventDefault();
      if (matrix[r][c - 1].value !== '') save.mutate({ person: rows[r].person, day: dayAt(c), field: rows[r].kind, value: '' });
    }
  };

  // The cells' own handlers read the latest state through a ref, so the
  // drawn cells do not need redrawing when it changes.
  const handlers = useRef({});
  handlers.current = {
    down(event) {
      const cell = event.target.closest('[data-r]');
      if (!cell) return;
      const r = Number(cell.dataset.r);
      const c = Number(cell.dataset.c);
      if (editing && (editing.r !== r || editing.c !== c)) commit(0);
      setPicked({ r, c });
      setCard(null);
      box.current?.focus();
      // Someone's day opens its popup: target, achieved, OT and comments.
      const owner = ownerOf(r, c);
      const said = owner ? notes[`${owner.person.id}|${owner.day.date}`] : null;
      if (owner && !owner.day.sunday && (owner.person.canLead || owner.person.canFill || said?.length)) {
        event.preventDefault();
        onOpenDay(owner.person, owner.day);
      }
    },
  };

  const stickyLeft = (c) => (c === 1 ? NUM_W : c === 2 ? NUM_W + A_W : undefined);
  const stickyTop = (r) => (r === 0 ? ROW_H + 1 : r === 1 ? ROW_H * 2 + 2 : undefined);

  // The cells, drawn only when the numbers change.
  const body = useMemo(
    () => (
      <tbody onMouseDown={(event) => handlers.current.down(event)}>
        {rows.map((row, r) => (
          <tr key={`${row.kind}-${row.person?.id ?? r}-${r}`} style={{ height: ROW_H }}>
            <th
              scope="row"
              style={{ top: stickyTop(r) }}
              className={`sticky left-0 border-r border-b border-[#c0c0c0] bg-[#f8f9fa] text-center text-[11px] font-normal text-[#444746] ${
                r <= 1 ? 'z-30' : 'z-10'
              } ${r === 1 ? 'border-b-[3px] border-b-[#c0c0c0]' : ''}`}
            >
              {r + 1}
            </th>
            {matrix[r].map((cell, i) => {
              const c = i + 1;
              const left = stickyLeft(c);
              const top = stickyTop(r);
              const bold =
                row.kind === 'date' || (row.kind === 'team' && c === 1) || (c === 2 && row.kind !== 'weekday' && row.kind !== 'blank');
              const stuck = left !== undefined || top !== undefined;
              return (
                <td
                  key={c}
                  data-r={r}
                  data-c={c}
                  title={cell.said ? `${cell.said.at(-1).author.name}: ${cell.said.at(-1).text}` : undefined}
                  style={{ background: cell.fill, left, top }}
                  className={`overflow-hidden border-r border-b border-[#e2e3e3] px-1 leading-[20px] whitespace-nowrap ${
                    c === 1 ? 'text-left' : row.kind === 'date' && c > 2 ? 'text-right' : 'text-center'
                  } ${bold ? 'font-bold' : ''} ${stuck ? 'sticky' : 'relative'} ${
                    left !== undefined && top !== undefined ? 'z-20' : stuck ? 'z-[5]' : ''
                  } ${c === 2 ? 'border-r-[3px] border-r-[#c0c0c0]' : ''} ${r === 1 ? 'border-b-[3px] border-b-[#c0c0c0]' : ''} ${
                    c === todayCol && r === 0 ? 'underline decoration-2 underline-offset-2' : ''
                  }`}
                >
                  {cell.value === null ? '' : String(cell.value)}
                  {cell.said && (
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute top-0 right-0 h-0 w-0 border-t-[7px] border-l-[7px] border-l-transparent"
                      style={{ borderTopColor: '#e37400' }}
                    />
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [matrix, rows, todayCol],
  );

  const pickedValue = matrix[picked.r]?.[picked.c - 1]?.value;
  const pickedFormula = formulaOf(picked.r, picked.c);
  const pickedOwner = ownerOf(picked.r, picked.c);
  const cardOwner = card ? ownerOf(card.r, card.c) : null;
  const cardThread = cardOwner ? (notes[`${cardOwner.person.id}|${cardOwner.day.date}`] ?? []) : [];
  const editPlace = editing ? placeOf(editing.r, editing.c) : null;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-[#dadce0] bg-white text-[#202124] [color-scheme:light]">
      {/* The name box and formula bar. */}
      <div className="flex h-9 shrink-0 items-center border-b border-[#dadce0] bg-white text-[13px]">
        <span className="flex h-full w-[90px] items-center border-r border-[#dadce0] px-3 font-medium tabular-nums">
          {letter(picked.c)}
          {picked.r + 1}
        </span>
        <span className="px-3 font-serif text-[15px] text-[#5f6368] italic">fx</span>
        <span className="min-w-0 flex-1 truncate pr-3 tabular-nums">{pickedFormula ?? String(pickedValue ?? '')}</span>
        {pickedOwner && (
          <button
            type="button"
            onClick={() => setCard({ r: picked.r, c: picked.c, typing: true })}
            title="Insert comment (Ctrl+Alt+M)"
            className="mr-1 flex h-7 items-center gap-1.5 rounded px-2 text-[#444746] hover:bg-[#f1f3f4]"
          >
            <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Comment</span>
          </button>
        )}
      </div>

      {/* The grid. */}
      <div
        ref={box}
        tabIndex={0}
        role="grid"
        aria-label={`Work sheet, ${tabName(sheet.month)}`}
        aria-rowcount={rows.length}
        aria-colcount={lastCol}
        onKeyDown={onKeyDown}
        className="relative min-h-0 flex-1 overflow-auto outline-none [contain:strict]"
        style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
      >
        <table
          className="border-separate border-spacing-0 text-[13px]"
          style={{ tableLayout: 'fixed', width: NUM_W + A_W + B_W + days.length * DAY_W }}
        >
          <colgroup>
            <col style={{ width: NUM_W }} />
            <col style={{ width: A_W }} />
            <col style={{ width: B_W }} />
            {days.map((day) => (
              <col key={day.date} style={{ width: DAY_W }} />
            ))}
          </colgroup>
          <thead>
            <tr style={{ height: ROW_H + 1 }}>
              <th className="sticky top-0 left-0 z-30 border-r border-b border-[#c0c0c0] bg-[#f8f9fa]" />
              {Array.from({ length: lastCol }, (_, i) => i + 1).map((c) => (
                <th
                  key={c}
                  scope="col"
                  style={{ left: stickyLeft(c) }}
                  className={`sticky top-0 border-r border-b border-[#c0c0c0] text-center text-[11px] font-normal text-[#444746] ${
                    picked.c === c ? 'bg-[#d3e3fd] font-semibold text-[#0b57d0]' : 'bg-[#f8f9fa]'
                  } ${c <= 2 ? 'z-30' : 'z-20'} ${c === 2 ? 'border-r-[3px] border-r-[#c0c0c0]' : ''}`}
                >
                  {letter(c)}
                </th>
              ))}
            </tr>
          </thead>
          {body}
        </table>

        {mark && !editing && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute z-[4] border-2 border-[#1a73e8]"
            style={{ left: mark.left, top: mark.top, width: mark.width, height: mark.height }}
          />
        )}
        {editing && editPlace && (
          <input
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            value={editing.value}
            inputMode="decimal"
            aria-label={`${rows[editing.r].person.name}, ${dayAt(editing.c).date}`}
            onChange={(event) => setEditing({ ...editing, value: event.target.value })}
            onBlur={() => commit(0)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commit(1);
              } else if (event.key === 'Tab') {
                event.preventDefault();
                commit(0);
                setPicked({ r: editing.r, c: Math.min(lastCol, editing.c + 1) });
              } else if (event.key === 'Escape') {
                setEditing(null);
                box.current?.focus();
              }
            }}
            className="absolute z-[6] bg-white px-1 text-center text-[13px] outline-2 outline-[#1a73e8]"
            style={{ left: editPlace.left, top: editPlace.top, width: editPlace.width, height: editPlace.height }}
          />
        )}

        {card && cardOwner && cardPos && (
          <CommentCard
            key={`${card.r}|${card.c}`}
            cardRef={cardRef}
            person={cardOwner.person}
            day={cardOwner.day}
            thread={cardThread}
            canWrite={cardOwner.person.canFill}
            startTyping={card.typing}
            onClose={() => {
              setCard(null);
              box.current?.focus();
            }}
            style={{ left: cardPos.left, top: cardPos.top }}
            popup={narrow}
          />
        )}
      </div>

      {/* This month's tab, as at the bottom of the Google Sheet; next month it
          is replaced by the new one. */}
      <div
        className="flex h-10 shrink-0 items-stretch gap-0.5 border-t border-[#dadce0] bg-[#f8f9fa] px-2"
        role="tablist"
        aria-label="Months"
      >
        {[(sheet.months ?? []).find((item) => item.month === sheet.month) ?? { month: sheet.month, comments: 0 }].map(
          ({ month, comments }) => (
            <button
              key={month}
              type="button"
              role="tab"
              aria-selected="true"
              onClick={() => onMonth(month)}
              className="my-1 flex shrink-0 items-center gap-1.5 rounded-t border-b-2 border-[#188038] bg-[#e6f4ea] px-3 text-[13px] font-medium text-[#188038]"
            >
              {comments > 0 && (
                <span className="rounded bg-[#e37400] px-1 text-[10px] leading-4 font-semibold text-white">
                  {comments > 99 ? '99+' : comments}
                </span>
              )}
              {tabName(month)}
            </button>
          ),
        )}
      </div>
    </div>
  );
}
