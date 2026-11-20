import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Avatar } from '../../components/ProfilePhoto';
import {
  Button,
  ConfirmDialog,
  Dialog,
  Empty,
  LoadError,
  PageHeading,
  Panel,
  Reveal,
  RowsSkeleton,
  SelectBox,
  SelectField,
  StickyTop,
  TextInput,
} from '../../components/ui';
import { AddEmployeeDialog } from '../../components/AddEmployeeDialog';
import { SegmentedTabs } from '../../components/Tabs';
import { api } from '../../lib/api';
import { useToast } from '../../lib/toast';

// The organisation, run by the managers (HR is turned off for now), kept simple like
// Zoho: a Departments list (name, manager, assistant manager, how many
// employees) and an Employees list where each person's department can be
// changed. Adding a department invites its manager by mail; the manager then
// brings in the team from the department's own page. It stands apart from the
// leave tracker for now.

const sameName = (a = '', b = '') => a.localeCompare(b, 'en', { sensitivity: 'accent' }) === 0;

const TABS = [
  ['departments', 'Departments'],
  ['employees', 'Employees'],
];

const cell = 'px-4 py-3 text-left align-middle';
const head = `${cell} text-xs font-medium uppercase tracking-wide text-muted`;

function Person({ person, sub }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <Avatar user={person} size={30} />
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{person.name}</span>
        {sub && <span className="block truncate text-xs text-muted">{sub}</span>}
      </span>
    </span>
  );
}

// Someone in a department's place, or the person invited to it.
function RoleCell({ person, invited }) {
  if (person) return <Person person={person} sub={person.designation} />;
  if (invited) {
    return (
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{invited.name}</span>
        <span className="mt-0.5 inline-flex rounded bg-pending-soft px-1.5 py-px text-[10px] font-semibold text-pending">
          Invited
        </span>
      </span>
    );
  }
  return <span className="text-muted">-</span>;
}

