import { useMutation } from '@tanstack/react-query';
import { Camera, X, ZoomIn, ZoomOut } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { Button, Dialog, Panel } from './ui';

const SIDE = 400; // pixels of the saved photo
const FRAME = 240; // pixels of the crop frame on screen
const MAX_ZOOM = 4;
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

// The photo at full size over a blurred page. Escape, the close button or a
// click outside closes it.
export function PhotoViewer({ user, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={`${user.name}'s photo`}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className="m-auto overflow-visible bg-transparent p-0 backdrop:bg-black/70 backdrop:backdrop-blur-md open:animate-modal-in motion-reduce:animate-none"
    >
      <figure className="relative">
        <img
          src={`${user.avatarUrl}${user.avatarUrl.includes('?') ? '&' : '?'}tr=w-800,h-800,fo-auto`}
          alt={user.name}
          className="size-[min(80vw,70dvh,520px)] rounded-2xl bg-sunken object-cover shadow-float"
        />
        <figcaption className="mt-3 text-center text-sm font-medium text-white">{user.name}</figcaption>
        <button
          type="button"
          aria-label="Close photo"
          title="Close photo"
          onClick={onClose}
          className="absolute -right-3 -top-3 grid h-9 w-9 place-items-center rounded-full bg-surface text-ink shadow-float hover:bg-sunken"
        >
          <X className="h-[18px] w-[18px]" />
        </button>
      </figure>
    </dialog>
  );
}

// An avatar that opens the photo when there is one. Without a photo it
// does what onClick says, or nothing.
export function PhotoAvatar({ user, size, className = '', onClick }) {
  const [viewing, setViewing] = useState(false);
  const hasPhoto = Boolean(user?.avatarUrl);
  if (!hasPhoto && !onClick) return <Avatar user={user} size={size} className={className} />;
  return (
    <>
      <button
        type="button"
        onClick={() => (hasPhoto ? setViewing(true) : onClick())}
        className={`shrink-0 rounded-full transition-opacity hover:opacity-90 ${className}`}
      >
        <Avatar user={user} size={size} />
        <span className="sr-only">{hasPhoto ? `View ${user.name}'s photo` : `Open ${user.name}'s profile card`}</span>
      </button>
      {viewing && <PhotoViewer user={user} onClose={() => setViewing(false)} />}
    </>
  );
}

// Reads the picture as a data: address. The site's security policy allows
// data: images but not blob: ones, so this works without loosening it.
function readPicture(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve({ src: reader.result, img });
      img.onerror = () => reject(new Error('That file is not a picture this browser can open.'));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error('That picture could not be read.'));
    reader.readAsDataURL(file);
  });
}

