import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { refreshSession } from '../lib/api';
import { useToast } from '../lib/toast';

// Keeps open dashboards current: new requests and decisions appear without a
// reload. The stream carries no leave data, it only says what to refetch.
export function useLiveUpdates(enabled) {
  const queryClient = useQueryClient();
  const toast = useToast();

  useEffect(() => {
    if (!enabled) return undefined;

    let source;
    let timer;
    let stopped = false;

    const refetchLeaves = () =>
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] !== 'notifications' });

    const connect = () => {
      source = new EventSource('/api/notifications/stream');

      source.addEventListener('notification', (event) => {
        const notification = JSON.parse(event.data);
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
        toast.info(notification.title, notification.body);
      });

      source.addEventListener('leave-changed', refetchLeaves);

      source.onerror = async () => {
        // The browser retries dropped connections itself. CLOSED means the
        // server refused it, usually because the access token expired.
        if (source.readyState !== EventSource.CLOSED || stopped) return;
        const renewed = await refreshSession();
        if (renewed && !stopped) timer = setTimeout(connect, 2000);
      };
    };

    connect();

    return () => {
      stopped = true;
      clearTimeout(timer);
      source?.close();
    };
  }, [enabled, queryClient, toast]);
}
