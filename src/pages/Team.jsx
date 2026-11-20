import { MapPin } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DepartmentTree, EmployeeTree, inDepartment, roleRank } from '../components/OrgTrees';
import { SegmentedTabs } from '../components/Tabs';
import { MemberProfile, MemberRow, useTeam } from '../components/TeamPeople';
import {
  LoadError,
  PageHeading,
  Panel,
  PanelTitle,
  Reveal,
  RowsSkeleton,
  SelectBox,
  StickyTop,
} from '../components/ui';
import { useAuth } from '../lib/auth';

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
            <span className="grid h-6 min-w-6 place-items-center rounded-md bg-sunken px-1.5 font-medium tabular-nums text-ink">
              {group.people.length}
            </span>
          </span>
        }
      >
        {group.designation}
      </PanelTitle>
      <ul
        className={wide ? 'grid gap-x-3 gap-y-1 p-3 sm:grid-cols-2 xl:grid-cols-3' : 'divide-y divide-line px-2 py-1'}
      >
        {group.people.map((member) => (
          <li key={member.id} className="min-w-0">
            <MemberRow member={member} onOpen={onOpen} detail="phone" />
          </li>
        ))}
      </ul>
    </Panel>
  );
}

const VIEWS = [
  ['team', 'Team'],
  ['department', 'Department tree'],
  ['employees', 'Employee tree'],
];

// The department at a glance, two ways: the team grouped by designation, with
// phone numbers and who is on leave today; or the reporting tree. Click
// anyone for their profile.
export default function Team() {
  const { user } = useAuth();
  const { data, isPending, isError, error, refetch } = useTeam();
  const [picked, setPicked] = useState(null);
  const [open, setOpen] = useState(null);
  const [params, setParams] = useSearchParams();
  const view = VIEWS.some(([key]) => key === params.get('view')) ? params.get('view') : 'team';

  // Start on your own department, as the team list names it (HR has its own).
  const mine = data?.members.find((member) => member.id === user.id)?.department ?? user.department;
  const department = picked ?? (data?.departments.includes(mine) ? mine : data?.departments[0]) ?? '';

  const groups = useMemo(() => {
    const members = (data?.members ?? []).filter((member) => !department || inDepartment(member, department));
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
      {/* The heading, the tabs and the department bar stay in place; only
          what is under them scrolls. */}
      <StickyTop>
        <PageHeading title="Department">
          Everyone in the department, who reports to whom, and who is on leave today.
        </PageHeading>

        <SegmentedTabs
          label="Department view"
          tabs={VIEWS}
          value={view}
          onChange={(key) => setParams(key === 'team' ? {} : { view: key }, { replace: true })}
        />

        {view === 'team' && (
          <Reveal delay={0.04}>
            <Panel className="mt-4 flex flex-wrap items-center gap-3 p-3">
              <div className="w-full sm:w-64">
                {data ? (
                  <SelectBox
                    aria-label="Department"
                    className="w-full"
                    value={department}
                    onChange={(event) => setPicked(event.target.value)}
                  >
                    {data.departments.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </SelectBox>
                ) : (
                  <div className="h-10 w-full animate-pulse rounded-lg bg-sunken motion-reduce:animate-none" role="status" aria-label="Loading" />
                )}
              </div>
              <span className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-line px-3 text-sm">
                <MapPin className="h-4 w-4 text-muted" aria-hidden="true" />
                {data?.location ?? 'Bhubaneswar'}
              </span>
              {data ? (
                <p className="ml-auto text-right text-sm">
                  <span className="block text-lg font-semibold tabular-nums leading-tight">{count}</span>
                  <span className="text-muted">{count === 1 ? 'Member' : 'Members'}</span>
                  {away > 0 && <span className="text-muted">, {away} on leave today</span>}
                </p>
              ) : (
                <div className="ml-auto h-10 w-20 animate-pulse rounded-lg bg-sunken motion-reduce:animate-none" aria-hidden="true" />
              )}
            </Panel>
          </Reveal>
        )}
      </StickyTop>

      {view !== 'team' && isPending && <RowsSkeleton rows={6} />}
      {view !== 'team' && isError && <LoadError error={error} onRetry={refetch} />}
      {view === 'department' && data && (
        <Reveal delay={0.04}>
          <DepartmentTree data={data} department={department} onDepartment={setPicked} onOpen={setOpen} />
        </Reveal>
      )}

      {view === 'employees' && data && (
        <Reveal delay={0.04}>
          <EmployeeTree data={data} onOpen={setOpen} />
        </Reveal>
      )}

      {view === 'team' && (
        <>
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
        </>
      )}

      {open && <MemberProfile member={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
