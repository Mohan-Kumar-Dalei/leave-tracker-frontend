import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Mail } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useToast } from '../lib/toast';
import { Button, Panel } from './ui';

// "Connect Gmail": leave mails then go from the person's own Gmail, with their
// own address, and show in their Sent folder. The app only gets permission to
// send, never to read mail.

export const useGmail = () => useQuery({ queryKey: ['gmail'], queryFn: () => api.get('/me/gmail') });

async function startConnect() {
  const { url } = await api.post('/me/gmail/connect');
  window.location.assign(url);
}

export function GmailPanel() {
  const { data } = useGmail();
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
      toast.success('Gmail disconnected', 'Leave mails go from the app under your name again.');
    },
    onError: (issue) => toast.error('Could not disconnect', issue.message),
  });

  if (!data) return null;

  return (
    <Panel className="p-5">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <Mail className="h-4 w-4 text-muted" aria-hidden="true" />
        Send from your Gmail
      </h2>

      {!data.available && (
        <p className="mt-2 text-sm text-muted">Your admin has not set this up on the server yet. Leave mails go from the app under your name.</p>
      )}

      {data.available && data.connected && (
        <>
          <p className="mt-2 text-sm">
            Your leave mails go from <span className="font-medium">{data.email}</span> and show in your Sent folder.
          </p>
          <Button variant="secondary" className="mt-4" loading={disconnect.isPending} onClick={() => disconnect.mutate()}>
            Disconnect Gmail
          </Button>
        </>
      )}

      {data.available && !data.connected && (
        <>
          {data.needsReconnect ? (
            <p role="status" className="mt-2 rounded-lg bg-pending-soft px-3 py-2 text-sm text-pending">
              Google stopped accepting the connection to {data.email}. Connect it again so your mails go from your own address.
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted">
              Connect the Gmail you sign in with here, so your leave mails go from your own address. The app can only send mail, it cannot read yours.
            </p>
          )}
          <Button className="mt-4" loading={connect.isPending} onClick={() => connect.mutate()}>
            {data.needsReconnect ? 'Connect Gmail again' : 'Connect Gmail'}
          </Button>
        </>
      )}
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
      {data.needsReconnect ? 'Your Gmail needs connecting again. ' : 'Goes from the app under your name. '}
      <Link to="/profile" className="font-medium text-accent hover:underline">
        Connect Gmail
      </Link>{' '}
      to send from your own address.
    </p>
  );
}
