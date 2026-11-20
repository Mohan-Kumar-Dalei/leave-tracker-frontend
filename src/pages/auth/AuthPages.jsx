import { CalendarCheck } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Logo } from '../../components/AppShell';
import { Button, PasswordInput, Reveal, TextInput } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { homeOf } from '../../lib/home';

// What the marquee on the sign-in page shows.
const MARQUEE_TOP = [
  'Apply in seconds',
  'Approve in one click',
  'Mails in our Leave Application format',
  'Balances update by themselves',
  'Who is away today',
  'Team calendar',
];
const MARQUEE_BOTTOM = [
  'Department tree',
  'Employee tree',
  'Join with one link',
  'Your own Gmail',
  'Manager, AM and team leads',
  'Leave totals for every department',
];

function Marquee({ items, reverse = false }) {
  // Two copies side by side; the strip slides one copy's width and repeats.
  return (
    <div className="relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
      <div className={`flex w-max gap-3 motion-reduce:animate-none ${reverse ? 'animate-marquee-back' : 'animate-marquee'}`}>
        {[...items, ...items].map((item, index) => (
          <span
            key={`${item}-${index}`}
            aria-hidden={index >= items.length}
            className="shrink-0 rounded-full border border-white/15 bg-white/[0.07] px-4 py-2 text-sm font-medium text-white/90 backdrop-blur"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

// The sign-in pages: on a big screen a dark brand panel on the left, with a
// marquee of what the app does running through its middle, and the form on
// the right; on a phone just the form.
export function AuthLayout({ title, intro, children }) {
  return (
    <main className="grid min-h-dvh lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <section
        aria-label="About Leave Tracker"
        className="relative hidden flex-col justify-between overflow-hidden bg-[#16204a] px-12 py-10 text-white lg:flex"
      >
        <div aria-hidden="true" className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-accent/40 blur-3xl" />
        <div aria-hidden="true" className="absolute -bottom-32 right-0 h-96 w-96 rounded-full bg-[#f2a93b]/25 blur-3xl" />
        <div className="relative flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-on-accent">
            <CalendarCheck className="h-5 w-5" strokeWidth={2.25} aria-hidden="true" />
          </span>
          <span className="text-lg font-semibold tracking-tight">Leave Tracker</span>
        </div>

        <div className="relative space-y-8">
          <div className="max-w-md">
            <p className="text-sm font-medium text-white/60">Contify, Bhubaneswar</p>
            <h2 className="mt-3 text-[40px] font-semibold leading-[1.08] tracking-[-0.03em] text-white">
              Leave, approvals and your whole team, in one calm place.
            </h2>
          </div>
          <div className="-mx-12 space-y-3">
            <Marquee items={MARQUEE_TOP} />
            <Marquee items={MARQUEE_BOTTOM} reverse />
          </div>
        </div>

        <p className="relative text-[13px] text-white/50">Every department, every request, one link.</p>

        {/* The join between the two halves: a soft wave instead of a straight
            line, with a faint blue edge, so the panel melts into the form. */}
        <svg
          aria-hidden="true"
          viewBox="0 0 120 900"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-y-0 -right-px h-full w-28 xl:w-36"
        >
          <path
            d="M120 0 H70 C20 140 105 260 55 420 C15 560 100 700 48 900 H120 Z"
            fill="var(--color-bg)"
          />
          <path
            d="M70 0 C20 140 105 260 55 420 C15 560 100 700 48 900"
            fill="none"
            stroke="var(--color-accent)"
            strokeOpacity="0.55"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M84 0 C34 150 118 270 70 430 C30 570 112 710 64 900"
            fill="none"
            stroke="var(--color-accent)"
            strokeOpacity="0.2"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </section>

      <section className="grid place-items-center px-4 py-10 sm:px-8">
        <Reveal className="w-full max-w-[400px]">
          <div className="mb-8 flex justify-center lg:hidden">
            <Logo />
          </div>
          <h1 className="text-2xl tracking-tight sm:text-[28px]">{title}</h1>
          {intro && <p className="mt-2 text-sm text-muted">{intro}</p>}
          <div className="mt-7">{children}</div>
        </Reveal>
      </section>
    </main>
  );
}

export const FormError = ({ message }) =>
  message ? (
    <p role="alert" className="rounded-lg bg-rejected-soft px-3 py-2 text-[13px] text-rejected">
      {message}
    </p>
  ) : null;

export const authLink = 'text-[13px] font-medium text-accent hover:underline underline-offset-4';

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
      const target = from && from !== '/' ? from : homeOf(user);
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
        <PasswordInput label="Password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
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
      <p className="mt-3 border-t border-line pt-4 text-center text-[13px] text-muted">
        Running a department?{' '}
        <Link to="/register" className={authLink}>
          Register
        </Link>
      </p>
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
        <PasswordInput label="New password" autoComplete="new-password" required minLength={10} value={password} onChange={(event) => setPassword(event.target.value)} />
        <PasswordInput label="Repeat password" autoComplete="new-password" required value={confirm} onChange={(event) => setConfirm(event.target.value)} />
        <FormError message={error} />
        <Button type="submit" loading={busy} className="h-10! w-full">
          Save password
        </Button>
      </form>
    </AuthLayout>
  );
}
