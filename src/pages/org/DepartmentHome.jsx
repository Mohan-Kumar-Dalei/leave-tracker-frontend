import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Copy, Link2, Mail, RefreshCw, Search } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Avatar } from '../../components/ProfilePhoto';
import {
  Button,
  ConfirmDialog,
  Empty,
  LoadError,
  PageHeading,
  Panel,
  PanelTitle,
  Reveal,
  RowsSkeleton,
  SelectBox,
  StickyTop,
  TextArea,
  TextInput,
} from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { homeOf } from '../../lib/home';
import { useToast } from '../../lib/toast';

// A department's own page, for its assistant manager (who runs it) and the
// owner: share the join link and approve the people who ask to join. Everyone
// approved reports to the assistant manager, as in Content Integration. The
// owner can also hand the assistant manager's place to someone else here.

const PLACE = { manager: 'Manager', assistant: 'Assistant Manager' };
const looksLikeAssistant = (person) => /assistant\s*manager/i.test(person.designation ?? '');

// The manager's first step: invite the assistant manager, who registers with
// the mailed link and becomes the department's admin.
function InviteAssistant({ id, pending }) {
  const [form, setForm] = useState({ name: '', email: '' });
  const [error, setError] = useState('');
  const [sentLink, setSentLink] = useState('');
  const queryClient = useQueryClient();
  const toast = useToast();
  const send = useMutation({
    mutationFn: () => api.post(`/departments/${id}/assistant-invite`, form),
    onSuccess: ({ invite }) => {
      setSentLink(invite.link);
      queryClient.invalidateQueries({ queryKey: ['department', id] });
      toast.success('Invitation sent', `${invite.name} gets a mail to join as assistant manager.`);
    },
    onError: (issue) => setError(issue.message),
  });

  return (
    <Panel>
      <PanelTitle>Invite your assistant manager</PanelTitle>
      <form
        className="space-y-3 p-4"
        onSubmit={(event) => {
          event.preventDefault();
          setError('');
          send.mutate();
        }}
      >
        {pending && !sentLink && (
          <p className="rounded-lg bg-pending-soft px-3 py-2 text-[13px] text-pending">
            Invited {pending.name} ({pending.email}). Sending again makes a new link.
          </p>
        )}
        <p className="text-[13px] text-muted">
          They register with the link, become this department&apos;s admin and bring in the team.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextInput label="Full name" required minLength={2} maxLength={80} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          <TextInput label="Email" type="email" required maxLength={160} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
        </div>
        {error && <p className="text-sm text-rejected">{error}</p>}
        {sentLink && (
          <input
            readOnly
            value={sentLink}
            aria-label="Invitation link"
            onFocus={(event) => event.target.select()}
            className="h-9 w-full rounded-lg border border-line bg-bg px-2.5 text-xs text-muted"
          />
        )}
        <Button type="submit" loading={send.isPending}>
          <Mail className="h-4 w-4" aria-hidden="true" />
          Send invitation
        </Button>
      </form>
    </Panel>
  );
}

