import {
  ArrowRight,
  BellRing,
  Building2,
  CalendarDays,
  Check,
  Inbox,
  Link2,
  Mail,
  Network,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
  Wallet,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Logo } from '../components/AppShell';
import { Reveal } from '../components/ui';
import { useAuth } from '../lib/auth';
import { homeOf } from '../lib/home';

// The public page at the app's address: what Leave Tracker does for the team,
// how a company gets set up, and the way in (sign in or register).

const FEATURES = [
  {
    icon: CalendarDays,
    title: 'Apply in seconds',
    text: 'Pick the type and dates. Working days are counted for you, Sundays and holidays skipped, and the mail is written in your usual Leave Application format.',
  },
  {
    icon: Mail,
    title: 'Approve by mail or app',
    text: 'The request reaches the right person from your own Gmail. They approve or reject in one click, and the reply goes back to you, with Reply all when it matters.',
  },
  {
    icon: Wallet,
    title: 'Balances that add up',
    text: 'Casual, sick, earned, comp off and restricted holidays, each with what is left. Every change has a reason, and every number matches the record.',
  },
  {
    icon: Network,
    title: 'Departments and teams',
    text: 'Department and employee trees, Zoho style, show who reports to whom. Each department sees its own people and leave.',
  },
  {
    icon: BellRing,
    title: 'Everyone in the loop',
    text: 'Live notifications, a team calendar with holidays marked, and the next 14 days of leave on the overview, pending or approved.',
  },
  {
    icon: ShieldCheck,
    title: 'Safe by design',
    text: 'Encrypted passwords, signed-in pages only, nobody approves their own leave, and nobody joins a department without approval.',
  },
];

const STEPS = [
  { icon: UserRound, who: 'Manager', title: 'Registers with a department', text: 'Signs up with the department they run, and it is ready at once.' },
  { icon: Building2, who: 'Manager', title: 'Organises the company', text: 'Adds more departments in four steps and invites each one’s assistant manager.' },
  { icon: Inbox, who: 'Assistant manager', title: 'Runs the department', text: 'Shares the join link, approves people as they arrive, and decides the team’s leave.' },
  { icon: Link2, who: 'Team', title: 'Joins with one link', text: 'Fills in their details, gets the next employee ID, and starts applying for leave.' },
];

const ROLES = [
  {
    title: 'Employee',
    path: '/employee/CON-030',
    points: ['Apply and track leave', 'Balances and holidays', 'Your department at a glance'],
  },
  {
    title: 'Assistant manager',
    path: '/employee/assistantmanager/CON-001',
    points: ['Approve the team’s leave', 'Invite and approve joiners', 'Calendar, CSV and balances'],
  },
  {
    title: 'Manager',
    path: '/employee/manager/CON-031',
    points: ['Add departments and their AMs', 'Approve the assistant manager', 'See every department they run'],
  },
];

