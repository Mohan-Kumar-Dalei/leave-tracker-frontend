import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, PasswordInput, TextInput } from '../../components/ui';
import { api } from '../../lib/api';
import { AuthLayout, authLink, FormError } from '../auth/AuthPages';

// Register on your own:
//   HR       the company's first HR registers and runs the organisation.
//            Closed once HR exists, so nobody else can make themselves HR.
//   Manager  a manager registers with the department they will run; HR
//            approves, then they invite their assistant manager, who brings in
//            the team with the department's join link.
// Everyone else joins with an invitation or a department's join link.

const PASSWORD_HINT = 'At least 10 characters, with a letter and a number.';

function Passwords({ value, onChange, mismatch }) {
  return (
    <>
      <PasswordInput
        label="Choose a password"
        hint={PASSWORD_HINT}
        autoComplete="new-password"
        required
        value={value.password}
        onChange={(event) => onChange({ ...value, password: event.target.value })}
      />
      <PasswordInput
        label="Type it again"
        autoComplete="new-password"
        required
        error={mismatch}
        value={value.confirm}
        onChange={(event) => onChange({ ...value, confirm: event.target.value })}
      />
    </>
  );
}

function Done({ title, children }) {
  return (
    <AuthLayout title={title}>
      <div className="space-y-4">
        <p className="rounded-lg bg-accent-soft px-3 py-2.5 text-sm">{children}</p>
        <Link to="/login" className="block">
          <Button className="h-10! w-full">Go to sign in</Button>
        </Link>
      </div>
    </AuthLayout>
  );
}

export default function Register() {
  const { data, isPending } = useQuery({ queryKey: ['setup'], queryFn: () => api.get('/join/setup'), retry: false });
  const [choice, setChoice] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', employeeId: '', phone: '', department: '', location: '' });
  const [passwords, setPasswords] = useState({ password: '', confirm: '' });
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  if (isPending) {
    return (
      <AuthLayout title="Register">
        <div className="h-40 animate-pulse rounded-xl bg-sunken motion-reduce:animate-none" />
      </AuthLayout>
    );
  }

  const ownerOpen = data && !data.ownerExists;
  const role = choice ?? (ownerOpen ? 'hr' : 'manager');
  const mismatch = passwords.confirm && passwords.password !== passwords.confirm ? 'The two passwords are not the same.' : '';
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  if (done === 'hr') {
    return <Done title="You are registered as HR">Sign in to set up the organisation: add departments and invite their managers.</Done>;
  }
  if (done === 'manager') {
    return (
      <Done title="Request sent to HR">
        HR will approve {form.department}. Once they do, you get a mail and can sign in to invite your assistant manager.
      </Done>
    );
  }

  const submit = async (event) => {
    event.preventDefault();
    if (mismatch) return;
    setProblem('');
    setBusy(true);
    try {
      const fields = Object.fromEntries(Object.entries(form).filter(([, value]) => value.trim() !== ''));
      if (role === 'hr') {
        const { name, email, phone } = fields;
        await api.post('/join/owner', { name, email, ...(phone ? { phone } : {}), password: passwords.password });
      } else {
        await api.post('/join/manager', { ...fields, password: passwords.password });
      }
      setDone(role);
    } catch (issue) {
      setProblem(issue.message);
    } finally {
      setBusy(false);
    }
  };

  const tabs = [
    ...(ownerOpen ? [['hr', 'HR']] : []),
    ['manager', 'Manager'],
  ];

  return (
    <AuthLayout
      title={role === 'hr' ? `Set up ${data?.company ?? 'your company'}` : 'Register as a manager'}
      intro={
        role === 'hr'
          ? 'Register as HR to run the organisation. Only the first HR can register here.'
          : 'Register with the department you run. HR approves it, then you invite your assistant manager.'
      }
    >
      {tabs.length > 1 && (
        <div role="tablist" aria-label="Who is registering" className="mb-5 grid grid-cols-2 rounded-lg border border-line bg-bg p-1">
          {tabs.map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={role === key}
              onClick={() => {
                setChoice(key);
                setProblem('');
              }}
              className={`rounded-md py-1.5 text-sm font-medium transition-colors ${
                role === key ? 'bg-surface text-ink shadow-card' : 'text-muted hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={submit} className="space-y-4">
        <TextInput label="Full name" required minLength={2} maxLength={80} value={form.name} onChange={set('name')} />
        <TextInput label="Work email" type="email" autoComplete="username" required maxLength={160} value={form.email} onChange={set('email')} />
        {role === 'manager' ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput label="Employee ID" required maxLength={20} value={form.employeeId} onChange={set('employeeId')} />
              <TextInput label="Phone" maxLength={20} value={form.phone} onChange={set('phone')} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput
                label="Your department"
                required
                minLength={2}
                maxLength={60}
                placeholder="For example, 3PP"
                value={form.department}
                onChange={set('department')}
              />
              <TextInput label="Location" maxLength={60} placeholder={data?.location} value={form.location} onChange={set('location')} />
            </div>
          </>
        ) : (
          <TextInput label="Phone" maxLength={20} value={form.phone} onChange={set('phone')} />
        )}
        <Passwords value={passwords} onChange={setPasswords} mismatch={mismatch} />
        <FormError message={problem} />
        <Button type="submit" loading={busy} className="h-10! w-full">
          {role === 'hr' ? 'Register as HR' : 'Send to HR for approval'}
        </Button>
      </form>
      <p className="mt-4 text-center text-[13px] text-muted">
        Joining a team? Use the link your assistant manager sent you.{' '}
        <Link to="/login" className={authLink}>
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
