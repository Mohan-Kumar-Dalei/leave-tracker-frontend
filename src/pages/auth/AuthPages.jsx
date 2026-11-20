import { ArrowRight, CalendarCheck, Check, Mail, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Logo } from '../../components/AppShell';
import { Button, PasswordInput, Reveal, TextInput } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { homeOf } from '../../lib/home';

// What the strip at the foot of the sign-in panel shows.
const MARQUEE = [
  'Apply in seconds',
  'Approve in one click',
  'Leave Application mails',
  'Balances update by themselves',
  'Team calendar',
  'Department and employee trees',
  'Join with one link',
  'Your own Gmail',
  'Leave totals by month',
];

function Marquee() {
  // Two copies side by side; the strip slides one copy's width and repeats.
  return (
    <div className="relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
      <div className="flex w-max animate-marquee items-center gap-6 motion-reduce:animate-none">
        {[...MARQUEE, ...MARQUEE].map((item, index) => (
          <span key={`${item}-${index}`} aria-hidden={index >= MARQUEE.length} className="flex shrink-0 items-center gap-6 text-sm text-white/60">
            {item}
            <span className="h-1 w-1 rounded-full bg-white/30" />
          </span>
        ))}
      </div>
    </div>
  );
}

// A glass card for the preview stack on the sign-in panel.
function Glass({ className = '', children }) {
  return (
    <div
      className={`absolute rounded-2xl border border-white/15 bg-white/[0.08] p-4 text-white shadow-[0_24px_60px_-20px_rgb(0_0_0/0.55)] backdrop-blur-xl ${className}`}
    >
      {children}
    </div>
  );
}

