import {
  ArrowRight,
  BellRing,
  Building2,
  CalendarDays,
  Check,
  Inbox,
  Link2,
  Lock,
  Mail,
  Network,
  ShieldCheck,
  Sparkles,
  UserRound,
  Wallet,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { MandalaCorner } from '../components/MandalaCorner';
import { Reveal } from '../components/ui';
import { useAuth } from '../lib/auth';
import { APP_NAME } from '../lib/brand';
import { homeOf } from '../lib/home';

// The public page at the app's address: what Leave Tracker does for the team,
// how a company gets set up, and the way in (sign in or register). Navy and
// brass like the sign-in page, with the Odisha mandala, and no gradients:
// depth comes from layered cards, hairline edges and shadows.

const NAVY = 'bg-[#0d1433]';
const BRASS = 'text-[#f2b54a]';

const STRIP = [
  'Casual leave',
  'Sick leave',
  'Earned leave',
  'Comp off',
  'Restricted holidays',
  'Team calendar',
  'Approve by mail',
  'Department trees',
  'Leave totals',
  'Live notifications',
];

const STEPS = [
  {
    icon: UserRound,
    who: 'Manager',
    title: 'Registers with a department',
    text: 'Signs up with the department they run, and it is ready at once.',
  },
  {
    icon: Building2,
    who: 'Manager',
    title: 'Organises the company',
    text: 'Adds departments in four steps and invites each one’s assistant manager.',
  },
  {
    icon: Inbox,
    who: 'Assistant manager',
    title: 'Runs the department',
    text: 'Shares the join link, approves people as they arrive and decides the team’s leave.',
  },
  {
    icon: Link2,
    who: 'Team',
    title: 'Joins with one link',
    text: 'Fills in their details, gets the next employee ID and starts applying.',
  },
];

const ROLES = [
  {
    title: 'Employee',
    opens: 'Opens on your leave dashboard',
    points: ['Apply and track leave', 'Balances and holidays', 'Your department at a glance'],
  },
  {
    title: 'Assistant manager',
    opens: 'Opens on your team’s overview',
    points: ['Approve the team’s leave', 'Invite and approve joiners', 'Calendar, totals and balances'],
    featured: true,
  },
  {
    title: 'Manager',
    opens: 'Opens on the whole company’s overview',
    points: ['Add departments and their AMs', 'Approve the assistant managers', 'See every department'],
  },
];

function Cta({ to, children, variant = 'brass', className = '' }) {
  const look = {
    brass: 'bg-[#f2b54a] text-[#1a1405] shadow-[inset_0_1px_0_rgb(255_255_255/0.4),0_14px_30px_-14px_#f2b54a] hover:bg-[#f7c869]',
    glass: 'border border-white/20 bg-white/[0.06] text-white hover:bg-white/[0.12]',
    accent:
      'bg-accent text-on-accent shadow-[inset_0_1px_0_rgb(255_255_255/0.2),0_12px_26px_-12px_var(--color-accent)] hover:bg-accent-deep',
  }[variant];
  return (
    <Link
      to={to}
      className={`inline-flex h-12 items-center justify-center gap-2 rounded-xl px-6 text-[15px] font-semibold transition-[background-color,transform] duration-150 active:translate-y-px ${look} ${className}`}
    >
      {children}
    </Link>
  );
}

function Mark({ light = false }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-on-accent shadow-[inset_0_1px_0_rgb(255_255_255/0.25)]">
        <CalendarDays className="h-[18px] w-[18px]" strokeWidth={2.25} aria-hidden="true" />
      </span>
      <span className={`text-[17px] font-semibold tracking-tight ${light ? 'text-white' : ''}`}>{APP_NAME}</span>
    </span>
  );
}

