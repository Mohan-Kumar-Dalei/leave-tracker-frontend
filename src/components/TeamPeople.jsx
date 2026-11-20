import { isManager, ManagerBadge } from './OrgTrees';
import { useQuery } from '@tanstack/react-query';
import { BadgeCheck, Building2, Mail, MapPin, Phone, Search, UserRound } from 'lucide-react';
import { useMemo, useState } from 'react';
import { api } from '../lib/api';
import { slashDate } from '../lib/dates';
import { MandalaCorner } from './MandalaCorner';
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
          {isManager(member) && (
            <>
              {' '}
              <ManagerBadge />
            </>
          )}
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

// Someone's place, as badges: Manager, Assistant Manager, Team Lead, WFH.
function roleBadges(member, members) {
  const badges = [];
  if (isManager(member)) badges.push(['Manager', 'bg-[#f2a93b]/15 text-[#a8650b] dark:text-[#f5c26b]']);
  else if (member.role === 'admin' || /assistant\s*manager/i.test(member.designation ?? '')) {
    badges.push(['Assistant Manager', 'bg-accent-soft text-accent']);
  } else if (member.teamLead || members.some((other) => other.reportsTo === member.id)) {
    badges.push(['Team Lead', 'bg-approved-soft text-approved']);
  }
  if (member.workFromHome) badges.push(['WFH', 'bg-sunken text-ink']);
  return badges;
}

function Row({ icon: Icon, label, children }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Icon className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
      <dt className="w-28 shrink-0 text-[13px] text-muted">{label}</dt>
      <dd className="min-w-0 flex-1 truncate text-right text-sm font-medium">{children}</dd>
    </div>
  );
}

// A person's card, kept plain and solid (no gradients): a navy band with
// their photo, name, role badges and leave today; mail and call; then their
// details in one list, including who they report to.
export function MemberProfile({ member, onClose }) {
  const { data } = useTeam();
  const members = data?.members ?? [];
  const boss = members.find((other) => other.id === member.reportsTo);
  const badges = roleBadges(member, members);
  const phone = member.phone ? member.phone.replace(/\s+/g, '') : '';

  return (
    <Dialog open onClose={onClose} title="Profile" kind="modal">
      <div className="-mx-5 -mt-5">
        {/* The navy band with mandalas, solid, no gradient. */}
        <div className="relative h-20 overflow-hidden bg-[#16204a]" aria-hidden="true">
          <MandalaCorner className="absolute -right-10 -top-16 h-48 w-48 text-white opacity-[0.18]" />
          <MandalaCorner className="absolute left-[38%] -top-12 h-32 w-32 text-white opacity-[0.08]" />
          <MandalaCorner className="absolute -bottom-16 -left-10 h-36 w-36 text-[#f2a93b] opacity-[0.22]" />
        </div>
        <div className="px-5">
          <div className="-mt-10 flex items-end justify-between gap-3">
            <span className="rounded-full bg-surface p-1 shadow-card">
              <PhotoAvatar user={member} size={80} wave />
            </span>
            {badges.length > 0 && (
              <div className="mb-1 flex flex-wrap justify-end gap-1.5">
                {badges.map(([label, look]) => (
                  <span key={label} className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${look}`}>
                    {label}
                  </span>
                ))}
              </div>
            )}
          </div>
          <p className="mt-3 text-[22px] font-semibold leading-tight tracking-tight">{member.name}</p>
          <p className="mt-0.5 text-sm text-muted">
            {member.designation}
            <span className="mx-1.5 text-line">·</span>
            <span className="tabular-nums">{member.employeeId}</span>
          </p>
          <LeaveTag leave={member.leave} className="mt-2" />
          <div className="mt-4 grid grid-cols-2 gap-2">
            <a
              href={`mailto:${member.email}`}
              className="flex h-10 items-center justify-center gap-2 rounded-lg bg-accent text-sm font-medium text-on-accent transition-colors hover:bg-accent-deep"
            >
              <Mail className="h-4 w-4" aria-hidden="true" />
              Email
            </a>
            {phone ? (
              <a
                href={`tel:${phone}`}
                className="flex h-10 items-center justify-center gap-2 rounded-lg border border-line bg-surface text-sm font-medium transition-colors hover:bg-bg"
              >
                <Phone className="h-4 w-4" aria-hidden="true" />
                Call
              </a>
            ) : (
              <span className="flex h-10 items-center justify-center gap-2 rounded-lg border border-line text-sm text-muted">
                <Phone className="h-4 w-4" aria-hidden="true" />
                No phone
              </span>
            )}
          </div>
        </div>
      </div>
      <dl className="mt-5 divide-y divide-line rounded-xl border border-line">
        <Row icon={Mail} label="Email">
          {member.email}
        </Row>
        <Row icon={Phone} label="Phone">
          {member.phone || 'Not set'}
        </Row>
        <Row icon={Building2} label="Department">
          {member.department}
        </Row>
        <Row icon={UserRound} label="Reports to">
          {boss ? boss.name : 'Nobody above'}
        </Row>
        <Row icon={MapPin} label="Location">
          {member.location}
        </Row>
        <Row icon={BadgeCheck} label="Employee ID">
          {member.employeeId}
        </Row>
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