// A glimpse of the app floating on the panel: a balance, an approval and the
// week ahead.
function Preview() {
  const week = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  return (
    <div aria-hidden="true" className="relative h-[290px] w-full max-w-[460px]">
      <Glass className="left-0 top-4 w-64 animate-float motion-reduce:animate-none">
        <span className="text-xs text-white/60">Casual / Sick leave</span>
        <p className="mt-2 text-3xl font-semibold tabular-nums">
          9<span className="text-base font-medium text-white/50"> / 12 left</span>
        </p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-3/4 rounded-full bg-[linear-gradient(90deg,#5b8cff,#8fb3ff)]" />
        </div>
      </Glass>

      <Glass className="right-0 top-0 w-60 animate-float [animation-delay:1.2s] motion-reduce:animate-none">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-400/20 text-emerald-300">
            <Check className="h-4 w-4" strokeWidth={3} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium">Leave approved</p>
            <p className="mt-0.5 text-xs text-white/60">28 Dec, full day. The reply went out by mail.</p>
          </div>
        </div>
      </Glass>

      <Glass className="bottom-0 left-16 w-72 animate-float [animation-delay:2.4s] motion-reduce:animate-none">
        <p className="text-xs text-white/60">This week</p>
        <div className="mt-3 grid grid-cols-7 gap-1.5 text-center text-[11px]">
          {week.map((day, index) => (
            <span key={`${day}-${index}`} className="text-white/45">
              {day}
            </span>
          ))}
          {[21, 22, 23, 24, 25, 26, 27].map((date, index) => (
            <span
              key={date}
              className={`grid h-7 place-items-center rounded-lg tabular-nums ${
                index === 3 ? 'bg-accent font-semibold text-white' : index >= 5 ? 'text-rose-300/80' : 'bg-white/[0.06] text-white/80'
              }`}
            >
              {date}
            </span>
          ))}
        </div>
      </Glass>
    </div>
  );
}

// The edge of the sign-in panel: its last strip breaks up into calendar
// tiles, solid at first and fewer towards the form, so the navy dissolves into
// the light side. It is a mask on the panel itself, so every tile is exactly
// the panel's colour, and nothing reaches into the form. A few tiles are
// marked like booked leave (blue) and holidays (amber). The pattern is fixed
// (a small hash), not random on each visit.
const PITCH = 15;
const TILE_COLUMNS = 14;
// The gap between tiles grows column by column, from none (solid panel) to
// 5px, so there is no line where the tiles begin.
const gapAt = (col) => Math.min(5, col * 0.75);
const sizeAt = (col) => PITCH - gapAt(col);
const TILE_ROWS = 72;
const STRIP = TILE_COLUMNS * PITCH;
const hash = (col, row) => (Math.imul(col + 1, 73856093) ^ Math.imul(row + 7, 19349663)) >>> 0;
const TILES = [];
for (let row = 0; row < TILE_ROWS; row += 1) {
  for (let col = 0; col < TILE_COLUMNS; col += 1) {
    const keep = col < 3 ? 1 : 1 - ((col - 2.5) / (TILE_COLUMNS - 2)) ** 0.7;
    if ((hash(col, row) % 1000) / 1000 > keep) continue;
    const mark = hash(row, col) % 100;
    TILES.push({ col, row, kind: col >= 5 && mark < 6 ? 'leave' : col >= 5 && mark < 9 ? 'holiday' : 'day' });
  }
}
const TILE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="${STRIP}" height="${TILE_ROWS * PITCH}">${TILES.map(
  ({ col, row }) => {
    const size = sizeAt(col);
    const offset = gapAt(col) / 2;
    const round = Math.min(3, col * 0.6);
    return `<rect x="${col * PITCH + offset}" y="${row * PITCH + offset}" width="${size}" height="${size}" rx="${round}"/>`;
  },
).join('')}</svg>`;
const TILE_MASK = `url("data:image/svg+xml,${encodeURIComponent(TILE_SVG)}")`;
// Three layers, added together: the panel, a soft fade over the start of the
// strip (so the panel stays solid there and the gaps open slowly), and the tiles.
const FADE = 'linear-gradient(to right, #000 0%, #000 22%, rgb(0 0 0 / 0.55) 42%, transparent 70%)';
const PANEL_MASK = {
  maskImage: `linear-gradient(#000, #000), ${FADE}, ${TILE_MASK}`,
  maskSize: `calc(100% - ${STRIP}px + 1px) 100%, ${STRIP}px 100%, ${STRIP}px ${TILE_ROWS * PITCH}px`,
  maskPosition: '0 0, 100% 0, 100% 0',
  maskRepeat: 'no-repeat, no-repeat, repeat-y',
  WebkitMaskImage: `linear-gradient(#000, #000), ${FADE}, ${TILE_MASK}`,
  WebkitMaskSize: `calc(100% - ${STRIP}px + 1px) 100%, ${STRIP}px 100%, ${STRIP}px ${TILE_ROWS * PITCH}px`,
  WebkitMaskPosition: '0 0, 100% 0, 100% 0',
  WebkitMaskRepeat: 'no-repeat, no-repeat, repeat-y',
};

// The marked tiles, laid on the same grid at the panel's right edge.
function MarkedTiles() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 overflow-hidden" style={{ width: STRIP }}>
      {TILES.filter((tile) => tile.kind !== 'day').map(({ col, row, kind }, index) => (
        <span
          key={`${col}-${row}`}
          className={`absolute rounded-[3px] ${
            kind === 'leave'
              ? 'animate-twinkle bg-accent shadow-[0_0_10px_var(--color-accent)] motion-reduce:animate-none'
              : 'bg-[#f2a93b]'
          }`}
          style={{
            left: col * PITCH + gapAt(col) / 2,
            top: row * PITCH + gapAt(col) / 2,
            width: sizeAt(col),
            height: sizeAt(col),
            animationDelay: kind === 'leave' ? `${(index % 11) * 0.3}s` : undefined,
          }}
        />
      ))}
    </div>
  );
}

