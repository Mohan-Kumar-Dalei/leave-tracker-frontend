import { useMutation } from '@tanstack/react-query';
import { Camera } from 'lucide-react';
import { useRef, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { Button, Panel } from './ui';

const SIDE = 400;
const UPLOAD_URL = 'https://upload.imagekit.io/api/v1/files/upload';

export const initials = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');

// ImageKit resizes on the fly from the URL, so small avatars stay small.
const sized = (url, px) => `${url}${url.includes('?') ? '&' : '?'}tr=w-${px},h-${px},fo-auto`;

export function Avatar({ user, size = 36, className = '' }) {
  const [broken, setBroken] = useState(false);
  const style = { width: size, height: size };
  if (user?.avatarUrl && !broken) {
    return (
      <img
        src={sized(user.avatarUrl, size * 2)}
        alt=""
        style={style}
        onError={() => setBroken(true)}
        className={`shrink-0 rounded-full object-cover ${className}`}
      />
    );
  }
  return (
    <span
      style={{ ...style, fontSize: Math.max(11, size * 0.36) }}
      className={`grid shrink-0 place-items-center rounded-full bg-accent-soft font-semibold text-accent ${className}`}
    >
      {initials(user?.name)}
    </span>
  );
}

// Crops the middle square of the picture and makes it a 400px JPEG, so every
// upload is small and the same shape.
function squareJpeg(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      const canvas = document.createElement('canvas');
      canvas.width = SIDE;
      canvas.height = SIDE;
      canvas
        .getContext('2d')
        .drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, SIDE, SIDE);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('That picture could not be read.'))), 'image/jpeg', 0.86);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That file is not a picture this browser can open.'));
    };
    img.src = url;
  });
}

async function uploadPhoto(file) {
  if (!file.type.startsWith('image/')) throw new Error('Choose a picture, such as a JPG or PNG.');
  if (file.size > 15 * 1024 * 1024) throw new Error('That picture is too big. Choose one under 15 MB.');

  const blob = await squareJpeg(file);
  const auth = await api.get('/me/photo/upload-auth');

  // Straight to ImageKit with the one-time signature from the API.
  const form = new FormData();
  form.append('file', blob, auth.fileName);
  form.append('fileName', auth.fileName);
  form.append('folder', auth.folder);
  form.append('useUniqueFileName', 'true');
  form.append('publicKey', auth.publicKey);
  form.append('signature', auth.signature);
  form.append('expire', String(auth.expire));
  form.append('token', auth.token);

  const res = await fetch(UPLOAD_URL, { method: 'POST', body: form });
  const uploaded = await res.json().catch(() => ({}));
  if (!res.ok || !uploaded.fileId) throw new Error(uploaded.message || 'The upload did not go through. Try again.');

  return api.post('/me/photo', { fileId: uploaded.fileId });
}

export function ProfilePhotoPanel() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const input = useRef(null);

  const upload = useMutation({
    mutationFn: uploadPhoto,
    onSuccess: ({ user: saved }) => {
      setUser(saved);
      toast.success('Photo updated');
    },
    onError: (issue) => toast.error('Photo not updated', issue.message),
  });

  const remove = useMutation({
    mutationFn: () => api.delete('/me/photo'),
    onSuccess: ({ user: saved }) => {
      setUser(saved);
      toast.success('Photo removed');
    },
    onError: (issue) => toast.error('Could not remove the photo', issue.message),
  });

  return (
    <Panel className="flex flex-wrap items-center gap-4 p-5">
      <Avatar user={user} size={72} />
      <div className="min-w-0 flex-1">
        <h2 className="text-base font-semibold">Profile photo</h2>
        <p className="mt-0.5 text-sm text-muted">A square photo works best. It is cropped to the middle.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            ref={input}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) upload.mutate(file);
            }}
          />
          <Button loading={upload.isPending} onClick={() => input.current?.click()}>
            <Camera className="h-4 w-4" aria-hidden="true" />
            {user.avatarUrl ? 'Change photo' : 'Upload photo'}
          </Button>
          {user.avatarUrl && (
            <Button variant="ghost" loading={remove.isPending} disabled={upload.isPending} onClick={() => remove.mutate()}>
              Remove
            </Button>
          )}
        </div>
      </div>
    </Panel>
  );
}
