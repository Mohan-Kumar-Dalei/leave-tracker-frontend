import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { GmailPanel } from '../components/GmailConnect';
import { SignatureSettings } from '../components/MailParts';
import { ProfilePhotoPanel } from '../components/ProfilePhoto';
import { z } from 'zod';
import { Button, FormError, PageHeading, Panel, PanelTitle, PasswordInput, Reveal, TextInput } from '../components/ui';
import { api } from '../lib/api';
import { formError, rules, showServerError, useZodForm } from '../lib/forms';
import { useAuth } from '../lib/auth';
import { isoFromCreatedAt, slashDate } from '../lib/dates';
import { useToast } from '../lib/toast';

const EDITABLE = ['name', 'email', 'phone', 'designation'];

const pick = (user) => ({ ...Object.fromEntries(EDITABLE.map((key) => [key, user[key] ?? ''])), currentPassword: '' });

// The current password is needed only when the email changes.
const detailsRules = (currentEmail) =>
  z
    .object({
      name: rules.name,
      email: rules.email,
      currentPassword: z.string().max(200),
      phone: rules.phone,
      designation: rules.text(80, 'The designation'),
    })
    .refine((values) => values.email.toLowerCase() === currentEmail.toLowerCase() || values.currentPassword.length > 0, {
      path: ['currentPassword'],
      message: 'Enter your current password to change your email.',
    });

const passwordRules = z
  .object({ currentPassword: rules.password, newPassword: rules.newPassword, repeat: rules.password })
  .refine((values) => values.newPassword === values.repeat, { path: ['repeat'], message: 'The two new passwords do not match.' });

// The person's own details. Name, email, phone and designation are
// theirs to change (a new email asks for the current password); the employee
// ID and department stay with their manager. Joined is the day the
// account was made in the Leave Tracker.
function ProfileDetails() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const form = useZodForm(() => detailsRules(user.email ?? ''), pick(user));
  const { register, handleSubmit, formState, watch, reset } = form;
  const { errors } = formState;
  const email = watch('email') ?? '';

  const save = useMutation({
    mutationFn: ({ currentPassword, ...fields }) => {
      const changingEmail = fields.email.toLowerCase() !== (user.email ?? '').toLowerCase();
      return api.patch('/me/profile', changingEmail ? { ...fields, currentPassword } : { ...fields, email: user.email });
    },
    onSuccess: ({ user: saved }) => {
      setUser(saved);
      setEditing(false);
      toast.success('Details saved');
    },
    onError: (issue) =>
      showServerError(form, /current password/i.test(issue.message) ? { field: 'currentPassword', message: issue.message } : issue, [...EDITABLE, 'currentPassword']),
  });
  const joined = user.createdAt ? slashDate(isoFromCreatedAt(user.createdAt)) : 'Not known';
  const designation = user.designation || (user.role === 'admin' ? 'Not set' : 'Analyst');

  const rows = [
    ['Name', user.name],
    ['Email', user.email],
    ['Employee ID', user.employeeId],
    ['Department', user.department || 'Not set'],
    ['Designation', designation],
    ['Phone', user.phone || 'Not set'],
    ['Joined', joined],
  ];

  return (
    <Panel>
      <PanelTitle
        action={
          !editing && (
            <Button
              variant="ghost"
              onClick={() => {
                reset(pick(user));
                setEditing(true);
              }}
            >
              Edit
            </Button>
          )
        }
      >
        Your details
      </PanelTitle>

      {editing ? (
        <form className="space-y-4 p-5" noValidate onSubmit={handleSubmit((fields) => save.mutate(fields))}>
          <TextInput label="Full name" maxLength={80} error={errors.name?.message} {...register('name')} />
          <TextInput
            label="Email"
            type="email"
            maxLength={160}
            hint="Your sign-in and the Gmail your leave mails go from."
            error={errors.email?.message}
            {...register('email')}
          />
          {email.trim().toLowerCase() !== (user.email ?? '').toLowerCase() && (
            <PasswordInput
              label="Current password"
              autoComplete="current-password"
              hint="Needed to change your email. Add your Gmail App Password again afterwards."
              error={errors.currentPassword?.message}
              {...register('currentPassword')}
            />
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput label="Phone" type="tel" maxLength={20} placeholder="+91 98765 43210" error={errors.phone?.message} {...register('phone')} />
            <TextInput label="Designation" maxLength={80} placeholder="Analyst" error={errors.designation?.message} {...register('designation')} />
          </div>
          <p className="text-[13px] text-muted">Your employee ID and department are set by your manager.</p>
          <FormError>{formError(form)}</FormError>
          <div className="flex gap-2">
            <Button type="submit" loading={save.isPending}>
              Save details
            </Button>
            <Button variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <dl>
          {rows.map(([label, value]) => (
            <div
              key={label}
              className="grid grid-cols-[130px_1fr] gap-3 border-b border-line px-5 py-3 text-sm last:border-b-0"
            >
              <dt className="text-muted">{label}</dt>
              <dd className="min-w-0 break-words">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </Panel>
  );
}

export default function Profile() {
  const toast = useToast();
  const passwordForm = useZodForm(passwordRules, { currentPassword: '', newPassword: '', repeat: '' });
  const passwordErrors = passwordForm.formState.errors;

  const change = useMutation({
    mutationFn: ({ currentPassword, newPassword }) => api.post('/auth/change-password', { currentPassword, newPassword }),
    onSuccess: (data) => {
      toast.success('Password changed', data.message);
      passwordForm.reset();
    },
    onError: (issue) =>
      showServerError(
        passwordForm,
        /current password/i.test(issue.message) ? { field: 'currentPassword', message: issue.message } : issue,
        ['currentPassword', 'newPassword'],
      ),
  });

  return (
    <div>
      <PageHeading title="Your profile">
        Keep your details, photo, mail signature, Gmail and password up to date here.
      </PageHeading>
      <Reveal delay={0.08} className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <ProfilePhotoPanel />
          <ProfileDetails />
          <Panel className="p-5">
            <h2 className="text-base font-semibold">Mail signature</h2>
            <p className="mb-4 mt-1 text-sm text-muted">
              Your leave mails end with this. Copy your signature from Gmail and paste it here, and every mail uses it.
            </p>
            <SignatureSettings />
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel className="p-5">
            <h2 className="mb-4 text-base font-semibold">Change password</h2>
            <form className="space-y-4" noValidate onSubmit={passwordForm.handleSubmit((fields) => change.mutate(fields))}>
              <PasswordInput
                label="Current password"
                autoComplete="current-password"
                error={passwordErrors.currentPassword?.message}
                {...passwordForm.register('currentPassword')}
              />
              <PasswordInput
                label="New password"
                autoComplete="new-password"
                hint="At least 10 characters, with a letter and a number."
                error={passwordErrors.newPassword?.message}
                {...passwordForm.register('newPassword')}
              />
              <PasswordInput
                label="Repeat new password"
                autoComplete="new-password"
                error={passwordErrors.repeat?.message}
                {...passwordForm.register('repeat')}
              />
              <FormError>{formError(passwordForm)}</FormError>
              <Button type="submit" loading={change.isPending}>
                Save password
              </Button>
            </form>
          </Panel>
          <GmailPanel />
        </div>
      </Reveal>
    </div>
  );
}