function InviteTeam({ id, joinLink }) {
  const [copied, setCopied] = useState(false);
  const [emails, setEmails] = useState('');
  const [error, setError] = useState('');
  const [confirmNew, setConfirmNew] = useState(false);
  const [mailing, setMailing] = useState(false);
  const queryClient = useQueryClient();
  const toast = useToast();

  const send = useMutation({
    mutationFn: (list) => api.post(`/departments/${id}/join-link/mail`, { emails: list }),
    onSuccess: ({ sent, failed }) => {
      setEmails('');
      toast.success('Invitations sent', `${sent} sent${failed ? `, ${failed} could not be sent` : ''}.`);
    },
    onError: (issue) => setError(issue.message),
  });
  const fresh = useMutation({
    mutationFn: () => api.post(`/departments/${id}/join-link`),
    onSuccess: () => {
      setConfirmNew(false);
      queryClient.invalidateQueries({ queryKey: ['department', id] });
      toast.success('New link made', 'The old link no longer works.');
    },
  });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(joinLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy. Select the link and copy it yourself.');
    }
  };

  return (
    <Panel>
      <PanelTitle>Invite your team</PanelTitle>
      <div className="space-y-3 p-4">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <Link2 className="h-4 w-4 text-muted" aria-hidden="true" />
            Join link
          </p>
          <p className="mt-0.5 text-[13px] text-muted">Share it on mail or WhatsApp; you approve people below.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              readOnly
              value={joinLink}
              aria-label="Join link"
              onFocus={(event) => event.target.select()}
              className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 text-sm text-muted"
            />
            <Button variant="secondary" onClick={copy}>
              {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
            <Button variant="ghost" onClick={() => setConfirmNew(true)}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              New link
            </Button>
          </div>
        </div>

        {/* Mailing the link is a second way in, so it stays folded until wanted. */}
        {mailing ? (
          <form
            className="space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              setError('');
              const list = emails.split(/[\s,;]+/).map((item) => item.trim()).filter(Boolean);
              if (!list.length) return setError('Add at least one email.');
              return send.mutate(list);
            }}
          >
            <TextArea
              label="Mail the link"
              hint="Emails separated by commas or new lines. It goes from your Gmail."
              rows={2}
              value={emails}
              onChange={(event) => setEmails(event.target.value)}
              placeholder="asha@contify.com, ravi@contify.com"
            />
            {error && <p className="text-sm text-rejected">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" variant="secondary" loading={send.isPending}>
                <Mail className="h-4 w-4" aria-hidden="true" />
                Send invitations
              </Button>
              <Button variant="ghost" onClick={() => setMailing(false)}>
                Close
              </Button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setMailing(true)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-accent underline-offset-4 hover:underline"
          >
            <Mail className="h-4 w-4" aria-hidden="true" />
            Or mail the link to people
          </button>
        )}
        {!mailing && error && <p className="text-sm text-rejected">{error}</p>}
      </div>

      <ConfirmDialog
        open={confirmNew}
        onClose={() => setConfirmNew(false)}
        title="Make a new join link?"
        body="The current link stops working. People who already asked to join stay in the list."
        confirmLabel="Make new link"
        loading={fresh.isPending}
        onConfirm={() => fresh.mutate()}
      />
    </Panel>
  );
}

