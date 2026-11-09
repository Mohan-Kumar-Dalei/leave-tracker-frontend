import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GmailPanel } from '../components/GmailConnect';
import { SignatureSettings } from '../components/MailParts';
import { ProfilePhotoPanel } from '../components/ProfilePhoto';
import { Button, PageHeading, Panel, PasswordInput, Reveal } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { slashDate } from '../lib/dates';
import { useToast } from '../lib/toast';

// What Google's redirect back to /profile?gmail=... means.
const GMAIL_RESULTS = {
  connected: ['success', 'Gmail connected', 'Your leave mails now go from your own address.'],
  'wrong-account': ['error', 'That was a different Google account', 'Choose the Gmail with the same address you sign in here with.'],
  'no-permission': ['error', 'Permission to send was not given', 'Tick the box that lets the app send mail, then allow.'],
  cancelled: ['error', 'Gmail was not connected', 'You closed the Google page before allowing.'],
  expired: ['error', 'That took too long', 'Press Connect Gmail and try again.'],
  failed: ['error', 'Gmail could not be connected', 'Please try again in a minute.'],
  off: ['error', 'Not set up yet', 'Sending from Gmail is not set up on the server.'],
};

export default function Profile() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const queryClient = useQueryClient();
  const notify = useToast();
  const announced = useRef('');

  useEffect(() => {
    const key = params.get('gmail');
    const result = GMAIL_RESULTS[key];
    if (!result || announced.current === key) return;
    announced.current = key;
    const [tone, title, body] = result;
    notify[tone](title, body);
    queryClient.invalidateQueries({ queryKey: ['gmail'] });
    setParams({}, { replace: true });
  }, [params, setParams, notify, queryClient]);
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

  const rows = [
    ['Name', user.name],
    ['Email', user.email],
    ['Employee ID', user.employeeId],
    ['Department', user.department || 'Not set'],
    ['Designation', user.designation || (user.role === 'admin' ? 'Not set' : 'Analyst')],
    ['Phone', user.phone || 'Not set'],
    ['Joined', user.joinedOn ? slashDate(user.joinedOn.slice(0, 10)) : 'Not set'],
  ];

  return (
    <div>
      <PageHeading title="Your profile">
        Your admin keeps your work details up to date. You can set your mail signature, Gmail and password here.
      </PageHeading>
      <Reveal delay={0.08} className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-4">
          <ProfilePhotoPanel />
          <Panel>
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
          </Panel>
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
