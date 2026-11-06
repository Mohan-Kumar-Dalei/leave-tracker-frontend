import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Stamp } from '../../components/Stamp';
import { Button, Reveal, TextInput } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';

const SAMPLE_ROWS = [
  ['02 Nov', 'Casual Leave', '1 day', 'approved'],
  ['14 Sep', 'Ganesh Chaturthi', 'Restricted', 'approved'],
  ['27 Aug', 'Sick Leave', '2 days', 'rejected'],
];

function AuthLayout({ title, intro, children }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <aside className="hidden flex-col justify-between bg-ink p-12 text-bg lg:flex">
        <p className="font-display text-[22px]">Leave Tracker</p>
        <div>
          <h2 className="max-w-lg text-[56px]">Every leave, written down in one place.</h2>
          <div className="mt-10 max-w-lg rounded border border-muted bg-surface text-ink">
            {SAMPLE_ROWS.map(([date, name, length, status]) => (
              <div key={name} className="flex items-center justify-between gap-4 border-b border-line px-4 py-3 last:border-b-0">
                <div className="min-w-0 text-sm">
                  <p className="font-medium">{name}</p>
                  <p className="tabular-nums text-muted">
                    {date}, {length}
                  </p>
                </div>
                <Stamp status={status} />
              </div>
            ))}
          </div>
        </div>
        <p className="text-sm text-line">Balances, requests and holidays for your whole team.</p>
      </aside>

      <main className="flex items-center justify-center px-5 py-12">
        <Reveal className="w-full max-w-sm">
          <p className="mb-10 font-display text-[22px] lg:hidden">Leave Tracker</p>
          <h1 className="text-[40px]">{title}</h1>
          {intro && <p className="mt-3 text-base text-muted">{intro}</p>}
          <div className="mt-8">{children}</div>
        </Reveal>
      </main>
    </div>
  );
}

const FormError = ({ message }) =>
  message ? (
    <p role="alert" className="text-sm text-rejected">
      {message}
    </p>
  ) : null;

export function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const user = await signIn({ email: email.trim(), password });
      const from = location.state?.from;
      const target = from && from !== '/' ? from : user.role === 'admin' ? '/admin' : '/';
      navigate(target, { replace: true });
    } catch (issue) {
      setError(issue.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Sign in" intro="Use the work email your admin added.">
      <form onSubmit={submit} className="space-y-4">
        <TextInput label="Email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} />
        <TextInput label="Password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
        <FormError message={error} />
        <Button type="submit" loading={busy} className="w-full">
          Sign in
        </Button>
      </form>
      <Link to="/forgot-password" className="mt-5 inline-block text-sm text-accent underline-offset-4 hover:underline">
        Forgot your password?
      </Link>
    </AuthLayout>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data = await api.post('/auth/forgot-password', { email: email.trim() });
      setSent(data.message);
    } catch (issue) {
      setError(issue.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Reset your password" intro="We will mail you a link to choose a new one.">
      {sent ? (
        <p className="rounded bg-sunken px-4 py-3 text-sm">{sent}</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <TextInput label="Email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} />
          <FormError message={error} />
          <Button type="submit" loading={busy} className="w-full">
            Send reset link
          </Button>
        </form>
      )}
      <Link to="/login" className="mt-5 inline-block text-sm text-accent underline-offset-4 hover:underline">
        Back to sign in
      </Link>
    </AuthLayout>
  );
}

export function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      navigate('/login', { replace: true });
    } catch (issue) {
      setError(issue.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Choose a password" intro="At least 10 characters, with a letter and a number.">
      <form onSubmit={submit} className="space-y-4">
        <TextInput label="New password" type="password" autoComplete="new-password" required minLength={10} value={password} onChange={(event) => setPassword(event.target.value)} />
        <TextInput label="Repeat password" type="password" autoComplete="new-password" required value={confirm} onChange={(event) => setConfirm(event.target.value)} />
        <FormError message={error} />
        <Button type="submit" loading={busy} className="w-full">
          Save password
        </Button>
      </form>
    </AuthLayout>
  );
}