async function uploadPhoto(blob) {
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

// Keeps the picture covering the whole frame, so no empty corners show.
function clampOffset({ x, y }, width, height) {
  return {
    x: Math.min(0, Math.max(FRAME - width, x)),
    y: Math.min(0, Math.max(FRAME - height, y)),
  };
}

// Drag to move the picture inside the round frame, and zoom with the slider,
// the buttons or the arrow keys. The square behind the circle is what is saved.
function CropDialog({ picture, onCancel, onDone, busy }) {
  const { img, src } = picture;
  const cover = FRAME / Math.min(img.naturalWidth, img.naturalHeight);
  const [zoom, setZoom] = useState(1);
  const scale = cover * zoom;
  const width = img.naturalWidth * scale;
  const height = img.naturalHeight * scale;

  const [offset, setOffset] = useState(() => ({
    x: (FRAME - img.naturalWidth * cover) / 2,
    y: (FRAME - img.naturalHeight * cover) / 2,
  }));
  const drag = useRef(null);

  // Zooming keeps the middle of the frame where it was.
  const changeZoom = (next) => {
    const nextZoom = Math.min(MAX_ZOOM, Math.max(1, next));
    const ratio = nextZoom / zoom;
    setOffset((o) =>
      clampOffset(
        { x: FRAME / 2 - (FRAME / 2 - o.x) * ratio, y: FRAME / 2 - (FRAME / 2 - o.y) * ratio },
        img.naturalWidth * cover * nextZoom,
        img.naturalHeight * cover * nextZoom,
      ),
    );
    setZoom(nextZoom);
  };

  const move = (dx, dy) => setOffset((o) => clampOffset({ x: o.x + dx, y: o.y + dy }, width, height));

  const save = () => {
    const canvas = document.createElement('canvas');
    canvas.width = SIDE;
    canvas.height = SIDE;
    const size = FRAME / scale;
    canvas.getContext('2d').drawImage(img, -offset.x / scale, -offset.y / scale, size, size, 0, 0, SIDE, SIDE);
    canvas.toBlob((blob) => blob && onDone(blob), 'image/jpeg', 0.88);
  };

  return (
    <Dialog
      open
      onClose={onCancel}
      title="Crop your photo"
      kind="modal"
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy}>
            Use photo
          </Button>
        </>
      }
    >
      <div className="flex flex-col items-center gap-4">
        <div
          role="application"
          aria-label="Photo crop area. Drag, or use the arrow keys, to move the photo."
          tabIndex={0}
          style={{ width: FRAME, height: FRAME }}
          className="relative cursor-grab touch-none select-none overflow-hidden rounded-xl bg-sunken active:cursor-grabbing"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            drag.current = { x: event.clientX, y: event.clientY };
          }}
          onPointerMove={(event) => {
            if (!drag.current) return;
            move(event.clientX - drag.current.x, event.clientY - drag.current.y);
            drag.current = { x: event.clientX, y: event.clientY };
          }}
          onPointerUp={() => {
            drag.current = null;
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
          onWheel={(event) => changeZoom(zoom - event.deltaY * 0.002)}
          onKeyDown={(event) => {
            const step = event.shiftKey ? 30 : 10;
            const moves = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
            if (moves[event.key]) {
              event.preventDefault();
              move(...moves[event.key]);
            }
            if (event.key === '+' || event.key === '=') changeZoom(zoom + 0.1);
            if (event.key === '-') changeZoom(zoom - 0.1);
          }}
        >
          <img
            src={src}
            alt=""
            draggable={false}
            style={{ width, height, transform: `translate(${offset.x}px, ${offset.y}px)` }}
            className="pointer-events-none absolute left-0 top-0 max-w-none origin-top-left"
          />
          {/* The round part is what shows as the avatar; the corners are dimmed. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_200px_rgb(18_20_26/0.45)] ring-2 ring-white/90"
          />
        </div>

        <div className="flex w-full max-w-[240px] items-center gap-2">
          <button
            type="button"
            aria-label="Zoom out"
            onClick={() => changeZoom(zoom - 0.25)}
            className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-bg hover:text-ink"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <input
            type="range"
            aria-label="Zoom"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={(event) => changeZoom(Number(event.target.value))}
            className="h-1.5 flex-1 cursor-pointer accent-accent"
          />
          <button
            type="button"
            aria-label="Zoom in"
            onClick={() => changeZoom(zoom + 0.25)}
            className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-bg hover:text-ink"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
        </div>
        <p className="text-center text-[13px] text-muted">Drag the photo to place it in the circle, and zoom to fit.</p>
      </div>
    </Dialog>
  );
}

export function ProfilePhotoPanel() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const input = useRef(null);
  const [picture, setPicture] = useState(null);

  const upload = useMutation({
    mutationFn: uploadPhoto,
    onSuccess: ({ user: saved }) => {
      setUser(saved);
      setPicture(null);
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

  const choose = async (file) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Photo not updated', 'Choose a picture, such as a JPG or PNG.');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error('Photo not updated', 'That picture is too big. Choose one under 15 MB.');
      return;
    }
    try {
      setPicture(await readPicture(file));
    } catch (issue) {
      toast.error('Photo not updated', issue.message);
    }
  };

  return (
    <Panel className="flex flex-wrap items-center gap-4 p-5">
      <PhotoAvatar user={user} size={72} />
      <div className="min-w-0 flex-1">
        <h2 className="text-base font-semibold">Profile photo</h2>
        <p className="mt-0.5 text-sm text-muted">Choose a photo, then drag and zoom to fit it in the circle.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            ref={input}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) choose(file);
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

      {picture && (
        <CropDialog
          picture={picture}
          busy={upload.isPending}
          onCancel={() => !upload.isPending && setPicture(null)}
          onDone={(blob) => upload.mutate(blob)}
        />
      )}
    </Panel>
  );
}