// All of a department's assistant managers. One shows as usual; two or more
// stack in a compact list, smaller, so the row stays short.
function AssistantsCell({ department }) {
  const list = department.assistants ?? (department.lead ? [department.lead] : []);
  if (list.length <= 1) return <RoleCell person={list[0]} invited={department.invited.assistant} />;
  return (
    <ul className="flex min-w-0 flex-col gap-1.5" aria-label={`${list.length} assistant managers`}>
      {list.map((person) => (
        <li key={person.id} className="flex min-w-0 items-center gap-2">
          <Avatar user={person} size={24} />
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-medium leading-4">{person.name}</span>
            <span className="block truncate text-[11px] leading-4 text-muted">{person.designation}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

const STEPS = ['Department', 'Manager', 'Assistant Manager', 'Invitation'];

// "Add department" in four steps: the name, the manager's name, the assistant
// manager's name and the assistant manager's email, where the invitation goes.
// The assistant manager registers first and then brings in the team from
// My department. The manager is only a name on the department.
// A manager adding a department runs it themselves, so their own name is the
// manager and nobody else is invited for that step.
function AddDepartmentWizard({ company, you, onClose }) {
  const owner = you?.owner !== false;
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    name: '',
    location: '',
    managerName: owner ? '' : you.name,
    assistantName: '',
    assistantEmail: '',
  });
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState('');
  const queryClient = useQueryClient();
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  const create = useMutation({
    mutationFn: () => {
      const body = Object.fromEntries(Object.entries(form).filter(([, value]) => value.trim() !== ''));
      if (!owner) {
        delete body.managerName;
        delete body.managerEmail;
      }
      return api.post('/org/departments', { location: company.location, ...body });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['organisation'] });
      setResult(data);
    },
    onError: (issue) => setError(issue.message),
  });

  const copy = async (link) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(link);
    } catch {
      setCopied('');
    }
  };

  if (result) {
    return (
      <Dialog open onClose={onClose} kind="modal" title="Department added" footer={<Button onClick={onClose}>Done</Button>}>
        <div className="space-y-4 text-sm">
          <p>
            <span className="font-medium">{result.department.name}</span> is ready.{' '}
            {result.invites.length ? 'The invitation went out:' : 'Nobody was invited yet.'}
          </p>
          {result.invites.map((item) => (
            <div key={item.email} className="space-y-2 rounded-lg bg-sunken p-3">
              <p>
                <span className="font-medium">{item.name}</span>, {item.role === 'manager' ? 'Manager' : 'Assistant Manager'}
                <span className="block text-[13px] text-muted">{item.email}</span>
              </p>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={item.link}
                  aria-label={`Invitation link for ${item.name}`}
                  onFocus={(event) => event.target.select()}
                  className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-surface px-2.5 text-xs text-muted"
                />
                <Button variant="secondary" onClick={() => copy(item.link)}>
                  {copied === item.link ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </div>
          ))}
          <p className="text-[13px] text-muted">
            Once the assistant manager signs up, they share the department&apos;s join link with the team and approve people
            as they join. The link above also works if the mail does not arrive.
          </p>
        </div>
      </Dialog>
    );
  }

  const last = step === STEPS.length - 1;
  const next = (event) => {
    event.preventDefault();
    setError('');
    if (last) create.mutate();
    else setStep(step + 1);
  };

  return (
    <Dialog
      open
      onClose={onClose}
      kind="modal"
      title="Add department"
      footer={
        <>
          {step > 0 && (
            <Button variant="ghost" className="mr-auto" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="department-wizard" loading={create.isPending}>
            {last ? 'Send invitation' : 'Next'}
          </Button>
        </>
      }
    >
      <ol className="mb-5 flex items-center gap-1.5" aria-label="Steps">
        {STEPS.map((label, index) => (
          <li key={label} className="flex flex-1 items-center gap-1.5" aria-current={index === step ? 'step' : undefined}>
            <span
              className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-semibold ${
                index <= step ? 'bg-accent text-on-accent' : 'bg-sunken text-muted'
              }`}
            >
              {index + 1}
            </span>
            {index < STEPS.length - 1 && <span className={`h-0.5 flex-1 rounded ${index < step ? 'bg-accent' : 'bg-line'}`} />}
          </li>
        ))}
      </ol>
      <p className="mb-4 text-sm font-semibold">
        Step {step + 1} of {STEPS.length}: {STEPS[step]}
      </p>

      <form id="department-wizard" className="space-y-4" onSubmit={next}>
        {step === 0 && (
          <>
            <TextInput
              key="name"
              label="Department name"
              required
              minLength={2}
              maxLength={60}
              placeholder="For example, 3PP"
              value={form.name}
              onChange={set('name')}
              data-autofocus
            />
            <TextInput label="Location" maxLength={60} placeholder={company.location} value={form.location} onChange={set('location')} />
          </>
        )}
        {step === 1 && !owner && (
          <TextInput key="manager" label="Manager" hint="You manage the departments you add." disabled value={you.name} />
        )}
        {step === 1 && owner && (
          <>
            <TextInput
              key="manager"
              label="Manager's full name"
              hint="The manager approves the assistant manager's leave."
              required
              minLength={2}
              maxLength={80}
              value={form.managerName}
              onChange={set('managerName')}
            />
            <TextInput
              label="Manager's email"
              hint="Optional. With an email they get an invitation and their own admin panel; you can also invite them later."
              type="email"
              maxLength={160}
              value={form.managerEmail ?? ''}
              onChange={set('managerEmail')}
            />
          </>
        )}
        {step === 2 && (
          <TextInput
            key="assistant"
            label="Assistant manager's full name"
            hint="They register first, run the department and bring in the team."
            required
            minLength={2}
            maxLength={80}
            value={form.assistantName}
            onChange={set('assistantName')}
          />
        )}
        {step === 3 && (
          <>
            <TextInput
              key="email"
              label="Assistant manager's email"
              hint={`The invitation for ${form.assistantName || 'the assistant manager'} goes here.`}
              type="email"
              required
              maxLength={160}
              value={form.assistantEmail}
              onChange={set('assistantEmail')}
            />
            <dl className="space-y-1.5 rounded-lg bg-sunken p-3 text-[13px]">
              {[
                ['Department', `${form.name}${form.location ? `, ${form.location}` : ''}`],
                ['Manager', form.managerName],
                ['Assistant manager', form.assistantName],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3">
                  <dt className="text-muted">{label}</dt>
                  <dd className="truncate text-right font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
        {error && <p className="text-sm text-rejected">{error}</p>}
      </form>
    </Dialog>
  );
}

// Managers who registered on their own, for an existing manager to
// approve (which sets up the department) or turn down.
function ManagerRequests({ requests }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const decide = useMutation({
    mutationFn: ({ request, decision }) => api.post(`/org/manager-requests/${request.id}/${decision}`),
    onSuccess: (_data, { request, decision }) => {
      queryClient.invalidateQueries({ queryKey: ['organisation'] });
      toast.success(
        decision === 'approve' ? `${request.departmentName} is set up` : 'Request turned down',
        decision === 'approve' ? `${request.name} can sign in and invite their assistant manager.` : undefined,
      );
    },
    onError: (issue) => toast.error('Could not do that', issue.message),
  });
  if (!requests?.length) return null;

  return (
    <Panel className="mb-4">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold">Managers waiting for approval</h2>
        <span className="grid h-6 min-w-6 place-items-center rounded-md bg-pending-soft px-1.5 text-xs font-medium tabular-nums text-pending">
          {requests.length}
        </span>
      </div>
      <ul className="divide-y divide-line">
        {requests.map((request) => (
          <li key={request.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {request.name} <span className="font-normal text-muted">wants to set up</span> {request.departmentName}
              </p>
              <p className="truncate text-xs text-muted">
                {[request.email, request.employeeId, request.location].filter(Boolean).join(' · ')}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" disabled={decide.isPending} onClick={() => decide.mutate({ request, decision: 'reject' })}>
                Reject
              </Button>
              <Button disabled={decide.isPending} onClick={() => decide.mutate({ request, decision: 'approve' })}>
                Approve
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

// Managers first (the usual department leads), then everyone by name.
const isManager = (person) => /manager|head|director|lead/i.test(person.designation ?? '');
const leadChoices = (people) =>
  [...people].sort((a, b) => Number(isManager(b)) - Number(isManager(a)) || a.name.localeCompare(b.name));

// Managers first, then everyone else by name.
const managerChoices = (people) =>
  [...people].sort(
    (a, b) =>
      Number(/manager/i.test(b.designation) && !/assistant/i.test(b.designation)) -
        Number(/manager/i.test(a.designation) && !/assistant/i.test(a.designation)) || a.name.localeCompare(b.name),
  );

function DepartmentForm({ department, people, company, onClose }) {
  const editing = Boolean(department.id);
  const [form, setForm] = useState({
    name: department.name ?? '',
    location: department.location ?? '',
    lead: department.lead?.id ?? '',
    manager: department.manager?.id ?? '',
  });
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const queryClient = useQueryClient();
  const toast = useToast();

  const done = (title) => {
    queryClient.invalidateQueries({ queryKey: ['organisation'] });
    queryClient.invalidateQueries({ queryKey: ['team'] });
    toast.success(title);
    onClose();
  };
  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name,
        location: form.location || company.location,
        lead: form.lead || null,
        // The manager is one of the people, like Rajesh Sir for Content
        // Integration; sent only when it changes.
        ...((department.manager?.id ?? '') !== form.manager ? { manager: form.manager || null } : {}),
      };
      return editing ? api.patch(`/org/departments/${department.id}`, body) : api.post('/org/departments', body);
    },
    onSuccess: () => done(editing ? 'Department saved' : 'Department added'),
    onError: (issue) => setError(issue.message),
  });
  const remove = useMutation({
    mutationFn: () => api.delete(`/org/departments/${department.id}`),
    onSuccess: () => done('Department removed'),
    onError: (issue) => {
      setConfirmDelete(false);
      setError(issue.message);
    },
  });

  return (
    <Dialog
      open
      onClose={onClose}
      kind="modal"
      title={editing ? 'Edit department' : 'Add department'}
      footer={
        <>
          {editing && (
            <Button
              variant="ghost"
              className="mr-auto text-rejected hover:text-rejected"
              disabled={department.people > 0}
              title={department.people > 0 ? 'Move its employees out first' : undefined}
              onClick={() => setConfirmDelete(true)}
            >
              Delete
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="department-form" loading={save.isPending}>
            {editing ? 'Save' : 'Add'}
          </Button>
        </>
      }
    >
      <form
        id="department-form"
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          setError('');
          save.mutate();
        }}
      >
        <TextInput
          label="Department name"
          required
          minLength={2}
          maxLength={60}
          placeholder="For example, Sales"
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
          data-autofocus
        />
        <SelectField
          label="Manager"
          hint="Shown above the assistant manager in the tree, and approves their leave."
          value={form.manager}
          onChange={(event) => setForm({ ...form, manager: event.target.value })}
        >
          <option value="">{department.managerName ? `No account yet (${department.managerName})` : 'No manager'}</option>
          {managerChoices(people).map((person) => (
            <option key={person.id} value={person.id}>
              {`${person.name} · ${person.designation}${person.employeeId ? ` (${person.employeeId})` : ''}`}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Assistant manager"
          value={form.lead}
          onChange={(event) => setForm({ ...form, lead: event.target.value })}
        >
          <option value="">{department.invited?.assistant ? `Invited: ${department.invited.assistant.name}` : 'No assistant manager'}</option>
          {leadChoices(people).map((person) => (
            <option key={person.id} value={person.id}>
              {`${person.name} · ${person.designation}${person.employeeId ? ` (${person.employeeId})` : ''}`}
            </option>
          ))}
        </SelectField>
        <p className="-mt-2 text-[13px] text-muted">
          Managers are at the top. The assistant manager runs the department and approves the team.
        </p>
        <TextInput
          label="Location"
          maxLength={60}
          placeholder={company.location}
          value={form.location}
          onChange={(event) => setForm({ ...form, location: event.target.value })}
        />
        {editing && department.people > 0 && (
          <p className="text-[13px] text-muted">
            A department can be deleted once it has no employees. Move them from the Employees tab.
          </p>
        )}
        {error && <p className="text-sm text-rejected">{error}</p>}
      </form>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Delete ${department.name}?`}
        body="It has no employees, so nobody is affected."
        confirmLabel="Delete"
        danger
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
    </Dialog>
  );
}

function ManagerCell({ department }) {
  if (department.manager) return <RoleCell person={department.manager} />;
  if (department.managerName) return <span className="text-sm font-medium">{department.managerName}</span>;
  return <span className="text-muted">-</span>;
}

// On a phone each department is a small card: name, manager, every assistant
// manager, and the people count, with Open and Edit.
function DepartmentCards({ departments, onEdit, onShowPeople }) {
  return (
    <ul className="divide-y divide-line sm:hidden">
      {departments.map((department) => (
        <li key={department.id} className="space-y-3 px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Link to={`/departments/${department.id}`} className="font-medium hover:text-accent">
                {department.name}
              </Link>
              <span className="block text-xs text-muted">{department.location || 'No location'}</span>
            </div>
            <button
              type="button"
              onClick={() => onShowPeople(department.name)}
              className="shrink-0 rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold tabular-nums text-accent"
            >
              {department.people} people
            </button>
          </div>
          <dl className="grid grid-cols-[88px_minmax(0,1fr)] items-start gap-x-3 gap-y-2.5">
            <dt className="pt-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Manager</dt>
            <dd className="min-w-0">
              <ManagerCell department={department} />
            </dd>
            <dt className="pt-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Asst. managers</dt>
            <dd className="min-w-0">
              <AssistantsCell department={department} />
            </dd>
          </dl>
          <div className="flex gap-2">
            <Link
              to={`/departments/${department.id}`}
              className="inline-flex h-9 flex-1 items-center justify-center rounded-lg bg-accent-soft text-sm font-medium text-accent"
            >
              Open
            </Link>
            <Button variant="ghost" className="flex-1" onClick={() => onEdit(department)}>
              Edit
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function DepartmentsTable({ departments, onEdit, onShowPeople }) {
  if (!departments.length) return <Empty title="No departments yet">Add the first one to start.</Empty>;
  return (
    <>
      <DepartmentCards departments={departments} onEdit={onEdit} onShowPeople={onShowPeople} />
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-line bg-bg/60">
            <tr>
              <th className={head}>Department</th>
              <th className={head}>Manager</th>
              <th className={head}>Assistant managers</th>
              <th className={`${head} text-right`}>Employees</th>
              <th className={head}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {departments.map((department) => (
              <tr key={department.id} className="hover:bg-bg/60">
                <td className={cell}>
                  <Link to={`/departments/${department.id}`} className="font-medium hover:text-accent hover:underline underline-offset-4">
                    {department.name}
                  </Link>
                  <span className="block text-xs text-muted">{department.location || 'No location'}</span>
                  {department.waiting > 0 && (
                    <span className="mt-1 inline-flex rounded bg-pending-soft px-1.5 py-px text-[10px] font-semibold text-pending">
                      {department.waiting} waiting to join
                    </span>
                  )}
                </td>
                <td className={cell}>
                  <ManagerCell department={department} />
                </td>
                <td className={cell}>
                  <AssistantsCell department={department} />
                </td>
                <td className={`${cell} text-right`}>
                  <button
                    type="button"
                    onClick={() => onShowPeople(department.name)}
                    className="font-medium tabular-nums text-accent underline-offset-4 hover:underline"
                  >
                    {department.people}
                  </button>
                </td>
                <td className={`${cell} w-0 whitespace-nowrap text-right`}>
                  <Link
                    to={`/departments/${department.id}`}
                    className="inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium text-accent hover:bg-accent-soft"
                  >
                    Open
                  </Link>
                  <Button variant="ghost" onClick={() => onEdit(department)}>
                    Edit
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function EmployeesTable({ people, departments, filter, onFilter }) {
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();
  const toast = useToast();

  const move = useMutation({
    mutationFn: ({ person, department }) => api.patch(`/org/people/${person.id}`, { department: department.id }),
    onSuccess: (_data, { person, department }) => {
      queryClient.invalidateQueries({ queryKey: ['organisation'] });
      queryClient.invalidateQueries({ queryKey: ['team'] });
      toast.success('Department changed', `${person.name} is now in ${department.name}.`);
    },
    onError: (issue) => toast.error('Could not change the department', issue.message),
  });

  const query = search.trim().toLowerCase();
  const shown = people.filter(
    (person) =>
      (!filter || sameName(person.department, filter)) &&
      `${person.name} ${person.employeeId ?? ''}`.toLowerCase().includes(query),
  );

  return (
    <>
      <div className="flex flex-wrap gap-3 border-b border-line p-3">
        <label className="relative min-w-56 flex-1 sm:max-w-sm">
          <span className="sr-only">Search employees</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            type="search"
            maxLength={80}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name or ID"
            className="h-10 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-base placeholder:text-muted focus:border-accent focus:outline-none sm:text-sm"
          />
        </label>
        <div className="w-full sm:w-56">
          <SelectBox aria-label="Filter by department" className="w-full" value={filter} onChange={(event) => onFilter(event.target.value)}>
            <option value="">All departments</option>
            {departments.map((department) => (
              <option key={department.id} value={department.name}>
                {department.name}
              </option>
            ))}
          </SelectBox>
        </div>
      </div>
      {shown.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-line bg-bg/60">
              <tr>
                <th className={head}>Employee</th>
                <th className={head}>Designation</th>
                <th className={`${head} w-64`}>Department</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {shown.map((person) => {
                const current = departments.find((department) => sameName(department.name, person.department));
                return (
                  <tr key={person.id} className="hover:bg-bg/60">
                    <td className={cell}>
                      <Person person={person} sub={person.employeeId} />
                    </td>
                    <td className={`${cell} text-muted`}>{person.designation || '-'}</td>
                    <td className={cell}>
                      <SelectBox
                        aria-label={`Department of ${person.name}`}
                        className="w-full"
                        value={current?.id ?? ''}
                        onChange={(event) => {
                          const department = departments.find((item) => item.id === event.target.value);
                          if (department && department.id !== current?.id) move.mutate({ person, department });
                        }}
                      >
                        {departments.map((department) => (
                          <option key={department.id} value={department.id}>
                            {department.name}
                          </option>
                        ))}
                      </SelectBox>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty title="Nobody matches">Try another name or department.</Empty>
      )}
    </>
  );
}

export default function Organisation() {
  const { data, isPending, isError, error, refetch } = useQuery({ queryKey: ['organisation'], queryFn: () => api.get('/org') });
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'employees' ? 'employees' : 'departments';
  const filter = params.get('department') ?? '';
  const [editing, setEditing] = useState(null);
  const [addingPerson, setAddingPerson] = useState(false);
  const [addingDepartment, setAddingDepartment] = useState(false);

  const go = (next, department = '') =>
    setParams(next === 'departments' ? {} : { tab: next, ...(department ? { department } : {}) }, { replace: true });

  // The main button follows the tab, like Zoho: departments or employees.
  const action =
    tab === 'employees' ? (
      <Button onClick={() => setAddingPerson(true)} disabled={!data?.departments.length}>
        Add employee
      </Button>
    ) : (
      <Button onClick={() => setAddingDepartment(true)}>Add department</Button>
    );

  return (
    <div>
      <StickyTop>
        <PageHeading title="Organisation" actions={action}>
          {data ? `${data.company.name} · ${data.departments.length} departments · ${data.people.length} employees` : ' '}
        </PageHeading>
        <SegmentedTabs label="Organisation view" tabs={TABS} value={tab} onChange={go} />
      </StickyTop>

      {isPending && <RowsSkeleton rows={5} />}
      {isError && <LoadError error={error} onRetry={refetch} />}

      {data && (
        <Reveal>
          <ManagerRequests requests={data.managerRequests} />
          <Panel>
            {tab === 'departments' ? (
              <DepartmentsTable
                departments={data.departments}
                onEdit={setEditing}
                onShowPeople={(name) => go('employees', name)}
              />
            ) : (
              <EmployeesTable
                people={data.people}
                departments={data.departments}
                filter={filter}
                onFilter={(name) => go('employees', name)}
              />
            )}
          </Panel>
        </Reveal>
      )}

      {editing && data && (
        <DepartmentForm
          key={editing.id ?? 'new'}
          department={editing}
          people={data.people}
          company={data.company}
          onClose={() => setEditing(null)}
        />
      )}
      {addingDepartment && data && <AddDepartmentWizard company={data.company} you={data.you} onClose={() => setAddingDepartment(false)} />}
      {addingPerson && data && (
        <AddEmployeeDialog
          departments={data.departments}
          defaultDepartment={data.departments.find((department) => sameName(department.name, filter))?.id}
          canMakeAssistant
          onClose={() => setAddingPerson(false)}
        />
      )}
    </div>
  );
}
