import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, PageHeading, Panel, PasswordInput, Reveal } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { slashDate } from '../lib/dates';
import { useToast } from '../lib/toast';

export default function Profile() {
  const { user } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '' });
  const [error, setError] = useState('');

  const change = useMutation({
    mutationFn: () => api.post('/auth/change-password', form),
    onSuccess: (data) => {
      toast.success('Password changed', data.message);
      setForm({ currentPassword: '', newPassword: '' });
    },
    onError: (issue) => setError(issue.message),
  });

  const rows = [
    ['Name', user.name],
    ['Email', user.email],
    ['Employee ID', user.employeeId],
    ['Department', user.department || 'Not set'],
    ['Designation', user.designation || 'Not set'],
    ['Joined', user.joinedOn ? slashDate(user.joinedOn.slice(0, 10)) : 'Not set'],
  ];

  return (
    <div>
      <PageHeading title="Your profile">Your admin keeps these details up to date.</PageHeading>
      <Reveal delay={0.08} className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Panel>
          <dl>
            {rows.map(([label, value]) => (
              <div key={label} className="grid grid-cols-[130px_1fr] gap-3 border-b border-line px-5 py-3 text-sm last:border-b-0">
                <dt className="text-muted">{label}</dt>
                <dd className="min-w-0 break-words">{value}</dd>
              </div>
            ))}
          </dl>
        </Panel>

        <Panel className="p-5">
          <h2 className="mb-4 text-base font-semibold">Change password</h2>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              setError('');
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
