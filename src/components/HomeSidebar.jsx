import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { PhotoAvatar } from './ProfilePhoto';
import { AllMembers, LeaveTag, MemberProfile, MemberRow, leaveFirst, useTeam } from './TeamPeople';
import { Panel } from './ui';

// The column at the side of the home page: who you are, who you report to,
// and the people in your department with who is on leave today.

function ProfileCard({ me, onOpen }) {
  return (
    <Panel className="text-center">
      <div aria-hidden="true" className="h-14 bg-accent-soft" />
      <div className="-mt-10 px-4 pb-4">
        <PhotoAvatar user={me} size={80} onClick={() => onOpen(me)} className="mx-auto block ring-4 ring-surface" />
        <p className="mt-3 text-sm">
          <span className="text-muted">{me.employeeId} - </span>
          <span className="font-semibold">{me.name}</span>
        </p>
        <p className="mt-0.5 text-[13px] text-muted">{me.designation}</p>
        <LeaveTag leave={me.leave} short className="mt-2" />
        <Link to="/profile" className="mt-3 inline-block text-[13px] font-medium text-accent hover:underline">
          Edit profile
        </Link>
      </div>
    </Panel>
  );
}

function ReportingTo({ manager, onOpen }) {
  return (
    <Panel className="p-2">
      <p className="px-2 pt-1 text-xs font-medium uppercase tracking-wide text-muted">Reporting to</p>
      <MemberRow member={manager} onOpen={onOpen} shortTag />
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
  const manager = user.role === 'admin' ? null : data.members.find((member) => member.role === 'admin' && member.id !== user.id);
  const others = leaveFirst(data.members.filter((member) => member.id !== user.id));
  const away = others.filter((member) => member.leave).length;
  const rest = others.length - show;

  return (
    <div className="space-y-4">
      <ProfileCard me={me} onOpen={setOpen} />
      {manager && <ReportingTo manager={manager} onOpen={setOpen} />}

      <Panel>
        <div className="px-4 pb-1 pt-3">
          <h2 className="text-sm font-semibold">Department members</h2>
          <p className="text-xs text-muted">{away > 0 ? `${away} on leave today` : 'Nobody on leave today'}</p>
        </div>
        <ul className="divide-y divide-line px-2 pb-1">
          {others.slice(0, show).map((member) => (
            <li key={member.id}>
              <MemberRow member={member} onOpen={setOpen} shortTag />
            </li>
          ))}
        </ul>
        {rest > 0 && (
          <button type="button" onClick={() => setAll(true)} className="w-full border-t border-line px-4 py-2.5 text-left text-sm font-medium text-accent hover:bg-bg">
            +{rest} more
          </button>
        )}
      </Panel>

      {all && (
        <AllMembers
          members={others}
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