// The picture of the app in the hero: the dashboard card, with a month of
// the team calendar, an approval that just went out and who is away today
// floating around it.
function Showcase() {
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const away = { 4: 'leave', 10: 'leave', 11: 'leave', 17: 'holiday', 20: 'today', 25: 'holiday' };
  return (
    <div className="relative mx-auto h-[400px] w-full max-w-[520px] sm:h-[520px]">
      {/* The dashboard card */}
      <div className="absolute inset-x-0 top-4 mx-auto w-full rounded-[22px] border border-white/10 bg-white p-5 text-[#0d1326] shadow-[0_40px_80px_-30px_rgb(0_0_0/0.7)] sm:left-0 sm:right-auto sm:top-16 sm:w-[88%]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#c8902a]">Dashboard</p>
            <p className="mt-0.5 text-[15px] font-semibold">Good morning, Asha</p>
          </div>
          <span className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-on-accent">Apply Leave</span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2.5">
          {[
            ['Casual / Sick', 8, 12],
            ['Restricted', 2, 2],
            ['Comp off', 1, 2],
          ].map(([label, left, total]) => (
            <div key={label} className="rounded-xl border border-[#e2e6ee] bg-[#f6f7fb] p-3">
              <p className="truncate text-[11px] text-[#5a6377]">{label}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-[#0e7f56]">
                {left} <span className="text-[11px] font-normal text-[#5a6377]">left</span>
              </p>
              <span className="mt-2 block h-1 overflow-hidden rounded-full bg-[#e2e6ee]">
                <span className="block h-full rounded-full bg-[#0e7f56]" style={{ width: `${(left / total) * 100}%` }} />
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-xl border border-[#e2e6ee] p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#ecf1ff] text-[11px] font-semibold text-accent">
                AR
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">Amit Rout · Casual Leave</p>
                <p className="truncate text-xs text-[#5a6377]">Fri 20 Nov, 1 day · To: Sita Das</p>
              </div>
            </div>
            <span className="shrink-0 rounded-md bg-[#fef4e0] px-1.5 py-px text-[10px] font-semibold text-[#9a5b05]">Pending</span>
          </div>
          <div className="mt-3 flex gap-2">
            <span className="flex-1 rounded-lg bg-accent py-1.5 text-center text-xs font-semibold text-on-accent">Approve</span>
            <span className="flex-1 rounded-lg border border-[#e2e6ee] py-1.5 text-center text-xs font-medium">Reject</span>
          </div>
        </div>
      </div>

      {/* The month, top right */}
      <div className="absolute -right-3 bottom-0 hidden w-[190px] animate-float rounded-2xl border border-white/12 bg-[#18214a] p-3.5 text-white shadow-[0_24px_50px_-20px_rgb(0_0_0/0.7)] motion-reduce:animate-none sm:block">
        <p className="text-[11px] font-semibold text-white/70">November 2026</p>
        <div className="mt-2 grid grid-cols-7 gap-1 text-center text-[9px] text-white/40">
          {days.map((day, index) => (
            <span key={`${day}-${index}`}>{day}</span>
          ))}
          {Array.from({ length: 30 }, (_, index) => index + 1).map((date) => {
            const kind = away[date];
            const look =
              kind === 'today'
                ? 'bg-accent text-white'
                : kind === 'leave'
                  ? 'bg-[#f2b54a]/25 text-[#f7cd7d]'
                  : kind === 'holiday'
                    ? 'bg-[#f87171]/20 text-[#fca5a5]'
                    : 'text-white/70';
            return (
              <span key={date} className={`grid h-[18px] place-items-center rounded-[5px] text-[9px] tabular-nums ${look}`}>
                {date}
              </span>
            );
          })}
        </div>
      </div>

      {/* Approved, bottom left */}
      <div className="absolute bottom-0 left-2 flex animate-float items-center gap-2.5 rounded-2xl border border-white/12 bg-white px-3.5 py-2.5 text-[13px] text-[#0d1326] shadow-[0_24px_50px_-20px_rgb(0_0_0/0.7)] [animation-delay:-3s] motion-reduce:animate-none sm:-left-4 sm:bottom-12">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-[#e6f6ef] text-[#0e7f56]">
          <Check className="h-4 w-4" aria-hidden="true" />
        </span>
        <span>
          <span className="block font-semibold">Leave approved</span>
          <span className="block text-[11px] text-[#5a6377]">Reply sent from Gmail</span>
        </span>
      </div>

      {/* Away today, bottom right */}
      <div className="absolute -right-3 top-0 hidden animate-float items-center gap-3 rounded-2xl border border-white/12 bg-[#18214a] px-3.5 py-2.5 text-white shadow-[0_24px_50px_-20px_rgb(0_0_0/0.7)] [animation-delay:-5s] motion-reduce:animate-none sm:flex">
        <span className="flex -space-x-2">
          {['SD', 'MS', 'AR'].map((initials, index) => (
            <span
              key={initials}
              className={`grid h-7 w-7 place-items-center rounded-full text-[10px] font-semibold ring-2 ring-[#18214a] ${
                ['bg-accent', 'bg-[#f2b54a] text-[#1a1405]', 'bg-[#0e7f56]'][index]
              }`}
            >
              {initials}
            </span>
          ))}
        </span>
        <span className="text-[12px]">
          <span className="block font-semibold">3 away today</span>
          <span className="block text-white/55">Content Integration</span>
        </span>
      </div>
    </div>
  );
}

// The leave types and features, sliding past under the hero.
function Strip() {
  return (
    <div className={`${NAVY} border-y border-white/[0.07] py-4`}>
      <div className="relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
        <div className="flex w-max animate-marquee items-center gap-8 motion-reduce:animate-none">
          {[...STRIP, ...STRIP].map((item, index) => (
            <span
              key={`${item}-${index}`}
              aria-hidden={index >= STRIP.length}
              className="flex shrink-0 items-center gap-8 text-[13px] font-medium uppercase tracking-[0.14em] text-white/55"
            >
              {item}
              <span className={`text-[10px] ${BRASS}`}>✦</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function SectionHead({ eyebrow, title, children, center = false }) {
  return (
    <Reveal className={`max-w-2xl ${center ? 'mx-auto text-center' : ''}`}>
      <p
        className={`inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#c8902a] ${center ? 'justify-center' : ''}`}
      >
        <span aria-hidden="true" className="h-px w-6 bg-[#c8902a]" />
        {eyebrow}
      </p>
      <h2 className="mt-3 text-[32px] font-semibold leading-[1.1] tracking-[-0.025em] sm:text-[44px]">{title}</h2>
      {children && <p className="mt-4 text-[17px] leading-relaxed text-muted">{children}</p>}
    </Reveal>
  );
}

function Tile({ className = '', children }) {
  return (
    <article
      className={`group relative h-full overflow-hidden rounded-[22px] border border-line bg-surface p-6 shadow-[0_1px_2px_rgb(13_19_38/0.04),0_10px_30px_-18px_rgb(13_19_38/0.18)] transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-[0_2px_4px_rgb(13_19_38/0.05),0_24px_48px_-20px_rgb(13_19_38/0.28)] sm:p-7 ${className}`}
    >
      {children}
    </article>
  );
}

function TileHead({ icon: Icon, title, children }) {
  return (
    <>
      <span className="grid h-11 w-11 place-items-center rounded-2xl bg-accent-soft text-accent transition-colors group-hover:bg-accent group-hover:text-on-accent">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <h3 className="mt-5 text-lg font-semibold tracking-[-0.01em]">{title}</h3>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">{children}</p>
    </>
  );
}

// Features as a bento: each card with a small picture of that part of the app.
function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl scroll-mt-8 px-4 py-24 sm:px-6">
      <SectionHead eyebrow="Features" title="Everything leave needs, nothing it doesn’t">
        From the first request to the year-end balance, without a spreadsheet in sight.
      </SectionHead>

      <div className="mt-12 grid gap-4 lg:grid-cols-6">
        <Reveal className="lg:col-span-4">
          <Tile>
            <div className="grid items-center gap-6 sm:grid-cols-[1fr_1.1fr]">
              <div>
                <TileHead icon={CalendarDays} title="Apply in seconds">
                  Pick the type and dates. Working days are counted for you, Sundays and holidays skipped, and the mail is written in your
                  usual Leave Application format.
                </TileHead>
              </div>
              <div aria-hidden="true" className="rounded-2xl border border-line bg-bg p-4">
                <p className="text-[11px] font-medium text-muted">Leave type</p>
                <p className="mt-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm">Casual Leave/Sick Leave</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {['26/11/2026', '27/11/2026'].map((date, index) => (
                    <div key={date}>
                      <p className="text-[11px] font-medium text-muted">{index ? 'To' : 'From'}</p>
                      <p className="mt-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm tabular-nums">{date}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-3 rounded-lg bg-accent-soft px-3 py-2 text-[13px] text-accent">
                  <span className="font-semibold">2 working days.</span> 6 left after this.
                </p>
              </div>
            </div>
          </Tile>
        </Reveal>

        <Reveal delay={0.05} className="lg:col-span-2">
          <Tile>
            <TileHead icon={Mail} title="Approve by mail or app">
              The request reaches the right person from your own Gmail, and the reply comes back to you.
            </TileHead>
            <div aria-hidden="true" className="mt-5 rounded-2xl border border-line bg-bg p-3.5 text-[13px]">
              <p className="font-semibold">Leave Application</p>
              <p className="mt-1 text-muted">To: Sita Das · Cc: Ravi Kumar</p>
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-approved-soft px-2 py-0.5 text-[11px] font-semibold text-approved">
                <Check className="h-3 w-3" /> Approved
              </p>
            </div>
          </Tile>
        </Reveal>

        <Reveal delay={0.05} className="lg:col-span-2">
          <Tile>
            <TileHead icon={Wallet} title="Balances that add up">
              Casual, sick, earned, comp off and restricted holidays, each with what is left.
            </TileHead>
            <div aria-hidden="true" className="mt-5 space-y-2.5">
              {[
                ['Casual / Sick', 8, 12, 'bg-approved'],
                ['Earned', 4, 6, 'bg-accent'],
                ['Restricted', 1, 2, 'bg-[#c8902a]'],
              ].map(([label, left, total, bar]) => (
                <div key={label} className="text-[13px]">
                  <p className="flex justify-between">
                    <span className="text-muted">{label}</span>
                    <span className="font-semibold tabular-nums">
                      {left}/{total}
                    </span>
                  </p>
                  <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-sunken">
                    <span className={`block h-full rounded-full ${bar}`} style={{ width: `${(left / total) * 100}%` }} />
                  </span>
                </div>
              ))}
            </div>
          </Tile>
        </Reveal>

        <Reveal delay={0.1} className="lg:col-span-2">
          <Tile>
            <TileHead icon={Network} title="Departments and teams">
              Department and employee trees show who reports to whom. Each department sees its own people.
            </TileHead>
            <div aria-hidden="true" className="mt-5 flex flex-col items-center text-[11px]">
              <span className="rounded-lg border border-accent bg-accent-soft px-3 py-1 font-semibold text-accent">Manager</span>
              <span className="h-3 w-px bg-line" />
              <span className="h-px w-1/2 bg-line" />
              <span className="flex w-1/2 justify-between">
                <span className="h-3 w-px bg-line" />
                <span className="h-3 w-px bg-line" />
              </span>
              <span className="flex w-[78%] justify-between">
                <span className="rounded-lg border border-line bg-surface px-2.5 py-1">Asst. manager</span>
                <span className="rounded-lg border border-line bg-surface px-2.5 py-1">Asst. manager</span>
              </span>
            </div>
          </Tile>
        </Reveal>

        <Reveal delay={0.1} className="lg:col-span-2">
          <Tile>
            <TileHead icon={BellRing} title="Everyone in the loop">
              Live notifications, a team calendar with holidays marked, and the next 14 days of leave on the overview.
            </TileHead>
            <div aria-hidden="true" className="mt-5 flex items-center gap-2.5 rounded-2xl border border-line bg-bg p-3 text-[13px]">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-pending-soft text-pending">
                <BellRing className="h-4 w-4" />
              </span>
              <span>
                <span className="block font-semibold">Mohan asked for 1 day</span>
                <span className="block text-muted">Thursday, 26 November</span>
              </span>
            </div>
          </Tile>
        </Reveal>

        {/* Security, as a navy band across the bento. */}
        <Reveal delay={0.1} className="lg:col-span-6">
          <article className={`relative isolate overflow-hidden rounded-[22px] ${NAVY} p-7 text-white sm:p-9`}>
            <MandalaCorner className="absolute -right-16 -top-24 -z-10 h-72 w-72 text-white opacity-[0.06]" />
            <div className="grid items-center gap-6 lg:grid-cols-[1fr_1.4fr]">
              <div>
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10 text-[#f2b54a]">
                  <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="mt-5 text-2xl font-semibold tracking-[-0.02em] text-white">Safe by design</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-white/65">
                  Every page checks who you are and what your place lets you do.
                </p>
              </div>
              <ul className="grid gap-3 sm:grid-cols-2">
                {[
                  'Passwords encrypted, never stored as typed',
                  'Nobody approves their own leave',
                  'Nobody joins a department without approval',
                  'Only someone above you can change you',
                ].map((point) => (
                  <li
                    key={point}
                    className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-[14px] text-white/85"
                  >
                    <Lock className={`mt-0.5 h-4 w-4 shrink-0 ${BRASS}`} aria-hidden="true" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          </article>
        </Reveal>
      </div>
    </section>
  );
}

export default function Landing() {
  const { user } = useAuth();
  const home = user ? homeOf(user) : null;

  return (
    <div className="min-h-dvh overflow-x-hidden bg-bg text-ink">
      {/* The hero: navy, with two mandalas and a fine grid of dots. */}
      <section className={`relative isolate overflow-hidden ${NAVY} text-white`}>
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 opacity-[0.35] [background-image:radial-gradient(rgb(255_255_255/0.14)_1px,transparent_1.2px)] [background-size:22px_22px]"
        />
        <MandalaCorner className="absolute -right-40 -top-40 -z-10 h-[620px] w-[620px] text-white opacity-[0.05]" />
        <MandalaCorner className="absolute -bottom-56 -left-40 -z-10 h-[520px] w-[520px] text-[#f2b54a] opacity-[0.08]" />

        <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
          <Link to="/" aria-label={`${APP_NAME} home`}>
            <Mark light />
          </Link>
          <nav aria-label="Page" className="hidden items-center gap-8 text-sm text-white/65 md:flex">
            <a href="#features" className="transition-colors hover:text-white">
              Features
            </a>
            <a href="#how" className="transition-colors hover:text-white">
              How it works
            </a>
            <a href="#roles" className="transition-colors hover:text-white">
              Roles
            </a>
          </nav>
          <div className="flex items-center gap-2">
            {home ? (
              <Cta to={home} className="h-10 px-4 text-sm">
                My dashboard <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Cta>
            ) : (
              <>
                <Link
                  to="/login"
                  className="hidden h-10 items-center rounded-xl px-4 text-sm font-semibold text-white/85 hover:bg-white/10 hover:text-white sm:inline-flex"
                >
                  Sign in
                </Link>
                <Cta to="/register" className="h-10 px-4 text-sm">
                  Get started
                </Cta>
              </>
            )}
          </div>
        </header>

        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-8 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pb-24 lg:pt-14">
          <Reveal>
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-1.5 text-xs font-medium text-white/80">
              <Sparkles className={`h-3.5 w-3.5 ${BRASS}`} aria-hidden="true" />
              Built for Contify teams in Bhubaneswar
            </p>
            <h1 className="mt-6 text-[44px] font-semibold leading-[1.02] tracking-[-0.035em] text-white sm:text-[64px]">
              Leave, approvals and your whole team, <span className={BRASS}>in one calm place.</span>
            </h1>
            <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-white/65 sm:text-lg">
              Apply in seconds, approve in one click and always know who is away. Every department runs its own team, and each manager
              organises the departments they run.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              {home ? (
                <Cta to={home}>
                  Open my dashboard <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Cta>
              ) : (
                <>
                  <Cta to="/login">
                    Sign in <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Cta>
                  <Cta to="/register" variant="glass">
                    Register as a manager
                  </Cta>
                </>
              )}
            </div>
            <dl className="mt-12 grid max-w-lg grid-cols-3 divide-x divide-white/10 border-t border-white/10 pt-6">
              {[
                ['5', 'leave types'],
                ['1 click', 'to approve'],
                ['0', 'sheets to update'],
              ].map(([value, label], index) => (
                <div key={label} className={index ? 'pl-5' : ''}>
                  <dt className="sr-only">{label}</dt>
                  <dd className="text-[28px] font-semibold tabular-nums tracking-tight text-white">{value}</dd>
                  <dd className="mt-0.5 text-[13px] text-white/50">{label}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
          <Reveal delay={0.1}>
            <Showcase />
          </Reveal>
        </div>
      </section>

      <Strip />

      <main>
        <Features />

        <section id="how" className="scroll-mt-8 border-y border-line bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
            <SectionHead eyebrow="How it works" title="Up and running in four steps">
              Nobody types in a whole team by hand. Each person brings in the next.
            </SectionHead>
            <ol className="relative mt-14 grid gap-10 md:grid-cols-4 md:gap-6">
              <span aria-hidden="true" className="absolute left-6 right-6 top-7 hidden border-t-2 border-dashed border-line md:block" />
              {STEPS.map((step, index) => (
                <Reveal key={step.title} delay={0.06 * index}>
                  <li className="relative">
                    <span className="relative grid h-14 w-14 place-items-center rounded-2xl bg-[#0d1433] text-[#f2b54a] shadow-[0_14px_28px_-14px_rgb(13_20_51/0.8)] ring-4 ring-surface">
                      <step.icon className="h-6 w-6" aria-hidden="true" />
                    </span>
                    <p className="mt-6 text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">
                      <span className="mr-2 tabular-nums text-[#c8902a]">{String(index + 1).padStart(2, '0')}</span>
                      {step.who}
                    </p>
                    <h3 className="mt-1.5 text-lg font-semibold tracking-[-0.01em]">{step.title}</h3>
                    <p className="mt-2 text-[15px] leading-relaxed text-muted">{step.text}</p>
                  </li>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        <section id="roles" className="mx-auto max-w-6xl scroll-mt-8 px-4 py-24 sm:px-6">
          <SectionHead eyebrow="Roles" title="The right view for everyone" center>
            Sign in once and the app opens on what matters to you.
          </SectionHead>
          <div className="mt-12 grid items-stretch gap-4 lg:grid-cols-3">
            {ROLES.map((role, index) => (
              <Reveal key={role.title} delay={0.05 * index}>
                <article
                  className={`relative isolate flex h-full flex-col overflow-hidden rounded-[22px] p-7 ${
                    role.featured
                      ? `${NAVY} text-white shadow-[0_30px_60px_-28px_rgb(13_20_51/0.8)] lg:-my-3 lg:py-10`
                      : 'border border-line bg-surface shadow-[0_1px_2px_rgb(13_19_38/0.04),0_10px_30px_-18px_rgb(13_19_38/0.18)]'
                  }`}
                >
                  {role.featured && <MandalaCorner className="absolute -right-20 -top-20 -z-10 h-56 w-56 text-[#f2b54a] opacity-[0.12]" />}
                  <span
                    className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${
                      role.featured ? 'bg-white/10 text-[#f2b54a]' : 'bg-accent-soft text-accent'
                    }`}
                  >
                    <UserRound className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className={`mt-5 text-xl font-semibold tracking-[-0.01em] ${role.featured ? 'text-white' : ''}`}>{role.title}</h3>
                  <p
                    className={`mt-2 inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium ${
                      role.featured ? 'bg-white/[0.08] text-[#f2b54a]' : 'bg-accent-soft text-accent'
                    }`}
                  >
                    <ArrowRight className="h-3 w-3" aria-hidden="true" />
                    {role.opens}
                  </p>
                  <ul className="mt-5 space-y-3 text-[15px]">
                    {role.points.map((point) => (
                      <li key={point} className="flex gap-2.5">
                        <span
                          className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ${
                            role.featured ? 'bg-[#f2b54a] text-[#1a1405]' : 'bg-approved-soft text-approved'
                          }`}
                        >
                          <Check className="h-3 w-3" aria-hidden="true" />
                        </span>
                        <span className={role.featured ? 'text-white/80' : 'text-muted'}>{point}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
          <Reveal>
            <div className={`relative isolate overflow-hidden rounded-[28px] ${NAVY} px-6 py-16 text-center text-white sm:px-12 sm:py-20`}>
              <MandalaCorner className="absolute -left-24 -top-24 -z-10 h-80 w-80 text-white opacity-[0.06]" />
              <MandalaCorner className="absolute -bottom-28 -right-20 -z-10 h-80 w-80 text-[#f2b54a] opacity-[0.1]" />
              <h2 className="text-[32px] font-semibold leading-[1.1] tracking-[-0.025em] text-white sm:text-[44px]">
                Ready when your team is
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-[17px] text-white/65">
                Sign in with your work email, or register as a department manager to set up your team.
              </p>
              <div className="mt-9 flex flex-wrap justify-center gap-3">
                <Cta to={home ?? '/login'}>
                  {home ? 'Open my dashboard' : 'Sign in'} <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Cta>
                {!home && (
                  <Cta to="/register" variant="glass">
                    Register as a manager
                  </Cta>
                )}
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className={`${NAVY} text-white`}>
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Mark light />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/55">
              Leave, approvals and departments for Contify, Bhubaneswar, in one calm place.
            </p>
          </div>
          <nav aria-label="Footer" className="text-sm">
            <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-white/40">Product</p>
            <ul className="mt-3 space-y-2 text-white/70">
              <li>
                <a href="#features" className="hover:text-white">
                  Features
                </a>
              </li>
              <li>
                <a href="#how" className="hover:text-white">
                  How it works
                </a>
              </li>
              <li>
                <a href="#roles" className="hover:text-white">
                  Roles
                </a>
              </li>
            </ul>
          </nav>
          <div className="text-sm">
            <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-white/40">Account</p>
            <ul className="mt-3 space-y-2 text-white/70">
              <li>
                <Link to={home ?? '/login'} className="hover:text-white">
                  {home ? 'My dashboard' : 'Sign in'}
                </Link>
              </li>
              {!home && (
                <li>
                  <Link to="/register" className="hover:text-white">
                    Register as a manager
                  </Link>
                </li>
              )}
              <li>
                <Link to="/forgot-password" className="hover:text-white">
                  Forgot password
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/[0.08]">
          <p className="mx-auto max-w-6xl px-4 py-5 text-[13px] text-white/40 sm:px-6">{APP_NAME} for Contify, Bhubaneswar</p>
        </div>
      </footer>
    </div>
  );
}
