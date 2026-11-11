import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { GmailPanel } from '../components/GmailConnect';
import { SignatureSettings } from '../components/MailParts';
import { ProfilePhotoPanel } from '../components/ProfilePhoto';
import { Button, PageHeading, Panel, PanelTitle, PasswordInput, Reveal, TextInput } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { isoFromCreatedAt, slashDate } from '../lib/dates';
import { useToast } from '../lib/toast';

const EDITABLE = ['name', 'phone', 'designation', 'department'];

const pick = (user) => Object.fromEntries(EDITABLE.map((key) => [key, user[key] ?? '']));

// The person's own details. Name, phone, designation and department are theirs
// to change; email and employee ID stay with the admin. Joined is the day the
// account was made in the Leave Tracker.
function ProfileDetails() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(() => pick(user));
  const [error, setError] = useState('');

  const save = useMutation({
    mutationFn: () => api.patch('/me/profile', form),
    onSuccess: ({ user: saved }) => {
      setUser(saved);
      setEditing(false);
      toast.success('Details saved');
    },
    onError: (issue) => setError(issue.message),
  });

  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });
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
                setForm(pick(user));
                setError('');
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
        <form
          className="space-y-4 p-5"
          onSubmit={(event) => {
            event.preventDefault();
            setError('');
            save.mutate();
          }}
        >
          <TextInput label="Full name" required minLength={2} maxLength={80} value={form.name} onChange={set('name')} />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput label="Phone" type="tel" maxLength={20} placeholder="+91 98765 43210" value={form.phone} onChange={set('phone')} />
            <TextInput label="Designation" maxLength={80} placeholder="Analyst" value={form.designation} onChange={set('designation')} />
            <TextInput label="Department" maxLength={60} value={form.department} onChange={set('department')} />
          </div>
          <p className="text-[13px] text-muted">Your email and employee ID are set by your admin.</p>
          {error && (
            <p role="alert" className="text-sm text-rejected">
              {error}
            </p>
          )}
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
            <div key={label} className="grid grid-cols-[130px_1fr] gap-3 border-b border-line px-5 py-3 text-sm last:border-b-0">
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
  const [form, setForm] = useState({ currentPassword: '', newPassword: '' });
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState('');

  const change = useMutation({
    mutationFn: () => api.post('/auth/change-password', form),
    onSuccess: (data) => {
      toast.success('Password changed', data.message);
      setForm({ currentPassword: '', newPassword: '' });
      setRepeat('');
    },
    onError: (issue) => setError(issue.message),
  });

  return (
    <div>
      <PageHeading title="Your profile">
        Keep your details, photo, mail signature, Gmail and password up to date here.
      </PageHeading>
      <Reveal delay={0.08} className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-4">
          <ProfilePhotoPanel />
          <ProfileDetails />
          <GmailPanel />
          <Panel className="p-5">
            <h2 className="text-base font-semibold">Mail signature</h2>
            <p className="mb-4 mt-1 text-sm text-muted">
              Your leave mails end with this. Copy your signature from Gmail and paste it here, and every mail uses it.
            </p>
            <SignatureSettings />
          </Panel>
        </div>

        <Panel className="p-5">
          <h2 className="mb-4 text-base font-semibold">Change password</h2>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              setError('');
              if (form.newPassword !== repeat) {
                setError('The two new passwords do not match.');
                return;
              }
              change.mutate();
            }}
          >
            <PasswordInput
              label="Current password"
              autoComplete="current-password"
              required
              value={form.currentPassword}
              onChange={(event) => setForm({ ...form, currentPassword: event.target.value })}
            />
            <PasswordInput
              label="New password"
              autoComplete="new-password"
              required
              minLength={10}
              hint="At least 10 characters, with a letter and a number."
              value={form.newPassword}
              onChange={(event) => setForm({ ...form, newPassword: event.target.value })}
            />
            <PasswordInput
              label="Repeat new password"
              autoComplete="new-password"
              required
              value={repeat}
              onChange={(event) => setRepeat(event.target.value)}
            />
            {error && (
              <p role="alert" className="text-sm text-rejected">
                {error}
              </p>
            )}
            <Button type="submit" loading={change.isPending}>
              Save password
            </Button>
          </form>
        </Panel>
      </Reveal>
    </div>
  );
}
