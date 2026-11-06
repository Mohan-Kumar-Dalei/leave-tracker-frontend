import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Dialog, Empty, LoadError, PageHeading, Pagination, Panel, PasswordInput, Reveal, RowsSkeleton, SelectBox, TextInput } from '../../components/ui';
import { api, toQuery } from '../../lib/api';
import { useToast } from '../../lib/toast';

const BLANK = { name: '', email: '', employeeId: '', department: '', designation: '', joinedOn: '', password: '' };

function AddEmployee({ open, onClose }) {
  const [form, setForm] = useState(BLANK);
  const [error, setError] = useState('');
  const queryClient = useQueryClient();
  const toast = useToast();

  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  const create = useMutation({
    mutationFn: () => {
      const body = Object.fromEntries(Object.entries(form).filter(([, value]) => value !== ''));
      return api.post('/admin/employees', body);
    },
    onSuccess: ({ user }) => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success(
        'Employee added',
        form.password ? `${user.name} can sign in with the password you set.` : `A set password link was sent to ${user.email}.`,
      );
      setForm(BLANK);
      onClose();
    },
    onError: (issue) => setError(issue.message),
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add an employee"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="add-employee" loading={create.isPending}>
            {form.password ? 'Add employee' : 'Add and send invite'}
          </Button>
        </>
      }
    >
      <form
        id="add-employee"
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          setError('');
          create.mutate();
        }}
      >
        <TextInput label="Full name" required maxLength={80} value={form.name} onChange={set('name')} />
        <TextInput label="Work email" type="email" required maxLength={160} value={form.email} onChange={set('email')} hint="The invite link goes here." />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput label="Employee ID" required maxLength={20} value={form.employeeId} onChange={set('employeeId')} />
          <TextInput label="Joining date" type="date" value={form.joinedOn} onChange={set('joinedOn')} />
          <TextInput label="Department" maxLength={60} value={form.department} onChange={set('department')} />
          <TextInput label="Designation" maxLength={80} value={form.designation} onChange={set('designation')} />
        </div>
        <PasswordInput
          label="Password"
            autoComplete="new-password"
            minLength={10}
            maxLength={72}
            value={form.password}
            onChange={set('password')}
            hint="At least 10 characters, with a letter and a number. Leave it empty to mail them a link instead."
          />
        {error && (
          <p role="alert" className="text-sm text-rejected">
            {error}
          </p>
        )}
      </form>
    </Dialog>
  );
}

export default function Employees() {
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('active');
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['employees', q, status, page],
    queryFn: () => api.get(`/admin/employees${toQuery({ q, status, page, limit: 200 })}`),
    placeholderData: keepPreviousData,
  });

  return (
    <div>
      <PageHeading title="Employees" actions={<Button onClick={() => setAdding(true)}>Add employee</Button>}>
        {data ? `${data.total} ${data.total === 1 ? 'employee' : 'employees'}. ` : ''}
        Add employees, correct balances and turn off access when someone leaves.
      </PageHeading>

      <Reveal delay={0.08}>
        <div className="mb-4 flex flex-wrap gap-3">
          <label className="relative min-w-56 flex-1 sm:max-w-sm">
            <span className="sr-only">Search employees</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input
              type="search"
              maxLength={80}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, email, ID or department"
              className="min-h-11 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-base placeholder:text-muted focus:border-accent focus:outline-none sm:text-sm"
            />
          </label>
          <SelectBox
            aria-label="Filter by status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            className="w-full sm:w-48"
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="all">All employees</option>
          </SelectBox>
        </div>

        <Panel>
          {isPending && <RowsSkeleton />}
          {isError && <LoadError error={error} onRetry={refetch} />}
          {data?.items.length === 0 && <Empty title="Nobody matches that">Try a different search.</Empty>}
          <ul>
            {data?.items.map((person) => (
              <li key={person.id} className="border-b border-line last:border-b-0">
                <Link
                  to={`/admin/employees/${person.id}`}
                  className="grid gap-x-6 gap-y-0.5 px-4 py-3 text-sm transition-colors hover:bg-bg sm:px-5 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_100px] md:items-center"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{person.name}</span>
                    <span className="block truncate text-muted">{person.email}</span>
                  </span>
                  <span className="text-muted md:text-ink">{person.department || 'No department'}</span>
                  <span className="text-muted">{person.designation || 'No designation'}</span>
                  <span className="tabular-nums text-muted md:text-right">
                    {person.isActive ? person.employeeId : 'Inactive'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {data && <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} />}
        </Panel>
      </Reveal>

      <AddEmployee open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}