// The sign-in pages. On a laptop: a deep navy panel on the left with an
// aurora glow, the app's promise and a glimpse of it, joined to the form by an
// edge of calendar tiles; on a phone just the form.
export function AuthLayout({ title, intro, children }) {
  return (
    <main className="grid min-h-dvh bg-bg lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <section
        aria-label="About Leave Tracker"
        className="aurora-bg relative hidden flex-col overflow-hidden pb-8 pl-12 pr-48 pt-10 text-white lg:flex xl:pl-16"
        style={PANEL_MASK}
      >
        <MarkedTiles />
        {/* Aurora and a faint dot grid behind everything. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.18] [background-image:radial-gradient(rgb(255_255_255/0.35)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_at_30%_40%,black,transparent_75%)]"
        />

        <div className="relative flex items-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[linear-gradient(135deg,#5b8cff,#2f5bea)] shadow-[0_10px_30px_-10px_#5b8cff]">
            <CalendarCheck className="h-5 w-5" strokeWidth={2.25} aria-hidden="true" />
          </span>
          <span className="text-lg font-semibold tracking-tight">Leave Tracker</span>
          <span className="ml-2 rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[11px] font-medium text-white/70">Contify</span>
        </div>

        <div className="relative my-auto space-y-10 py-10">
          <div className="max-w-lg">
            <h2 className="text-[44px] font-semibold leading-[1.05] tracking-[-0.035em] text-white xl:text-[52px]">
              Leave, approvals and your team,{' '}
              <span className="bg-[linear-gradient(90deg,#8fb3ff,#c7b8ff_50%,#ffd59a)] bg-clip-text text-transparent">in one calm place.</span>
            </h2>
            <p className="mt-4 max-w-md text-base leading-relaxed text-white/65">
              Apply in seconds, approve in one click and always know who is away, for every department.
            </p>
          </div>
          <Preview />
        </div>

        <div className="relative -ml-12 xl:-ml-16">
          <Marquee />
        </div>

      </section>

      <section className="relative grid place-items-center px-5 py-12 sm:px-10">
        <div aria-hidden="true" className="absolute right-0 top-0 h-72 w-72 rounded-full bg-accent/10 blur-[90px] lg:hidden" />
        <Reveal className="relative w-full max-w-[420px]">
          <div className="mb-10 flex justify-center lg:hidden">
            <Logo />
          </div>
          <h1 className="text-[28px] font-semibold tracking-[-0.02em] sm:text-[32px]">{title}</h1>
          {intro && <p className="mt-2 text-[15px] leading-relaxed text-muted">{intro}</p>}
          <div className="mt-8 [&_input]:h-11 [&_input]:rounded-xl">{children}</div>
          <p className="mt-10 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Encrypted passwords
            </span>
            <span className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" aria-hidden="true" />
              Mail from your own Gmail
            </span>
          </p>
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
    <AuthLayout title="Welcome back" intro="Sign in with your work email to see your leave and your team.">
      <form onSubmit={submit} className="space-y-5">
        <TextInput label="Work email" type="email" autoComplete="username" placeholder="name@contify.com" required value={email} onChange={(event) => setEmail(event.target.value)} />
        <div className="space-y-2">
          <PasswordInput label="Password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
          <div className="text-right">
            <Link to="/forgot-password" className={authLink}>
              Forgot password?
            </Link>
          </div>
        </div>
        <FormError message={error} />
        <Button
          type="submit"
          loading={busy}
          className="group h-12! w-full rounded-xl! text-[15px]! shadow-[0_14px_30px_-12px_var(--color-accent)]"
        >
          Sign in
          <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </Button>
      </form>
      <div className="my-7 flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-line" />
        New here?
        <span className="h-px flex-1 bg-line" />
      </div>
      <Link
        to="/register"
        className="flex h-12 items-center justify-center rounded-xl border border-line bg-surface text-sm font-medium text-ink shadow-card transition-colors hover:border-accent/40 hover:bg-accent-soft"
      >
        Register as a department manager
      </Link>
      <p className="mt-3 text-center text-[13px] text-muted">Joining a team? Use the link your assistant manager sent you.</p>
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