function Requests({ id, requests }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const decide = useMutation({
    mutationFn: ({ request, decision }) => api.post(`/departments/${id}/requests/${request.id}/${decision}`),
    onSuccess: (_data, { request, decision }) => {
      queryClient.invalidateQueries({ queryKey: ['department', id] });
      queryClient.invalidateQueries({ queryKey: ['team'] });
      toast.success(
        decision === 'approve' ? `${request.name} joined` : 'Request turned down',
        decision === 'approve' ? 'They got a mail and can sign in now.' : undefined,
      );
    },
    onError: (issue) => toast.error('Could not do that', issue.message),
  });

  return (
    <Panel className="flex min-h-0 flex-col md:flex-1">
      <PanelTitle
        action={
          requests.length ? (
            <span className="grid h-6 min-w-6 place-items-center rounded-md bg-pending-soft px-1.5 text-xs font-medium tabular-nums text-pending">
              {requests.length}
            </span>
          ) : null
        }
      >
        Waiting for approval
      </PanelTitle>
      {requests.length ? (
        <ul className="min-h-0 flex-1 divide-y divide-line overflow-y-auto overscroll-contain">
          {requests.map((request) => (
            <li key={request.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <Avatar user={request} size={34} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{request.name}</p>
                <p className="truncate text-xs text-muted">
                  {[request.designation, request.employeeId, request.email].filter(Boolean).join(' · ')}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  disabled={decide.isPending}
                  onClick={() => decide.mutate({ request, decision: 'reject' })}
                >
                  Reject
                </Button>
                <Button disabled={decide.isPending} onClick={() => decide.mutate({ request, decision: 'approve' })}>
                  Approve
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 py-4 text-sm text-muted">Nobody is waiting. People who open your join link show here.</p>
      )}
    </Panel>
  );
}

function Team({ id, members, canChooseAssistant }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const choose = useMutation({
    mutationFn: (person) => api.put(`/departments/${id}/assistant`, { user: person.id }),
    onSuccess: (_data, person) => {
      queryClient.invalidateQueries({ queryKey: ['department', id] });
      queryClient.invalidateQueries({ queryKey: ['team'] });
      toast.success('Assistant manager chosen', `${person.name} is the assistant manager. The team now reports to them.`);
    },
    onError: (issue) => toast.error('Could not do that', issue.message),
  });
  // The manager and the assistant manager both arrange the team: who is a
  // team lead, and who reports to whom.
  const arrange = useMutation({
    mutationFn: ({ person, change }) => api.patch(`/departments/${id}/members/${person.id}`, change),
    onSuccess: (_data, { person, change }) => {
      queryClient.invalidateQueries({ queryKey: ['department', id] });
      queryClient.invalidateQueries({ queryKey: ['team'] });
      if (change.teamLead !== undefined) {
        toast.success(change.teamLead ? 'Team lead added' : 'Team lead removed', `${person.name} ${change.teamLead ? 'is now a team lead' : 'is no longer a team lead; their team reports to the assistant manager'}.`);
      } else toast.success('Saved', `${person.name}'s reporting line is updated.`);
    },
    onError: (issue) => toast.error('Could not do that', issue.message),
  });
  const [search, setSearch] = useState('');
  const hasAssistant = members.some((person) => person.place === 'assistant');
  // Who someone can report to: the assistant manager, the manager, a team lead.
  const above = [
    ...members.filter((person) => person.place === 'assistant'),
    ...members.filter((person) => person.place === 'manager'),
    ...members.filter((person) => person.place === 'member' && person.teamLead).sort((a, b) => a.name.localeCompare(b.name)),
  ];
  const order = { manager: 0, assistant: 1, member: 2 };
  const query = search.trim().toLowerCase();
  const sorted = [...members]
    .filter((person) => `${person.name} ${person.employeeId ?? ''} ${person.designation ?? ''}`.toLowerCase().includes(query))
    .sort((a, b) => order[a.place] - order[b.place] || a.name.localeCompare(b.name));

  // The list scrolls inside the panel, so a big team fits on one screen.
  return (
    <Panel className="flex flex-col md:h-full">
      <div className="flex items-center gap-3 border-b border-line px-4 py-2.5">
        <h2 className="text-sm font-semibold">Team</h2>
        <span className="grid h-6 min-w-6 place-items-center rounded-md bg-sunken px-1.5 text-xs font-medium tabular-nums">
          {members.length}
        </span>
        <label className="relative ml-auto w-full max-w-56">
          <span className="sr-only">Search the team</span>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name or ID"
            className="h-9 w-full rounded-lg border border-line bg-surface pl-8 pr-2 text-base placeholder:text-muted focus:border-accent focus:outline-none sm:text-sm"
          />
        </label>
      </div>
      {canChooseAssistant && !hasAssistant && members.length > 1 && (
        <p className="border-b border-line bg-accent-soft px-4 py-2 text-[13px]">
          Choose the assistant manager: look at the designations and press <span className="font-medium">Make assistant manager</span>.
        </p>
      )}
      {sorted.length ? (
        <ul className="max-h-[60dvh] min-h-0 flex-1 divide-y divide-line overflow-y-auto overscroll-contain md:max-h-none">
          {sorted.map((person) => {
            const suggested = !hasAssistant && person.place === 'member' && looksLikeAssistant(person);
            return (
              <li key={person.id} className="flex flex-wrap items-center gap-3 px-4 py-2">
                <Avatar user={person} size={30} />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5 truncate text-sm font-medium">
                    {person.name}
                    {PLACE[person.place] && (
                      <span className="rounded bg-accent-soft px-1.5 py-px text-[10px] font-semibold text-accent">{PLACE[person.place]}</span>
                    )}
                    {person.place === 'member' && person.teamLead && (
                      <span className="rounded bg-accent-soft px-1.5 py-px text-[10px] font-semibold text-accent">Team Lead</span>
                    )}
                    {suggested && (
                      <span className="rounded bg-pending-soft px-1.5 py-px text-[10px] font-semibold text-pending">Suggested</span>
                    )}
                  </p>
                  <p className="truncate text-xs text-muted">{[person.designation, person.employeeId].filter(Boolean).join(' · ')}</p>
                </div>
                {person.place === 'member' && (
                  <div className="-mt-1 flex w-full flex-wrap items-center gap-x-1 gap-y-2 pl-[42px]">
                    {/* Only the manager changes who someone reports to; until
                        then they stay where they are in the tree. */}
                    {!canChooseAssistant && (
                      <span className="mr-2 text-xs text-muted">
                        Reports to {members.find((lead) => lead.id === person.reportsTo)?.name ?? 'the assistant manager'}
                      </span>
                    )}
                    {canChooseAssistant && (
                    <SelectBox
                      aria-label={`Who ${person.name} reports to`}
                      className="w-44"
                      value={person.reportsTo ?? ''}
                      disabled={arrange.isPending}
                      onChange={(event) => arrange.mutate({ person, change: { reportsTo: event.target.value || null } })}
                    >
                      {!above.some((lead) => lead.id === person.reportsTo) && <option value={person.reportsTo ?? ''}>Reports to nobody</option>}
                      {above
                        .filter((lead) => lead.id !== person.id)
                        .map((lead) => (
                          <option key={lead.id} value={lead.id}>
                            {`Reports to ${lead.name}`}
                          </option>
                        ))}
                    </SelectBox>
                    )}
                    {/* Someone who already leads a team stays a team lead. */}
                    <Button
                      variant="ghost"
                      className="h-8!"
                      disabled={arrange.isPending || person.teamLead}
                      title={person.teamLead ? 'Already a team lead' : undefined}
                      onClick={() => arrange.mutate({ person, change: { teamLead: true } })}
                    >
                      {person.teamLead ? 'Team lead' : 'Make team lead'}
                    </Button>
                    {canChooseAssistant && (
                      <Button
                        variant={suggested ? 'primary' : 'ghost'}
                        className="h-8!"
                        disabled={choose.isPending}
                        onClick={() => choose.mutate(person)}
                      >
                        Make assistant manager
                      </Button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : members.length ? (
        <p className="px-4 py-4 text-sm text-muted">Nobody matches.</p>
      ) : (
        <Empty title="Nobody yet">Share the join link to bring your team in.</Empty>
      )}
    </Panel>
  );
}

export default function DepartmentHome() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['department', id],
    queryFn: () => api.get(`/departments/${id}`),
  });
  // A manager sees every department here and switches between them; an
  // assistant manager has only their own.
  const { data: mine } = useQuery({ queryKey: ['my-departments'], queryFn: () => api.get('/departments/mine') });
  const choices = mine?.items ?? [];

  return (
    <div>
      <StickyTop>
        <PageHeading
          title={data?.department.name ?? 'Department'}
          actions={
            choices.length > 1 && (
              <SelectBox
                aria-label="Department"
                className="w-56"
                value={id}
                onChange={(event) => navigate(`${homeOf(user)}/my-department/${event.target.value}`)}
              >
                {choices.map((choice) => (
                  <option key={choice.id} value={choice.id}>
                    {choice.name}
                  </option>
                ))}
              </SelectBox>
            )
          }
        >
          {data
            ? [
                data.department.managerName && `Manager: ${data.department.managerName}`,
                data.department.location,
                `${data.members.length} in the team`,
              ]
                .filter(Boolean)
                .join(' · ')
            : ' '}
        </PageHeading>
      </StickyTop>

      {isPending && <RowsSkeleton rows={5} />}
      {isError && <LoadError error={error} onRetry={refetch} />}

      {data && (
        <div className="grid gap-4 md:h-[calc(100dvh-290px)] md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:h-[calc(100dvh-170px)]">
          <Reveal className="flex min-h-0 flex-col gap-4">
            {data.you.canInviteAssistant && <InviteAssistant id={id} pending={data.assistantInvite} />}
            <InviteTeam id={id} joinLink={data.joinLink} />
            <Requests id={id} requests={data.requests} />
          </Reveal>
          <Reveal delay={0.06} className="min-h-0">
            <Team
              id={id}
              members={data.members}
              canChooseAssistant={data.you.canChooseAssistant}
            />
          </Reveal>
        </div>
      )}
    </div>
  );
}
