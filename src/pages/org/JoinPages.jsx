import { useQuery } from '@tanstack/react-query';
import { EmployeeIdField } from '../../components/EmployeeIdField';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button, ButtonLink, PasswordInput, TextInput } from '../../components/ui';
import { api } from '../../lib/api';
import { AuthLayout, authLink, FormError } from '../auth/AuthPages';
import { z } from 'zod';
import { formError, rules, showServerError, useZodForm } from '../../lib/forms';

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
        <ButtonLink to="/login" className="h-10! w-full">
          Go to sign in
        </ButtonLink>
      </div>
    </AuthLayout>
  );
}

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

// Step 1 for anyone invited by mail: how to make a Gmail App Password, so
// leave mails go from their own Gmail. Google checks it when they finish; it
// then shows as connected on their Profile.
function AppPasswordHelp({ email }) {
  return (
    <ol className="list-decimal space-y-1.5 rounded-lg bg-sunken py-3 pl-8 pr-3 text-[13px] leading-relaxed">
      <li>Turn on 2-Step Verification for {email || 'your Gmail'}.</li>
      <li>
        Open{' '}
        <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer noopener" className={authLink}>
          myaccount.google.com/apppasswords
        </a>{' '}
        and make one called TeamDesk.
      </li>
      <li>Paste the 16 letters below.</li>
    </ol>
  );
}

const APP_PASSWORD_HINT = 'Checked with Google when you finish. Your leave mails then go from this Gmail.';
const passwordsMatch = (values) => values.password === values.confirm;
const MISMATCH = { path: ['confirm'], message: 'The two passwords are not the same.' };

// The rules for each page; the App Password only when the server uses them.
const inviteRules = (withAppPassword) =>
  z
    .object({
      appPassword: withAppPassword ? rules.appPassword : z.string().optional(),
      name: rules.name,
      phone: rules.phone,
      password: rules.newPassword,
      confirm: rules.password,
    })
    .refine(passwordsMatch, MISMATCH);

const joinRules = (withAppPassword) =>
  z
    .object({
      email: rules.email,
      appPassword: withAppPassword ? rules.appPassword : z.string().optional(),
      name: rules.name,
      phone: rules.phone,
      designation: rules.text(80, 'The designation'),
      password: rules.newPassword,
      confirm: rules.password,
    })
    .refine(passwordsMatch, MISMATCH);

// After sending, a problem goes back to the step with its box.
function placeServerError(form, issue, stepFields, setStep) {
  const field = issue.field ?? (aboutAppPassword(issue.message) ? 'appPassword' : /email|account/i.test(issue.message) ? 'email' : null);
  const at = stepFields.findIndex((names) => names.includes(field));
  if (at >= 0) {
    setStep(at);
    setTimeout(() => form.setError(field, { type: 'server', message: issue.message }, { shouldFocus: true }));
  } else {
    showServerError(form, issue);
  }
}

