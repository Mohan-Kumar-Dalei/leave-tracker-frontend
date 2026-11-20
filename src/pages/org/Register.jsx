import { useQuery } from '@tanstack/react-query';
import { EmployeeIdField } from '../../components/EmployeeIdField';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, PasswordInput, TextInput } from '../../components/ui';
import { api } from '../../lib/api';
import { AuthLayout, authLink, FormError } from '../auth/AuthPages';

// Register on your own, as a manager, with the department you will run. The
// account is ready at once: sign in, invite your assistant manager (who brings
// in the team with the department's join link) and add more departments from
// Organisation. HR registration is closed for now. Everyone else joins with an
// invitation or a department's join link.

const STEPS = ['About you', 'Your department', 'Password'];

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
  const [form, setForm] = useState({ name: '', email: '', employeeId: '', phone: '', department: '', location: '' });
  const [passwords, setPasswords] = useState({ password: '', confirm: '' });
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [step, setStep] = useState(0);

  if (isPending) {
    return (
      <AuthLayout title="Register">
        <div className="h-40 animate-pulse rounded-xl bg-sunken motion-reduce:animate-none" />
      </AuthLayout>
    );
  }

  const mismatch = passwords.confirm && passwords.password !== passwords.confirm ? 'The two passwords are not the same.' : '';
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  if (done?.pending) {
    return (
      <Done title="Request sent">
        A manager will approve you for {done.department}. Once they do, you can sign in with this email and password.
      </Done>
    );
  }
  if (done) {
    return (
      <Done title="Your account is ready">
        {done.department} is set up and you are its manager{done.employeeId ? `, with employee ID ${done.employeeId}` : ''}. Sign in
        to invite your assistant manager and add more departments from Organisation.
      </Done>
    );
  }

  const next = (event) => {
    event.preventDefault();
    setProblem('');
    setStep(step + 1);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (mismatch) return;
    setProblem('');
    setBusy(true);
    try {
      const fields = Object.fromEntries(Object.entries(form).filter(([, value]) => value.trim() !== ''));
      setDone(await api.post('/join/manager', { ...fields, password: passwords.password }));
    } catch (issue) {
      setProblem(issue.message);
      // Send them back to the step the problem is about.
      if (/email|account/i.test(issue.message)) setStep(0);
      else if (/department|manager/i.test(issue.message)) setStep(1);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Register as a manager"
      intro="Register with the department you run. Once a manager approves you, sign in and invite your assistant manager."
    >
      {/* Three short steps, so the page never needs to scroll. */}
      <div className="mb-6">
        <div className="flex gap-1.5" aria-hidden="true">
          {STEPS.map((label, index) => (
            <span key={label} className={`h-1 flex-1 rounded-full transition-colors ${index <= step ? 'bg-accent' : 'bg-line'}`} />
          ))}
        </div>
        <p className="mt-2 flex items-center justify-between text-[13px] text-muted">
          <span>
            Step {step + 1} of {STEPS.length}: <span className="font-medium text-ink">{STEPS[step]}</span>
          </span>
          {step > 0 && (
            <button type="button" onClick={() => setStep(step - 1)} className={authLink}>
              Back
            </button>
          )}
        </p>
      </div>
      <form onSubmit={step === STEPS.length - 1 ? submit : next} className="space-y-4">
        {step === 0 && (
          <>
            <TextInput key="name" label="Full name" required minLength={2} maxLength={80} value={form.name} onChange={set('name')} data-autofocus />
            <TextInput label="Work email" type="email" autoComplete="username" required maxLength={160} value={form.email} onChange={set('email')} />
            <div className="grid gap-4 sm:grid-cols-2">
              <EmployeeIdField hint="Yours once you register" />
              <TextInput label="Phone" maxLength={20} value={form.phone} onChange={set('phone')} />
            </div>
          </>
        )}
        {step === 1 && (
          <>
            <TextInput
              key="department"
              label="Your department"
              required
              minLength={2}
              maxLength={60}
              placeholder="For example, 3PP"
              value={form.department}
              onChange={set('department')}
              hint="A new department, or one that has no manager yet."
            />
            <TextInput label="Location" maxLength={60} placeholder={data?.location} value={form.location} onChange={set('location')} />
          </>
        )}
        {step === 2 && <Passwords value={passwords} onChange={setPasswords} mismatch={mismatch} />}
        <FormError message={problem} />
        <Button type="submit" loading={busy} className="h-12! w-full rounded-xl! text-[15px]!">
          {step === STEPS.length - 1 ? 'Register' : 'Next'}
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