function ButtonLink({ to, children, variant = 'primary', className = '' }) {
  const look =
    variant === 'primary'
      ? 'bg-accent text-on-accent shadow-[0_8px_24px_-10px_var(--color-accent)] hover:bg-accent-deep'
      : 'border border-line bg-surface text-ink hover:bg-bg';
  return (
    <Link
      to={to}
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition-colors ${look} ${className}`}
    >
      {children}
    </Link>
  );
}

// A small picture of the app: a balance, a request waiting for a decision and
// the coming days, built from the app's own colours.
function Preview() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return (
    <div className="relative mx-auto w-full max-w-[460px]">
      <div aria-hidden="true" className="absolute -inset-6 -z-10 rounded-[2rem] bg-accent/15 blur-3xl" />
      <div className="rounded-2xl border border-line bg-surface p-4 shadow-float">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Good morning, Asha</p>
          <span className="rounded-lg bg-accent px-2.5 py-1 text-xs font-semibold text-on-accent">Apply Leave</span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2.5">
          {[
            ['Casual / Sick', '8', 'left'],
            ['Restricted', '2', 'left'],
            ['Comp off', '1', 'left'],
          ].map(([label, value, unit]) => (
            <div key={label} className="rounded-xl border border-line bg-bg p-3">
              <p className="truncate text-[11px] text-muted">{label}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-approved">
                {value} <span className="text-[11px] font-normal text-muted">{unit}</span>
              </p>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-xl border border-line p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">Amit Rout · Casual Leave</p>
              <p className="truncate text-xs text-muted">Fri 20 Nov, 1 day · Demo Team · To: Sita Das</p>
            </div>
            <span className="shrink-0 rounded bg-pending-soft px-1.5 py-px text-[10px] font-semibold text-pending">Pending</span>
          </div>
          <div className="mt-3 flex gap-2">
            <span className="flex-1 rounded-lg bg-accent py-1.5 text-center text-xs font-semibold text-on-accent">Approve</span>
            <span className="flex-1 rounded-lg border border-line py-1.5 text-center text-xs font-medium">Reject</span>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-7 gap-1.5">
          {days.map((day, index) => (
            <div
              key={day}
              className={`rounded-lg py-2 text-center text-[11px] ${
                index === 6
                  ? 'bg-rejected-soft text-rejected'
                  : index === 4
                    ? 'bg-pending-soft font-semibold text-pending'
                    : index === 2
                      ? 'bg-accent-soft font-semibold text-accent'
                      : 'bg-bg text-muted'
              }`}
            >
              {day}
            </div>
          ))}
        </div>
      </div>
      <div className="absolute -bottom-5 -left-4 hidden items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-float sm:flex">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-approved-soft text-approved">
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
        Leave approved, mail sent
      </div>
    </div>
  );
}

export default function Landing() {
  const { user } = useAuth();
  const home = user ? homeOf(user) : null;

  return (
    <div className="min-h-dvh overflow-x-hidden bg-bg text-ink">
      {/* Soft light behind the top of the page, and a faint grid. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[720px] overflow-hidden">
        <div className="absolute left-1/2 top-[-220px] h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-accent/20 blur-3xl" />
        <div className="absolute right-[-120px] top-[180px] h-[320px] w-[320px] rounded-full bg-pending/15 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--color-line)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-line)_1px,transparent_1px)] bg-[size:56px_56px] opacity-40 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_70%)]" />
      </div>

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <nav aria-label="Page" className="hidden items-center gap-7 text-sm text-muted md:flex">
          <a href="#features" className="hover:text-ink">Features</a>
          <a href="#how" className="hover:text-ink">How it works</a>
          <a href="#roles" className="hover:text-ink">Roles</a>
        </nav>
        <div className="flex items-center gap-2">
          {home ? (
            <ButtonLink to={home}>
              Open my dashboard <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </ButtonLink>
          ) : (
            <>
              <Link to="/login" className="hidden h-11 items-center rounded-xl px-4 text-sm font-semibold hover:bg-surface sm:inline-flex">
                Sign in
              </Link>
              <ButtonLink to="/register">Get started</ButtonLink>
            </>
          )}
        </div>
      </header>

      <main className="relative z-10">
        <section className="mx-auto grid max-w-6xl items-center gap-14 px-4 pb-20 pt-10 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-16">
          <Reveal>
            <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/80 px-3 py-1 text-xs font-medium text-muted backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
              Built for Contify teams
            </p>
            <h1 className="mt-5 text-[40px] font-semibold leading-[1.05] tracking-[-0.03em] sm:text-[56px]">
              Leave, approvals and your whole team, <span className="text-accent">in one calm place.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
              Apply in seconds, approve in one click and always know who is away. Every department runs its own team,
              and each manager organises the departments they run.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {home ? (
                <ButtonLink to={home}>
                  Open my dashboard <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </ButtonLink>
              ) : (
                <>
                  <ButtonLink to="/login">
                    Sign in <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </ButtonLink>
                  <ButtonLink to="/register" variant="secondary">
                    Register as a manager
                  </ButtonLink>
                </>
              )}
            </div>
            <dl className="mt-10 grid max-w-md grid-cols-3 gap-6">
              {[
                ['5', 'leave types'],
                ['1 click', 'to approve'],
                ['0', 'sheets to update'],
              ].map(([value, label]) => (
                <div key={label}>
                  <dt className="sr-only">{label}</dt>
                  <dd className="text-2xl font-semibold tabular-nums tracking-tight">{value}</dd>
                  <dd className="text-xs text-muted">{label}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
          <Reveal delay={0.1}>
            <Preview />
          </Reveal>
        </section>

        <section id="features" className="mx-auto max-w-6xl scroll-mt-8 px-4 py-20 sm:px-6">
          <Reveal className="max-w-2xl">
            <p className="text-sm font-semibold text-accent">Features</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">Everything leave needs, nothing it doesn’t</h2>
            <p className="mt-3 text-muted">From the first request to the year-end balance, without a spreadsheet in sight.</p>
          </Reveal>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature, index) => (
              <Reveal key={feature.title} delay={0.04 * index}>
                <article className="group h-full rounded-2xl border border-line bg-surface p-6 shadow-card transition-transform duration-300 hover:-translate-y-1 hover:shadow-float">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent-soft text-accent transition-colors group-hover:bg-accent group-hover:text-on-accent">
                    <feature.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-5 text-base">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{feature.text}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        <section id="how" className="scroll-mt-8 border-y border-line bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <Reveal className="max-w-2xl">
              <p className="text-sm font-semibold text-accent">How it works</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">Up and running in four steps</h2>
              <p className="mt-3 text-muted">Nobody types in a whole team by hand. Each person brings in the next.</p>
            </Reveal>
            <ol className="relative mt-12 grid gap-8 md:grid-cols-4 md:gap-6">
              <span aria-hidden="true" className="absolute left-0 right-0 top-6 hidden h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent md:block" />
              {STEPS.map((step, index) => (
                <Reveal key={step.who} delay={0.06 * index}>
                  <li className="relative">
                    <span className="relative grid h-12 w-12 place-items-center rounded-2xl bg-accent text-on-accent shadow-[0_10px_24px_-10px_var(--color-accent)]">
                      <step.icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted">
                      {index + 1}. {step.who}
                    </p>
                    <h3 className="mt-1 text-base">{step.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted">{step.text}</p>
                  </li>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        <section id="roles" className="mx-auto max-w-6xl scroll-mt-8 px-4 py-20 sm:px-6">
          <Reveal className="max-w-2xl">
            <p className="text-sm font-semibold text-accent">Roles</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">The right view for everyone</h2>
            <p className="mt-3 text-muted">After you sign in, your own address opens with your employee ID.</p>
          </Reveal>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ROLES.map((role, index) => (
              <Reveal key={role.title} delay={0.05 * index}>
                <article className="flex h-full flex-col rounded-2xl border border-line bg-surface p-6 shadow-card">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-sunken text-accent">
                    <Users className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 text-base">{role.title}</h3>
                  <code className="mt-2 block truncate rounded-lg bg-bg px-2 py-1 text-[11px] text-muted">{role.path}</code>
                  <ul className="mt-4 space-y-2 text-sm">
                    {role.points.map((point) => (
                      <li key={point} className="flex gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-approved" aria-hidden="true" />
                        <span className="text-muted">{point}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
          <Reveal>
            <div className="relative overflow-hidden rounded-3xl bg-accent px-6 py-14 text-center text-on-accent sm:px-12">
              <div aria-hidden="true" className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
              <div aria-hidden="true" className="absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
              <h2 className="relative text-3xl font-semibold tracking-[-0.02em] text-on-accent sm:text-4xl">Ready when your team is</h2>
              <p className="relative mx-auto mt-3 max-w-xl text-on-accent/85">
                Sign in with your work email, or register as a department manager to set up your team.
              </p>
              <div className="relative mt-8 flex flex-wrap justify-center gap-3">
                <Link
                  to={home ?? '/login'}
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-accent hover:bg-white/90"
                >
                  {home ? 'Open my dashboard' : 'Sign in'} <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                {!home && (
                  <Link
                    to="/register"
                    className="inline-flex h-11 items-center rounded-xl border border-white/40 px-5 text-sm font-semibold text-on-accent hover:bg-white/10"
                  >
                    Register
                  </Link>
                )}
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="relative z-10 border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-muted sm:px-6">
          <Logo />
          <p>Leave Tracker for Contify, Bhubaneswar</p>
        </div>
      </footer>
    </div>
  );
}
