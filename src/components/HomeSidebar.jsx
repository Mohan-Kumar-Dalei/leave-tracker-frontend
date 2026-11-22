import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { positionOf } from '../lib/home';
import { PhotoAvatar } from './ProfilePhoto';
import { Sun } from 'lucide-react';
import { DancingBuddy } from './DancingBuddy';
import { AllMembers, DayTag, MemberProfile, MemberRow, leaveFirst, useTeam } from './TeamPeople';
import { SkyBanner } from './SkyBanner';
import { Panel } from './ui';
import { useAppPath } from '../hooks/useAppPath';

// The column at the side of the home page: who you are, who you report to,
// and the people in your department with who is on leave today.

// Waves hello the first time the card shows after signing in, not on every
// visit to the page. The mark is cleared on sign out (lib/auth.jsx). The
// short window keeps React's double render in development from losing it.
const firstSeen = new Map();

function firstLookThisSignIn(userId) {
  const key = `lt-hello-${userId}`;
  try {
    if (!sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, '1');
      firstSeen.set(userId, Date.now());
      return true;
    }
  } catch {
    // Without storage, skip the hello rather than wave on every visit.
    return false;
  }
  return Date.now() - (firstSeen.get(userId) ?? 0) < 1500;
}

// On the weekend, a warm note at the top of the department list: a little
// cartoon friend dancing, the sun turning slowly behind, and the day off for
// everyone. It fits itself to the room it has (a container query): side by
// side in the dashboard column, bigger on a wide phone, stacked when narrow.
function WeekendNote({ today }) {
  const day = new Date(`${today}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' });
  return (
    <div className="@container mx-2 mb-1">
      <div className="relative overflow-hidden rounded-xl border border-[#f2a93b]/30 bg-[#fff6e3] px-3 py-2.5 dark:border-[#f2a93b]/25 dark:bg-[#2a2216] @sm:px-4 @sm:py-3">
        <Sun
          className="absolute -right-4 -top-4 h-20 w-20 animate-[spin_24s_linear_infinite] text-[#f2a93b]/20 motion-reduce:animate-none"
          aria-hidden="true"
        />
        <div className="relative flex items-center gap-3 @max-[13rem]:flex-col @max-[13rem]:text-center">
          <DancingBuddy className="-my-1 h-16 w-14 shrink-0 @sm:h-20 @sm:w-[4.25rem]" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[#7a4a06] dark:text-[#f5c26b] @sm:text-base">Happy {day}!</p>
            <p className="mt-0.5 text-[13px] leading-snug text-pretty text-[#8a5a12] dark:text-[#e9c88f] @sm:text-sm">
              Everyone is off today. Rest, recharge and enjoy the day.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfileCard({ me, onOpen, weekend = false }) {
  const appPath = useAppPath();
  const [wave] = useState(() => firstLookThisSignIn(me.id));
  return (
    <Panel className="overflow-hidden text-center">
      <SkyBanner className="h-20" />
      <div className="relative -mt-10 px-4 pb-4">
        <PhotoAvatar user={me} size={80} onClick={() => onOpen(me)} wave={wave} className="mx-auto block ring-4 ring-surface" />
        <p className="mt-3 text-sm">
          <span className="text-muted">{me.employeeId} - </span>
          <span className="font-semibold">{me.name}</span>
        </p>
        <p className="mt-0.5 text-[13px] text-muted">{me.designation}</p>
        {(weekend || me.leave) && (
          <div className="mt-2">
            <DayTag leave={me.leave} weekend={weekend} short />
          </div>
        )}
        <Link to={appPath('/profile')} className="mt-3 inline-block text-[13px] font-medium text-accent hover:underline">
          Edit profile
        </Link>
      </div>
    </Panel>
  );
}

function ReportingTo({ manager, onOpen, weekend = false }) {
  return (
    <Panel className="p-2">
      <p className="px-2 pt-1 text-xs font-medium uppercase tracking-wide text-muted">Reporting to</p>
      <MemberRow member={manager} onOpen={onOpen} shortTag weekend={weekend} />
    </Panel>
  );
}

export function HomeSidebar({ show = 3 }) {
  const { user } = useAuth();
  const { data } = useTeam();
  const [open, setOpen] = useState(null);
  const [all, setAll] = useState(false);

  if (!data) {
    return <div className="h-72 animate-pulse rounded-xl bg-sunken motion-reduce:animate-none" />;
  }

  const me = data.members.find((member) => member.id === user.id) ?? {
    ...user,
    designation: user.designation || (user.role === 'admin' ? 'Admin' : 'Analyst'),
    leave: null,
  };
  // On the dashboard, "Reporting to" is whoever decides your leave: the
  // department's assistant manager for an employee (not their team lead, who
  // shows in the Employee tree), and the manager for the assistant manager.
  const admins = data.members.filter((member) => member.role === 'admin' && member.id !== user.id && member.department === me.department);
  const isAssistant = (member) => /assistant\s*manager/i.test(member.designation ?? '');
  const position = positionOf(user);
  // The manager may have chosen another assistant manager for your leave.
  const chosen = me.leaveReportTo ? data.members.find((member) => member.id === me.leaveReportTo) : null;
  const departmentManager = data.members.find((member) => member.id !== user.id && (member.manages ?? []).includes(me.department));
  const manager =
    chosen ??
    (position === 'hr' || position === 'manager'
      ? null
      : position === 'assistantmanager'
        ? (departmentManager ?? admins.find((member) => !isAssistant(member)) ?? null)
        : (admins.find(isAssistant) ?? admins[0] ?? null));
  // Only the people in the same department, now that there are several.
  const others = leaveFirst(data.members.filter((member) => member.id !== user.id && member.department === me.department));
  const away = others.filter((member) => member.leave).length;
  const rest = others.length - show;
  const weekend = Boolean(data.weekend);

  return (
    <div className="flex flex-col gap-4 lg:h-full">
      <ProfileCard me={me} onOpen={setOpen} weekend={weekend} />
      {manager && <ReportingTo manager={manager} onOpen={setOpen} weekend={weekend} />}

      <Panel className="lg:flex-1">
        <div className="px-4 pb-1 pt-3">
          <h2 className="text-sm font-semibold">Department members</h2>
          <p className="text-xs text-muted">
            {weekend ? 'Weekend, nobody is working today' : away > 0 ? `${away} on leave today` : 'Nobody on leave today'}
          </p>
        </div>
        {weekend && <WeekendNote today={data.today} />}
        <ul className="divide-y divide-line px-2 pb-1">
          {others.slice(0, show).map((member) => (
            <li key={member.id}>
              <MemberRow member={member} onOpen={setOpen} shortTag weekend={weekend} />
            </li>
          ))}
        </ul>
        {rest > 0 && (
          <button
            type="button"
            onClick={() => setAll(true)}
            className="w-full border-t border-line px-4 py-2.5 text-left text-sm font-medium text-accent hover:bg-bg"
          >
            +{rest} more
          </button>
        )}
      </Panel>

      {all && (
        <AllMembers
          members={others}
          weekend={weekend}
          onClose={() => setAll(false)}
          onOpen={(member) => {
            setAll(false);
            setOpen(member);
          }}
        />
      )}
      {open && <MemberProfile member={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
