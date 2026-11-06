import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { IconButton } from './ui';

const timeAgo = (value) => {
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.round(hours / 24)} d ago`;
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data } = useQuery({ queryKey: ['notifications'], queryFn: () => api.get('/notifications') });
  const unread = data?.unread ?? 0;

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['notifications'] });
  const readAll = useMutation({ mutationFn: () => api.patch('/notifications/read-all'), onSuccess: refresh });
  const readOne = useMutation({ mutationFn: (id) => api.patch(`/notifications/${id}/read`), onSuccess: refresh });

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => {
      if (!root.current?.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const openItem = (item) => {
    if (!item.readAt) readOne.mutate(item.id);
    setOpen(false);
    if (item.link?.startsWith('/')) navigate(item.link);
  };

  return (
    <div ref={root} className="sm:relative">
      <IconButton
        label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="relative"
      >
        <Bell className="h-5 w-5" strokeWidth={1.5} />
        {unread > 0 && (
          <span className="absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-sm bg-rejected px-1 text-[11px] font-medium tabular-nums text-surface">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </IconButton>

      {open && (
        <div className="absolute inset-x-4 top-[60px] z-40 rounded border border-line bg-surface shadow-[0_12px_32px_-16px_rgba(28,35,33,0.4)] sm:inset-x-auto sm:right-0 sm:top-12 sm:w-96">
          <div className="flex items-center justify-between border-b border-line px-4 py-2">
            <h2 className="text-[18px]">Notifications</h2>
            {unread > 0 && (
              <button type="button" onClick={() => readAll.mutate()} className="min-h-9 text-sm text-accent underline-offset-4 hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {(data?.items ?? []).length === 0 && <li className="px-4 py-8 text-center text-sm text-muted">Nothing new.</li>}
            {(data?.items ?? []).map((item) => (
              <li key={item.id} className="border-b border-line last:border-b-0">
                <button type="button" onClick={() => openItem(item)} className="flex w-full gap-3 px-4 py-3 text-left hover:bg-bg">
                  <span
                    aria-hidden="true"
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.readAt ? 'bg-transparent' : 'bg-accent'}`}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{item.title}</span>
                    {item.body && <span className="mt-0.5 block text-sm text-muted">{item.body}</span>}
                    <span className="mt-1 block text-xs text-muted">{timeAgo(item.createdAt)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
