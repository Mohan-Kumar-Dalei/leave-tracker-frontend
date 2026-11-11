import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Mail } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useToast } from '../lib/toast';
import { Button, Panel, PasswordInput } from './ui';

// Leave mails go from a person's own Gmail once they save a Gmail App
// Password: 16 letters made in their Google account. Without one, mail goes
// from the app under their name.

export const useGmail = () => useQuery({ queryKey: ['gmail'], queryFn: () => api.get('/me/gmail') });

function AppPasswordConnect({ app }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  const save = useMutation({
    mutationFn: () => api.post('/me/gmail/app-password', { appPassword: value }),
    onSuccess: () => {
      setValue('');
      queryClient.invalidateQueries({ queryKey: ['gmail'] });
      toast.success('App Password saved', 'Your leave mails can now go from your Gmail.');
    },
    onError: (issue) => setError(issue.message),
  });

  const remove = useMutation({
    mutationFn: () => api.delete('/me/gmail/app-password'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gmail'] });
      toast.success('App Password removed');
    },
    onError: (issue) => toast.error('Could not remove it', issue.message),
  });

  return (
    <section>
      <h3 className="flex items-center gap-1.5 text-sm font-semibold">
        <KeyRound className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
        Gmail App Password
      </h3>
      {!app.available && <p className="mt-1 text-sm text-muted">Not set up on the server yet.</p>}

      {app.available && app.connected && (
        <>
          <p className="mt-1 text-sm">
            Saved for <span className="font-medium">{app.email}</span>. If you change your Google password, add a new one here.
          </p>
          <Button variant="secondary" className="mt-3" loading={remove.isPending} onClick={() => remove.mutate()}>
            Remove App Password
          </Button>
        </>
      )}

      {app.available && !app.connected && (
        <>
          {app.needsReconnect && (
            <p role="status" className="mt-1 rounded-lg bg-pending-soft px-3 py-2 text-sm text-pending">
              Google stopped accepting your App Password, which happens after a password change. Make a new one below.
            </p>
          )}
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted">
            <li>Turn on 2-Step Verification in your Google account.</li>
            <li>
              Open{' '}
              <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="font-medium text-accent hover:underline">
                myaccount.google.com/apppasswords
              </a>{' '}
              and make one named Leave Tracker.
            </li>
            <li>Paste the 16 letters here. It is checked with Gmail and saved encrypted.</li>
          </ol>
          <form
            className="mt-3 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              setError('');
              save.mutate();
            }}
          >
            <p className="text-sm">
              Gmail: <span className="font-medium">{app.email}</span>
            </p>
            <PasswordInput
              label="App Password"
              autoComplete="off"
              required
              maxLength={24}
              placeholder="abcd efgh ijkl mnop"
              value={value}
              error={error}
              onChange={(event) => {
                setValue(event.target.value);
                setError('');
              }}
            />
            <Button type="submit" loading={save.isPending}>
              Save App Password
            </Button>
          </form>
        </>
      )}
    </section>
  );
}

export function GmailPanel() {
  const { data } = useGmail();
  if (!data) return null;

  return (
    <Panel className="p-5">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <Mail className="h-4 w-4 text-muted" aria-hidden="true" />
        Send from your Gmail
      </h2>
      <p className="mt-1 text-sm text-muted">Your leave mails go from your own address and show in your Sent folder.</p>
      <div className="mt-4">
        <AppPasswordConnect app={data} />
      </div>
    </Panel>
  );
}

// One line above a mail being written: where it will be sent from.
export function SendingFrom() {
  const { data } = useGmail();
  if (!data?.available) return null;

  if (data.connected) {
    return (
      <p className="text-[13px] text-muted">
        Goes from your Gmail, <span className="text-ink">{data.email}</span>.
      </p>
    );
  }
  return (
    <p className="text-[13px] text-muted">
      {data.needsReconnect ? 'Your Gmail App Password needs adding again. ' : 'Goes from the app under your name. '}
      <Link to="/profile" className="font-medium text-accent hover:underline">
        Add your Gmail App Password
      </Link>{' '}
      to send from your own address.
    </p>
  );
}
