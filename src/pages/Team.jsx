import { MapPin } from 'lucide-react';
import { useMemo, useState } from 'react';
import { MemberProfile, MemberRow, useTeam } from '../components/TeamPeople';
import { LoadError, PageHeading, Panel, PanelTitle, Reveal, RowsSkeleton, SelectBox } from '../components/ui';
import { useAuth } from '../lib/auth';

// Senior roles first, then everyone else by name of the role.
const ROLE_ORDER = ['admin', 'manager', 'team leader', 'lead', 'senior', 'technical', 'analyst'];

function roleRank(designation) {
  const text = designation.toLowerCase();
  const index = ROLE_ORDER.findIndex((word) => text.includes(word));
  return index === -1 ? ROLE_ORDER.length : index;
}

// Groups up to this size sit side by side; bigger ones get the full width.
const SMALL_GROUP = 3;

function Group({ group, onOpen, wide = false, className = '' }) {
  const away = group.people.filter((member) => member.leave).length;
  return (
    <Panel className={className}>
      <PanelTitle
        action={
          <span className="flex items-center gap-2 text-xs text-muted">
            {away > 0 && <span>{away} on leave</span>}
            <span className="grid h-6 min-w-6 place-items-center rounded-md bg-sunken px-1.5 font-medium tabular-nums text-ink">{group.people.length}</span>
          </span>
        }
      >
        {group.designation}
      </PanelTitle>
      <ul className={wide ? 'grid gap-x-3 gap-y-1 p-3 sm:grid-cols-2 xl:grid-cols-3' : 'divide-y divide-line px-2 py-1'}>
        {group.people.map((member) => (
          <li key={member.id} className="min-w-0">
            <MemberRow member={member} onOpen={onOpen} detail="phone" />
          </li>
        ))}
      </ul>
    </Panel>
  );
}

// The department at a glance: everyone grouped by designation, with phone
// numbers and who is on leave today. Click anyone for their profile.
export default function Team() {
  const { user } = useAuth();
  const { data, isPending, isError, error, refetch } = useTeam();
  const [picked, setPicked] = useState(null);
  const [open, setOpen] = useState(null);

  const department = picked ?? (data?.departments.includes(user.department) ? user.department : data?.departments[0]) ?? '';

  const groups = useMemo(() => {
    const members = (data?.members ?? []).filter((member) => !department || member.department === department);
    const byRole = new Map();
    for (const member of members) {
      if (!byRole.has(member.designation)) byRole.set(member.designation, []);
      byRole.get(member.designation).push(member);
    }
    return [...byRole.entries()]
      .map(([designation, people]) => ({ designation, people: people.sort((a, b) => a.name.localeCompare(b.name)) }))
      .sort((a, b) => roleRank(a.designation) - roleRank(b.designation) || a.designation.localeCompare(b.designation));
  }, [data, department]);

  const small = groups.filter((group) => group.people.length <= SMALL_GROUP);
  const big = groups.filter((group) => group.people.length > SMALL_GROUP);
  const count = groups.reduce((sum, group) => sum + group.people.length, 0);
  const away = groups.reduce((sum, group) => sum + group.people.filter((member) => member.leave).length, 0);

  return (
    <div>
      <PageHeading title="Team">Everyone in the department, and who is on leave today.</PageHeading>

      <Reveal delay={0.04}>
        <Panel className="mb-4 flex flex-wrap items-center gap-3 p-3">
          <div className="w-full sm:w-64">
            <SelectBox aria-label="Department" className="w-full" value={department} onChange={(event) => setPicked(event.target.value)}>
              {(data?.departments ?? []).map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </SelectBox>
          </div>
          <span className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-line px-3 text-sm">
            <MapPin className="h-4 w-4 text-muted" aria-hidden="true" />
            {data?.location ?? 'Bhubaneswar'}
          </span>
          <p className="ml-auto text-right text-sm">
            <span className="block text-lg font-semibold tabular-nums leading-tight">{count}</span>
            <span className="text-muted">{count === 1 ? 'Member' : 'Members'}</span>
            {away > 0 && <span className="text-muted">, {away} on leave today</span>}
          </p>
        </Panel>
      </Reveal>

      {isPending && <RowsSkeleton rows={6} />}
      {isError && <LoadError error={error} onRetry={refetch} />}

      {/* Small groups pack together like cards on a board, so a one-person
          group never leaves a gap beside a long one. Big groups take the full
          width and lay their people out in columns. */}
      <div className="flex flex-col gap-4">
      {small.length > 0 && (
        <Reveal delay={0.08} className="gap-4 md:columns-2 xl:columns-3 [&>*:last-child]:mb-0">
          {small.map((group) => (
            <Group key={group.designation} group={group} onOpen={setOpen} className="mb-4 break-inside-avoid" />
          ))}
        </Reveal>
      )}
      {big.length > 0 && (
        <Reveal delay={0.1} className="space-y-4">
          {big.map((group) => (
            <Group key={group.designation} group={group} onOpen={setOpen} wide />
          ))}
        </Reveal>
      )}
      </div>

      {open && <MemberProfile member={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
