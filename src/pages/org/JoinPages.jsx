import { useQuery } from '@tanstack/react-query';
import { EmployeeIdField } from '../../components/EmployeeIdField';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button, PasswordInput, TextInput } from '../../components/ui';
import { api } from '../../lib/api';
import { AuthLayout, authLink, FormError } from '../auth/AuthPages';

// Pages opened before anyone has an account:
//   AcceptInvite    the owner's invitation to a department's manager or
//                   assistant manager; they create their account.
//   JoinDepartment  the department's join link; anyone can ask to join, and
//                   the manager or assistant manager approves them.

const PASSWORD_HINT = 'At least 10 characters, with a letter and a number.';

function Loading() {
  return <div className="h-48 animate-pulse rounded-xl bg-sunken motion-reduce:animate-none" aria-label="Loading" />;
}

function Problem({ error }) {
  return (
    <AuthLayout title="This link does not work" intro={error.message}>
      <Link to="/login" className={authLink}>
        Go to sign in
      </Link>
    </AuthLayout>
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

// Checks the two passwords match before sending.
function usePasswords() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const mismatch = confirm && password !== confirm ? 'The two passwords are not the same.' : '';
  return { password, setPassword, confirm, setConfirm, mismatch };
}

export function AcceptInvite() {
  const { token } = useParams();
  const { data, error, isPending } = useQuery({
    queryKey: ['invite', token],
    queryFn: () => api.get(`/join/invite/${token}`),
    retry: false,
  });
  const [form, setForm] = useState({ name: '', employeeId: '', phone: '' });
  const passwords = usePasswords();
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  if (isPending) return <AuthLayout title="Opening your invitation"><Loading /></AuthLayout>;
  if (error) return <Problem error={error} />;
  if (done) {
    return (
      <Done title="Your account is ready">
        You are the {done.role} of {done.department}. Sign in with {done.email} and the password you chose.
      </Done>
    );
  }

  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });
  const submit = async (event) => {
    event.preventDefault();
    if (passwords.mismatch) return;
    setProblem('');
    setBusy(true);
    try {
      const body = { name: form.name || data.name, password: passwords.password };
      if (form.phone) body.phone = form.phone;
      setDone(await api.post(`/join/invite/${token}`, body));
    } catch (issue) {
      setProblem(issue.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title={`Join ${data.department} as ${data.roleName}`}
      intro={`${data.company} has invited you. Create your account to start.`}
    >
      <form onSubmit={submit} className="space-y-4">
        <TextInput label="Work email" value={data.email} disabled readOnly />
        <TextInput label="Full name" required minLength={2} maxLength={80} defaultValue={data.name} onChange={set('name')} />
        <div className="grid gap-4 sm:grid-cols-2">
          <EmployeeIdField />
          <TextInput label="Phone" maxLength={20} value={form.phone} onChange={set('phone')} />
        </div>
        <PasswordInput
          label="Choose a password"
          hint={PASSWORD_HINT}
          autoComplete="new-password"
          required
          value={passwords.password}
          onChange={(event) => passwords.setPassword(event.target.value)}
        />
        <PasswordInput
          label="Type it again"
          autoComplete="new-password"
          required
          error={passwords.mismatch}
          value={passwords.confirm}
          onChange={(event) => passwords.setConfirm(event.target.value)}
        />
        <FormError message={problem} />
        <Button type="submit" loading={busy} className="h-10! w-full">
          Create my account
        </Button>
      </form>
    </AuthLayout>
  );
}

export function JoinDepartment() {
  const { code } = useParams();
  const { data, error, isPending } = useQuery({
    queryKey: ['join', code],
    queryFn: () => api.get(`/join/${code}`),
    retry: false,
  });
  const [form, setForm] = useState({ name: '', email: '', employeeId: '', phone: '', designation: '' });
  const passwords = usePasswords();
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (isPending) return <AuthLayout title="Opening the link"><Loading /></AuthLayout>;
  if (error) return <Problem error={error} />;
  if (done) {
    return (
      <Done title="Request sent">
        Your request to join {data.department} is with your manager. You can sign in once they approve it; you will get a
        mail.
      </Done>
    );
  }

  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });
  const submit = async (event) => {
    event.preventDefault();
    if (passwords.mismatch) return;
    setProblem('');
    setBusy(true);
    try {
      const body = Object.fromEntries(Object.entries(form).filter(([, value]) => value.trim() !== ''));
      await api.post(`/join/${code}`, { ...body, password: passwords.password });
      setDone(true);
    } catch (issue) {
      setProblem(issue.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title={`Join ${data.department}`} intro={`${data.company}${data.location ? `, ${data.location}` : ''}. Fill in your details; your manager will approve you.`}>
      <form onSubmit={submit} className="space-y-4">
        <TextInput label="Full name" required minLength={2} maxLength={80} value={form.name} onChange={set('name')} />
        <TextInput label="Work email" type="email" autoComplete="username" required maxLength={160} value={form.email} onChange={set('email')} />
        <div className="grid gap-4 sm:grid-cols-2">
          <EmployeeIdField hint="Yours once approved" />
          <TextInput label="Phone" maxLength={20} value={form.phone} onChange={set('phone')} />
        </div>
        <TextInput
          label="Designation"
          maxLength={80}
          placeholder="For example, Analyst"
          value={form.designation}
          onChange={set('designation')}
        />
        <PasswordInput
          label="Choose a password"
          hint={PASSWORD_HINT}
          autoComplete="new-password"
          required
          value={passwords.password}
          onChange={(event) => passwords.setPassword(event.target.value)}
        />
        <PasswordInput
          label="Type it again"
          autoComplete="new-password"
          required
          error={passwords.mismatch}
          value={passwords.confirm}
          onChange={(event) => passwords.setConfirm(event.target.value)}
        />
        <FormError message={problem} />
        <Button type="submit" loading={busy} className="h-10! w-full">
          Ask to join
        </Button>
      </form>
      <div className="mt-4 text-center">
        <Link to="/login" className={authLink}>
          Already have an account? Sign in
        </Link>
      </div>
    </AuthLayout>
  );
}
