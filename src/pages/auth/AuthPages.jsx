import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Logo } from '../../components/AppShell';
import { Button, Reveal, TextInput } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';

function AuthLayout({ title, intro, children }) {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <Reveal className="w-full max-w-[400px]">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <div className="rounded-2xl border border-line bg-surface p-6 shadow-card sm:p-8">
          <h1 className="text-xl">{title}</h1>
          {intro && <p className="mt-1 text-sm text-muted">{intro}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </Reveal>
    </main>
  );
}

const FormError = ({ message }) =>
  message ? (
    <p role="alert" className="rounded-lg bg-rejected-soft px-3 py-2 text-[13px] text-rejected">
      {message}
    </p>
  ) : null;

const authLink = 'text-[13px] font-medium text-accent hover:underline underline-offset-4';

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
    <AuthLayout title="Sign in" intro="Welcome back. Use your work email.">
      <form onSubmit={submit} className="space-y-4">
        <TextInput label="Email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} />
        <TextInput label="Password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
        <FormError message={error} />
        <Button type="submit" loading={busy} className="h-10! w-full">
          Sign in
        </Button>
      </form>
      <div className="mt-4 text-center">
        <Link to="/forgot-password" className={authLink}>
          Forgot your password?
        </Link>
      </div>
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
        <p className="rounded-lg bg-accent-soft px-3 py-2.5 text-sm">{sent}</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <TextInput label="Email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} />
          <FormError message={error} />
          <Button type="submit" loading={busy} className="h-10! w-full">
            Send reset link
          </Button>
        </form>
      )}
      <div className="mt-4 text-center">
        <Link to="/login" className={authLink}>
          Back to sign in
        </Link>
      </div>
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
        <Button type="submit" loading={busy} className="h-10! w-full">
          Save password
        </Button>
      </form>
    </AuthLayout>
  );
}
