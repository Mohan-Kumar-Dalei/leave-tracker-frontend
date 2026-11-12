import { useQuery } from '@tanstack/react-query';
import { Mail, MapPin, Phone, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { api } from '../lib/api';
import { slashDate } from '../lib/dates';
import { Avatar, PhotoAvatar } from './ProfilePhoto';
import { Dialog } from './ui';

// The team as people see it: photo, ID and name, how to reach them, and who
// is on leave today. Leave Without Pay shows in red with its dates; any other
// leave shows in yellow.

export const useTeam = () => useQuery({ queryKey: ['team'], queryFn: () => api.get('/team') });

const HALF = { first: 'first half', second: 'second half' };

// 12/11, without the year, to keep the tag short.
const dayMonth = (day) => slashDate(day).slice(0, 5);

function leaveWhen(leave) {
  if (leave.from === leave.to) return HALF[leave.session] ? `today, ${HALF[leave.session]}` : 'today';
  return `${dayMonth(leave.from)} – ${dayMonth(leave.to)}`;
}

// Short: "On leave today", "On leave today, first half", "Leave without pay".
// Full adds the dates, for the member list and the profile.
function shortLabel(leave) {
  const half = leave.from === leave.to && HALF[leave.session] ? `, ${HALF[leave.session]}` : '';
  return `${leave.unpaid ? 'Leave without pay' : 'On leave today'}${half}`;
}

export function LeaveTag({ leave, short = false, className = '' }) {
  if (!leave) return null;
  const tone = leave.unpaid ? 'bg-rejected-soft text-rejected' : 'bg-pending-soft text-pending';
  const text = short ? shortLabel(leave) : `${leave.unpaid ? 'Leave without pay' : 'On leave'} ${leaveWhen(leave)}`;
  return (
    <span title={leave.type} className={`inline-block rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums ${tone} ${className}`}>
      {text}
    </span>
  );
}

// People on leave come first, then everyone by name.
export const leaveFirst = (members) => [...members].sort((a, b) => Number(Boolean(b.leave)) - Number(Boolean(a.leave)) || a.name.localeCompare(b.name));

export function MemberRow({ member, onOpen, detail = 'leave', shortTag = false }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(member)}
      className="flex w-full min-w-0 items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-bg"
    >
      <Avatar user={member} size={40} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm">
          <span className="text-muted">{member.employeeId} - </span>
          <span className="font-medium">{member.name}</span>
        </span>
        {detail === 'phone' ? (
          member.phone && <span className="block truncate text-[13px] tabular-nums text-muted">{member.phone}</span>
        ) : (
          <span className="block truncate text-[13px] text-muted">{member.designation}</span>
        )}
        <LeaveTag leave={member.leave} short={shortTag} className="mt-1" />
      </span>
    </button>
  );
}

function Detail({ icon: Icon, label, children }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-3 border-b border-line py-2.5 text-sm last:border-b-0">
      <dt className="flex items-center gap-1.5 text-muted">
        {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
        {label}
      </dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

export function MemberProfile({ member, onClose }) {
  return (
    <Dialog open onClose={onClose} title={member.name} kind="modal">
      <div className="flex flex-col items-center text-center">
        <PhotoAvatar user={member} size={96} wave />
        <p className="mt-3 text-lg font-semibold">{member.name}</p>
        <p className="text-sm text-muted">
          {member.employeeId}, {member.designation}
        </p>
        <LeaveTag leave={member.leave} className="mt-2" />
      </div>
      <dl className="mt-5">
        <Detail icon={Mail} label="Email">
          <a href={`mailto:${member.email}`} className="text-accent hover:underline">
            {member.email}
          </a>
        </Detail>
        <Detail icon={Phone} label="Phone">
          {member.phone ? (
            <a href={`tel:${member.phone.replace(/\s+/g, '')}`} className="tabular-nums text-accent hover:underline">
              {member.phone}
            </a>
          ) : (
            <span className="text-muted">Not set</span>
          )}
        </Detail>
        <Detail label="Department">{member.department}</Detail>
        <Detail label="Designation">{member.designation}</Detail>
        <Detail icon={MapPin} label="Location">
          {member.location}
        </Detail>
      </dl>
    </Dialog>
  );
}

export function AllMembers({ members, onOpen, onClose }) {
  const [query, setQuery] = useState('');
  const shown = useMemo(() => {
    const words = query.trim().toLowerCase();
    if (!words) return members;
    return members.filter((member) => `${member.name} ${member.employeeId} ${member.designation}`.toLowerCase().includes(words));
  }, [members, query]);

  return (
    <Dialog open onClose={onClose} title="Department members" kind="modal">
      <label className="relative block">
        <span className="sr-only">Search employee</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input
          data-autofocus
          type="search"
          value={query}
          placeholder="Search employee"
          onChange={(event) => setQuery(event.target.value)}
          className="h-10 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-base focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15 sm:text-sm"
        />
      </label>
      <ul className="mt-3 h-[min(420px,50dvh)] divide-y divide-line overflow-y-auto overscroll-contain">
        {shown.map((member) => (
          <li key={member.id}>
            <MemberRow member={member} onOpen={onOpen} />
          </li>
        ))}
        {shown.length === 0 && <li className="px-2 py-6 text-center text-sm text-muted">Nobody matches that search.</li>}
      </ul>
    </Dialog>
  );
}