export function AcceptInvite() {
  const { token } = useParams();
  const { data, error, isPending } = useQuery({
    queryKey: ['invite', token],
    queryFn: () => api.get(`/join/invite/${token}`),
    retry: false,
  });
  const [done, setDone] = useState(null);
  const [step, setStep] = useState(0);
  const withAppPassword = Boolean(data?.appPassword);
  const form = useZodForm(() => inviteRules(withAppPassword), { appPassword: '', name: '', phone: '', password: '', confirm: '' });
  const { register, handleSubmit, trigger, formState, getValues, setValue } = form;
  const { errors, isSubmitting } = formState;
  // The invitation's name fills the box once it has loaded.
  useEffect(() => {
    if (data?.name && !getValues('name')) setValue('name', data.name);
  }, [data, getValues, setValue]);

  if (isPending)
    return (
      <AuthLayout title="Opening your invitation">
        <Loading />
      </AuthLayout>
    );
  if (error) return <Problem error={error} />;
  if (done) {
    return (
      <Done title="Your account is ready">
        You are the {done.role} of {done.department}. Sign in with {done.email} and the password you chose.
      </Done>
    );
  }

  const stepFields = withAppPassword
    ? [['appPassword'], ['name', 'phone', 'password', 'confirm']]
    : [[], ['name', 'phone', 'password', 'confirm']];
  const showing = withAppPassword ? step : 1;

  const next = async (event) => {
    event.preventDefault();
    if (await trigger(stepFields[0], { shouldFocus: true })) setStep(1);
  };

  const submit = handleSubmit(
    async (values) => {
      try {
        const body = { name: values.name, password: values.password };
        if (values.phone) body.phone = values.phone;
        if (withAppPassword) body.appPassword = values.appPassword;
        setDone(await api.post(`/join/invite/${token}`, body));
      } catch (issue) {
        placeServerError(form, issue, stepFields, setStep);
      }
    },
    (problems) => {
      if (withAppPassword && problems.appPassword) setStep(0);
    },
  );

  return (
    <AuthLayout
      title={`Join ${data.department} as ${data.roleName}`}
      intro={`${data.company} has invited you. ${withAppPassword ? 'First connect your Gmail, then create your account.' : 'Create your account to start.'}`}
    >
      <form onSubmit={showing === 0 ? next : submit} noValidate className="space-y-4">
        {withAppPassword && <StepBar step={showing} onBack={showing > 0 ? () => setStep(0) : undefined} />}
        {showing === 0 ? (
          <>
            <AppPasswordHelp email={data.email} />
            <PasswordInput
              label="Gmail App Password"
              placeholder="abcd efgh ijkl mnop"
              autoComplete="off"
              hint={APP_PASSWORD_HINT}
              error={errors.appPassword?.message}
              {...register('appPassword')}
            />
          </>
        ) : (
          <>
            <TextInput label="Work email" value={data.email} disabled readOnly />
            <TextInput label="Full name" maxLength={80} error={errors.name?.message} {...register('name')} />
            <div className="grid gap-4 sm:grid-cols-2">
              <EmployeeIdField />
              <TextInput label="Phone" maxLength={20} error={errors.phone?.message} {...register('phone')} />
            </div>
            <PasswordInput
              label="Choose a password"
              hint={PASSWORD_HINT}
              autoComplete="new-password"
              error={errors.password?.message}
              {...register('password')}
            />
            <PasswordInput label="Type it again" autoComplete="new-password" error={errors.confirm?.message} {...register('confirm')} />
          </>
        )}
        <FormError message={formError(form)} />
        <Button type="submit" loading={isSubmitting} className="h-10! w-full">
          {showing === 0 ? 'Next' : 'Create my account'}
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
  const [done, setDone] = useState(false);
  const [step, setStep] = useState(0);
  const withAppPassword = Boolean(data?.appPassword);
  const form = useZodForm(() => joinRules(withAppPassword), {
    email: '',
    appPassword: '',
    name: '',
    phone: '',
    designation: '',
    password: '',
    confirm: '',
  });
  const { register, handleSubmit, trigger, formState, watch } = form;
  const { errors, isSubmitting } = formState;
  const email = watch('email');

  if (isPending)
    return (
      <AuthLayout title="Opening the link">
        <Loading />
      </AuthLayout>
    );
  if (error) return <Problem error={error} />;
  if (done) {
    return (
      <Done title="Request sent">
        Your request to join {data.department} is with your manager. You can sign in once they approve it; you will get a mail.
      </Done>
    );
  }

  // With App Passwords the email is asked on step 1, with the App Password.
  const stepFields = withAppPassword
    ? [
        ['email', 'appPassword'],
        ['name', 'phone', 'designation', 'password', 'confirm'],
      ]
    : [[], ['name', 'email', 'phone', 'designation', 'password', 'confirm']];
  const showing = withAppPassword ? step : 1;

  const next = async (event) => {
    event.preventDefault();
    if (await trigger(stepFields[0], { shouldFocus: true })) setStep(1);
  };

  const submit = handleSubmit(
    async ({ confirm: _confirm, appPassword, ...values }) => {
      try {
        const body = Object.fromEntries(Object.entries(values).filter(([, value]) => value !== ''));
        await api.post(`/join/${code}`, { ...body, ...(withAppPassword ? { appPassword } : {}) });
        setDone(true);
      } catch (issue) {
        placeServerError(form, issue, stepFields, setStep);
      }
    },
    (problems) => {
      if (withAppPassword && (problems.appPassword || problems.email)) setStep(0);
    },
  );

  return (
    <AuthLayout
      title={`Join ${data.department}`}
      intro={`${data.company}${data.location ? `, ${data.location}` : ''}. Fill in your details; your manager will approve you.`}
    >
      <form onSubmit={showing === 0 ? next : submit} noValidate className="space-y-4">
        {withAppPassword && <StepBar step={showing} onBack={showing > 0 ? () => setStep(0) : undefined} />}
        {showing === 0 ? (
          <>
            <AppPasswordHelp email={email} />
            <TextInput
              label="Work email (Gmail)"
              type="email"
              autoComplete="username"
              maxLength={160}
              error={errors.email?.message}
              {...register('email')}
            />
            <PasswordInput
              label="Gmail App Password"
              placeholder="abcd efgh ijkl mnop"
              autoComplete="off"
              hint={APP_PASSWORD_HINT}
              error={errors.appPassword?.message}
              {...register('appPassword')}
            />
          </>
        ) : (
          <>
            <TextInput label="Full name" maxLength={80} error={errors.name?.message} {...register('name')} />
            <TextInput
              label="Work email"
              type="email"
              autoComplete="username"
              maxLength={160}
              readOnly={withAppPassword}
              hint={withAppPassword ? 'The Gmail from step 1.' : undefined}
              error={errors.email?.message}
              {...register('email')}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <EmployeeIdField hint="Yours once approved" />
              <TextInput label="Phone" maxLength={20} error={errors.phone?.message} {...register('phone')} />
            </div>
            <TextInput
              label="Designation"
              maxLength={80}
              placeholder="For example, Analyst"
              error={errors.designation?.message}
              {...register('designation')}
            />
            <PasswordInput
              label="Choose a password"
              hint={PASSWORD_HINT}
              autoComplete="new-password"
              error={errors.password?.message}
              {...register('password')}
            />
            <PasswordInput label="Type it again" autoComplete="new-password" error={errors.confirm?.message} {...register('confirm')} />
          </>
        )}
        <FormError message={formError(form)} />
        <Button type="submit" loading={isSubmitting} className="h-10! w-full">
          {showing === 0 ? 'Next' : 'Ask to join'}
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
