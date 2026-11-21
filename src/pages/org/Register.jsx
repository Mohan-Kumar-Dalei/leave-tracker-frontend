import { useQuery } from '@tanstack/react-query';
import { EmployeeIdField } from '../../components/EmployeeIdField';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, ButtonLink, PasswordInput, TextInput } from '../../components/ui';
import { api } from '../../lib/api';
import { AuthLayout, authLink, FormError } from '../auth/AuthPages';
import { z } from 'zod';
import { formError, rules, showServerError, useZodForm } from '../../lib/forms';

// Register on your own, as a manager, with the department you will run. The
// account is ready at once: sign in, invite your assistant manager (who brings
// in the team with the department's join link) and add more departments from
// Organisation. HR registration is closed for now. Everyone else joins with an
// invitation or a department's join link.

const STEPS = ['About you', 'Your department', 'Password'];

const PASSWORD_HINT = 'At least 10 characters, with a letter and a number.';

const schema = z
  .object({
    name: rules.name,
    email: rules.email,
    phone: rules.phone,
    department: z.string().trim().min(2, 'Write the department name.').max(60, 'Keep it under 60 characters.'),
    location: rules.text(60, 'The location'),
    password: rules.newPassword,
    confirm: rules.password,
  })
  .refine((values) => values.password === values.confirm, { path: ['confirm'], message: 'The two passwords are not the same.' });

// The boxes on each step, checked before moving on.
const STEP_FIELDS = [['name', 'email', 'phone'], ['department', 'location'], ['password', 'confirm']];

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

export default function Register() {
  const { data, isPending } = useQuery({ queryKey: ['setup'], queryFn: () => api.get('/join/setup'), retry: false });
  const form = useZodForm(schema, { name: '', email: '', phone: '', department: '', location: '', password: '', confirm: '' });
  const { register, handleSubmit, trigger, formState } = form;
  const { errors, isSubmitting } = formState;
  const [done, setDone] = useState(null);
  const [step, setStep] = useState(0);

  if (isPending) {
    return (
      <AuthLayout title="Register">
        <div className="h-40 animate-pulse rounded-xl bg-sunken motion-reduce:animate-none" />
      </AuthLayout>
    );
  }

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

  const next = async (event) => {
    event.preventDefault();
    if (await trigger(STEP_FIELDS[step], { shouldFocus: true })) setStep(step + 1);
  };

  const submit = handleSubmit(
    async ({ confirm: _confirm, password, ...fields }) => {
      try {
        const filled = Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== ''));
        setDone(await api.post('/join/manager', { ...filled, password }));
      } catch (issue) {
        // Back to the step the problem is about, with the message under its box.
        const field = issue.field ?? (/email|account/i.test(issue.message) ? 'email' : /department|manager/i.test(issue.message) ? 'department' : null);
        const at = STEP_FIELDS.findIndex((names) => names.includes(field));
        if (at >= 0) {
          setStep(at);
          setTimeout(() => form.setError(field, { type: 'server', message: issue.message }, { shouldFocus: true }));
        } else {
          showServerError(form, issue);
        }
      }
    },
    // Anything wrong on an earlier step: go back to it.
    (problems) => {
      const at = STEP_FIELDS.findIndex((names) => names.some((name) => problems[name]));
      if (at >= 0 && at !== step) setStep(at);
    },
  );

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
      <form onSubmit={step === STEPS.length - 1 ? submit : next} noValidate className="space-y-4">
        {step === 0 && (
          <>
            <TextInput key="name" label="Full name" maxLength={80} error={errors.name?.message} {...register('name')} data-autofocus />
            <TextInput label="Work email" type="email" autoComplete="username" maxLength={160} error={errors.email?.message} {...register('email')} />
            <div className="grid gap-4 sm:grid-cols-2">
              <EmployeeIdField hint="Yours once you register" />
              <TextInput label="Phone" maxLength={20} error={errors.phone?.message} {...register('phone')} />
            </div>
          </>
        )}
        {step === 1 && (
          <>
            <TextInput
              key="department"
              label="Your department"
              maxLength={60}
              placeholder="For example, 3PP"
              hint="A new department, or one that has no manager yet."
              error={errors.department?.message}
              {...register('department')}
            />
            <TextInput label="Location" maxLength={60} placeholder={data?.location} error={errors.location?.message} {...register('location')} />
          </>
        )}
        {step === 2 && (
          <>
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
        <Button type="submit" loading={isSubmitting} className="h-12! w-full rounded-xl! text-[15px]!">
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
