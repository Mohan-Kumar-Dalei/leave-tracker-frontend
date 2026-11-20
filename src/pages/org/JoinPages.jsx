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
// Both start with the person's Gmail App Password when the server keeps them.

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

const looksLikeAppPassword = (value) => /^[a-z]{16}$/i.test(String(value ?? '').replace(/\s+/g, ''));
const aboutAppPassword = (message = '') => /app password|gmail/i.test(message);

// Where the person is: step 1 (Gmail App Password) or step 2 (the account).
function StepBar({ step, onBack }) {
  const labels = ['Gmail App Password', 'Your account'];
  return (
    <div className="mb-5 space-y-2">
      <div className="flex gap-1.5" aria-hidden="true">
        {labels.map((label, index) => (
          <span key={label} className={`h-1 flex-1 rounded-full ${index <= step ? 'bg-accent' : 'bg-line'}`} />
        ))}
      </div>
      <p className="flex items-center justify-between text-[13px] text-muted">
        <span>
          Step {step + 1} of 2: <span className="font-medium text-ink">{labels[step]}</span>
        </span>
        {step > 0 && onBack && (
          <button type="button" onClick={onBack} className={authLink}>
            Back
          </button>
        )}
      </p>
    </div>
  );
}

// Step 1 for anyone invited by mail: their Gmail App Password, so leave mails
// go from their own Gmail. Google checks it when they finish; it then shows as
// connected on their Profile.
function AppPasswordStep({ email, onEmail, value, onChange, onNext, problem }) {
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        onNext();
      }}
    >
      <StepBar step={0} />
      <ol className="list-decimal space-y-1.5 rounded-lg bg-sunken py-3 pl-8 pr-3 text-[13px] leading-relaxed">
        <li>Turn on 2-Step Verification for {email || 'your Gmail'}.</li>
        <li>
          Open{' '}
          <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer noopener" className={authLink}>
            myaccount.google.com/apppasswords
          </a>{' '}
          and make one called Leave Tracker.
        </li>
        <li>Paste the 16 letters below.</li>
      </ol>
      {onEmail && (
        <TextInput label="Work email (Gmail)" type="email" autoComplete="username" required maxLength={160} value={email} onChange={onEmail} />
      )}
      <PasswordInput
        label="Gmail App Password"
        placeholder="abcd efgh ijkl mnop"
        autoComplete="off"
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
        hint="Checked with Google when you finish. Your leave mails then go from this Gmail."
      />
      <FormError message={problem} />
      <Button type="submit" className="h-10! w-full">
        Next
      </Button>
    </form>
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
  const [appPassword, setAppPassword] = useState('');
  const [step, setStep] = useState(0);

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
      if (data.appPassword) body.appPassword = appPassword;
      setDone(await api.post(`/join/invite/${token}`, body));
    } catch (issue) {
      setProblem(issue.message);
      if (data.appPassword && aboutAppPassword(issue.message)) setStep(0);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title={`Join ${data.department} as ${data.roleName}`}
      intro={`${data.company} has invited you. ${data.appPassword ? 'First connect your Gmail, then create your account.' : 'Create your account to start.'}`}
    >
      {data.appPassword && step === 0 ? (
        <AppPasswordStep
          email={data.email}
          value={appPassword}
          onChange={setAppPassword}
          problem={problem}
          onNext={() => {
            if (!looksLikeAppPassword(appPassword)) {
              setProblem('An App Password is 16 letters, shown by Google in four groups of four.');
              return;
            }
            setProblem('');
            setStep(1);
          }}
        />
      ) : (
      <form onSubmit={submit} className="space-y-4">
        {data.appPassword && <StepBar step={1} onBack={() => setStep(0)} />}
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
      )}
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
  const [appPassword, setAppPassword] = useState('');
  const [step, setStep] = useState(0);

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
      await api.post(`/join/${code}`, { ...body, password: passwords.password, ...(data.appPassword ? { appPassword } : {}) });
      setDone(true);
    } catch (issue) {
      setProblem(issue.message);
      if (data.appPassword && aboutAppPassword(issue.message)) setStep(0);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title={`Join ${data.department}`} intro={`${data.company}${data.location ? `, ${data.location}` : ''}. Fill in your details; your manager will approve you.`}>
      {data.appPassword && step === 0 ? (
        <AppPasswordStep
          email={form.email}
          onEmail={set('email')}
          value={appPassword}
          onChange={setAppPassword}
          problem={problem}
          onNext={() => {
            if (!looksLikeAppPassword(appPassword)) {
              setProblem('An App Password is 16 letters, shown by Google in four groups of four.');
              return;
            }
            setProblem('');
            setStep(1);
          }}
        />
      ) : (
      <form onSubmit={submit} className="space-y-4">
        {data.appPassword && <StepBar step={1} onBack={() => setStep(0)} />}
        <TextInput label="Full name" required minLength={2} maxLength={80} value={form.name} onChange={set('name')} />
        <TextInput
          label="Work email"
          type="email"
          autoComplete="username"
          required
          maxLength={160}
          value={form.email}
          onChange={set('email')}
          disabled={Boolean(data.appPassword)}
          hint={data.appPassword ? 'The Gmail from step 1.' : undefined}
        />
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
      )}
      <div className="mt-4 text-center">
        <Link to="/login" className={authLink}>
          Already have an account? Sign in
        </Link>
      </div>
    </AuthLayout>
  );
}
