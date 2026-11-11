import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Mail } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useToast } from '../lib/toast';
import { Button, Panel, PasswordInput } from './ui';

// Two ways to send leave mails from one's own Gmail, both kept for now:
//  1. Connect with Google: the app only gets permission to send, nothing to type.
//  2. App Password: a 16 letter password made in the Google account.
// The first that works is used; without either, mail goes from the app.

export const useGmail = () => useQuery({ queryKey: ['gmail'], queryFn: () => api.get('/me/gmail') });

async function startConnect() {
  const { url } = await api.post('/me/gmail/connect');
  window.location.assign(url);
}

function GoogleConnect({ data }) {
  const queryClient = useQueryClient();
  const toast = useToast();

  const connect = useMutation({
    mutationFn: startConnect,
    onError: (issue) => toast.error('Could not open Google', issue.message),
  });

  const disconnect = useMutation({
    mutationFn: () => api.delete('/me/gmail'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gmail'] });
      toast.success('Gmail disconnected');
    },
    onError: (issue) => toast.error('Could not disconnect', issue.message),
  });

  return (
    <section>
      <h3 className="text-sm font-semibold">Option 1: Connect with Google</h3>
      {!data.available && <p className="mt-1 text-sm text-muted">Not set up on the server yet.</p>}

      {data.available && data.connected && (
        <>
          <p className="mt-1 text-sm">
            Connected as <span className="font-medium">{data.email}</span>. Your mails show in your Sent folder.
          </p>
          <Button variant="secondary" className="mt-3" loading={disconnect.isPending} onClick={() => disconnect.mutate()}>
            Disconnect
          </Button>
        </>
      )}

      {data.available && !data.connected && (
        <>
          {data.needsReconnect ? (
            <p role="status" className="mt-1 rounded-lg bg-pending-soft px-3 py-2 text-sm text-pending">
              Google stopped accepting the connection to {data.email}. Connect it again.
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted">Sign in with Google and allow sending. The app can only send mail, it cannot read yours.</p>
          )}
          <Button className="mt-3" loading={connect.isPending} onClick={() => connect.mutate()}>
            {data.needsReconnect ? 'Connect again' : 'Connect Gmail'}
          </Button>
        </>
      )}
    </section>
  );
}

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
        Option 2: Gmail App Password
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
      <p className="mt-1 text-sm text-muted">Use either way. If both are set, Connect with Google is used first.</p>
      <div className="mt-4 space-y-5 divide-y divide-line [&>*+*]:pt-5">
        <GoogleConnect data={data} />
        {data.appPassword && <AppPasswordConnect app={data.appPassword} />}
      </div>
    </Panel>
  );
}

// One line above a mail being written: where it will be sent from.
export function SendingFrom() {
  const { data } = useGmail();
  if (!data) return null;
  const app = data.appPassword ?? {};
  if (!data.available && !app.available) return null;

  if (data.connected || app.connected) {
    return (
      <p className="text-[13px] text-muted">
        Goes from your Gmail, <span className="text-ink">{data.connected ? data.email : app.email}</span>.
      </p>
    );
  }
  return (
    <p className="text-[13px] text-muted">
      {data.needsReconnect || app.needsReconnect ? 'Your Gmail needs connecting again. ' : 'Goes from the app under your name. '}
      <Link to="/profile" className="font-medium text-accent hover:underline">
        Set up your Gmail
      </Link>{' '}
      to send from your own address.
    </p>
  );
}
