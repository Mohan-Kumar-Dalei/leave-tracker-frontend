import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import DOMPurify from 'dompurify';
import { X } from 'lucide-react';
import { useId, useLayoutEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { Button } from './ui';

// Pieces that show a leave mail before it goes: who it is to, who is copied,
// and the text with the sender's signature under it, like a mail app would.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The same rules as the server, so the preview shows what the mail will carry.
const PURIFY = {
  ALLOWED_TAGS: ['a', 'b', 'strong', 'i', 'em', 'u', 'br', 'p', 'div', 'span', 'font', 'img', 'table', 'tbody', 'tr', 'td', 'hr', 'small'],
  ALLOWED_ATTR: ['href', 'src', 'alt', 'width', 'height', 'style', 'color', 'size', 'face', 'cellpadding', 'cellspacing', 'border', 'valign', 'align'],
  ALLOWED_URI_REGEXP: /^(https:|mailto:|tel:)/i,
  // Plain values, so the link rule above must not drop them.
  ADD_URI_SAFE_ATTR: ['width', 'height', 'cellpadding', 'cellspacing', 'border', 'valign', 'align', 'color', 'size', 'face'],
};

// A pasted style must not lift the signature out of its box, and links open
// in a new tab without passing on where they came from.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.style) {
    node.style.removeProperty('position');
    node.style.removeProperty('z-index');
  }
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

import { trimSignature } from '../lib/trimSignature';

const clean = (html) => DOMPurify.sanitize(html, { ...PURIFY, ADD_ATTR: ['target', 'rel'] });

// Addresses as removable chips, with a box to type more. Enter, comma or
// leaving the box adds what was typed.
export function AddressField({ label, value, onChange, names = {} }) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const id = useId();

  const add = () => {
    const typed = draft
      .split(/[,;\s]+/)
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean);
    if (typed.length === 0) return;
    const bad = typed.find((address) => !EMAIL.test(address));
    if (bad) {
      setError(`${bad} is not an email address.`);
      return;
    }
    onChange([...value, ...typed.filter((address) => !value.includes(address))]);
    setDraft('');
    setError('');
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 py-1 text-sm">
        <label htmlFor={id} className="w-8 shrink-0 text-[13px] font-medium text-muted">
          {label}
        </label>
        {value.map((email) => (
          <span key={email} title={email} className="inline-flex max-w-full items-center gap-1 rounded-md bg-sunken py-0.5 pl-2 pr-0.5 text-[13px]">
            <span className="truncate">{names[email] ?? email}</span>
            <button
              type="button"
              aria-label={`Remove ${names[email] ?? email} from ${label}`}
              onClick={() => onChange(value.filter((item) => item !== email))}
              className="grid h-7 w-7 shrink-0 place-items-center rounded text-muted hover:bg-line hover:text-ink"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </span>
        ))}
        <input
          id={id}
          type="email"
          multiple
          value={draft}
          placeholder="Type an email and press Enter"
          aria-invalid={Boolean(error)}
          onChange={(event) => {
            setDraft(event.target.value);
            setError('');
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ',') {
              event.preventDefault();
              add();
            }
            if (event.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1));
          }}
          onBlur={add}
          className="h-9 min-w-48 flex-1 rounded-md bg-transparent px-1 text-base placeholder:text-muted focus:outline-none sm:text-sm"
        />
      </div>
      {error && (
        <p role="alert" className="pb-1 pl-10 text-[13px] text-rejected">
          {error}
        </p>
      )}
    </div>
  );
}

function StandardSignature({ signature }) {
  const link = 'text-[#1a73e8] hover:underline';
  return (
    <div className="flex items-center gap-4 font-[Arial,Helvetica,sans-serif]">
      <div className="shrink-0">
        {signature.logoUrl ? (
          <img src={signature.logoUrl} alt={signature.companyName} className="h-auto w-28 sm:w-[140px]" />
        ) : (
          <span className="text-xl font-bold tracking-tight text-[#1f2a44] sm:text-2xl">{signature.companyName}</span>
        )}
      </div>
      <div className="min-w-0 border-l border-[#dadce0] pl-4 text-[13px] leading-snug">
        <p className="text-[15px] text-[#202124]">{signature.name}</p>
        {signature.designation && <p className="mt-0.5 text-xs text-[#5f6368]">{signature.designation}</p>}
        <p className="mt-2 break-words text-[#5f6368]">
          {signature.phone && <>{signature.phone} &bull; </>}
          <span className="text-[#1a73e8]">{signature.email}</span>
        </p>
        <p className="mt-1.5">
          <a href={signature.trialUrl} target="_blank" rel="noopener noreferrer" className={link}>
            Free trial
          </a>
          <span className="text-[#5f6368]"> &bull; </span>
          <a href={signature.demoUrl} target="_blank" rel="noopener noreferrer" className={link}>
            Watch a demo
          </a>
        </p>
        <p className="mt-1.5 text-[#5f6368]">
          Follow us for the latest updates{' '}
          <a href={signature.linkedinUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-[#0a66c2] hover:underline">
            LinkedIn
          </a>
        </p>
      </div>
    </div>
  );
}

// Signatures carry their own mail colours, made for a white page, so in dark
// mode they sit on a white card like the mail itself.
export function SignatureCard({ signature }) {
  if (!signature) return null;
  return (
    <div className="dark:rounded-md dark:bg-white dark:p-3">
      <SignatureInner signature={signature} />
    </div>
  );
}

// Shows its content at full size when it fits, and shrinks it to the
// available width when it does not, so a wide pasted signature never needs a
// scroll bar. The mail itself still carries it at full size.
function FitWidth({ children }) {
  const outer = useRef(null);
  const inner = useRef(null);
  const [fit, setFit] = useState({ scale: 1, height: null });

  useLayoutEffect(() => {
    const measure = () => {
      if (!outer.current || !inner.current) return;
      const room = outer.current.clientWidth;
      const natural = inner.current.offsetWidth;
      const scale = natural > room && room > 0 ? Math.max(0.4, room / natural) : 1;
      setFit({ scale, height: scale < 1 ? Math.ceil(inner.current.offsetHeight * scale) : null });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(outer.current);
    observer.observe(inner.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={outer} className="max-w-full overflow-hidden" style={fit.height ? { height: fit.height } : undefined}>
      <div
        ref={inner}
        className="w-max max-w-none origin-top-left"
        style={fit.scale < 1 ? { transform: `scale(${fit.scale})` } : undefined}
      >
        {children}
      </div>
    </div>
  );
}

function SignatureInner({ signature }) {
  if (signature.customHtml) {
    return (
      <FitWidth>
        <div
          className="pb-1 font-[Arial,Helvetica,sans-serif] text-[13px] text-[#202124] [&_a]:text-[#1a73e8] [&_img]:inline-block"
          // Cleaned on the server when saved, and again here before showing.
          dangerouslySetInnerHTML={{ __html: clean(signature.customHtml) }}
        />
      </FitWidth>
    );
  }
  return <StandardSignature signature={signature} />;
}

// The hosting firewall blocks request bodies over 8 KB or full of style
// attributes, and pasted signatures are both. So the signature travels
// gzipped and base64 encoded; the server unpacks it and cleans it again.
const MAX_PACKED = 7800;

async function packSignature(html) {
  if (!html) return '';
  const stream = new Blob([html]).stream().pipeThrough(new CompressionStream('gzip'));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  const packed = btoa(binary);
  if (packed.length > MAX_PACKED) throw new Error('That signature is too big to save. Remove large pictures or extra lines and try again.');
  return packed;
}

// A box to paste a signature copied from Gmail or Outlook. Pasted HTML is
// cleaned before it lands in the box, and again by the server when saved.
function SignatureEditor({ current, onDone }) {
  const box = useRef(null);
  const queryClient = useQueryClient();
  const { setUser } = useAuth();
  const toast = useToast();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const save = useMutation({
    mutationFn: async (signatureHtml) => api.patch('/me/profile', { signatureGzip: await packSignature(signatureHtml) }),
    onSuccess: ({ user }) => {
      setUser(user);
      queryClient.invalidateQueries({ queryKey: ['compose'] });
      toast.success(user.signatureHtml ? 'Signature saved' : 'Standard signature back', 'Your leave mails use it from now on.');
      onDone();
    },
    onError: (issue) => setError(issue.message),
  });

  const onPaste = (event) => {
    event.preventDefault();
    const html = event.clipboardData.getData('text/html');
    const text = event.clipboardData.getData('text/plain');
    const source = html || text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
    const fragment = DOMPurify.sanitize(source, { ...PURIFY, ADD_ATTR: ['target', 'rel'], RETURN_DOM_FRAGMENT: true });

    // Pictures attached inside a mail, or not on https, cannot travel with the
    // signature. Say so instead of dropping them without a word.
    // Gmail shows attached pictures through mail.google.com links that only
    // open for the signed-in sender, so those count as attached too.
    fragment.querySelectorAll('img[src^="https://mail.google.com/"]').forEach((img) => img.removeAttribute('src'));
    const pasted = new DOMParser().parseFromString(source, 'text/html').querySelectorAll('img').length;
    const kept = fragment.querySelectorAll('img[src]').length;
    fragment.querySelectorAll('img:not([src])').forEach((img) => img.remove());
    setNotice(
      pasted > kept
        ? `${pasted - kept === 1 ? 'One picture' : `${pasted - kept} pictures`} could not be kept, because ${
            pasted - kept === 1 ? 'it is' : 'they are'
          } attached to a mail and not on a web link. Copy the signature from Gmail settings (Settings, See all settings, Signature) instead, or ask for the logo link.`
        : '',
    );

    // Put the cleaned copy where the cursor is, keeping widths and spacing as
    // they were. Without a cursor in the box, it goes at the end.
    const selection = window.getSelection();
    const inBox = selection.rangeCount && box.current.contains(selection.getRangeAt(0).commonAncestorContainer);
    const range = inBox ? selection.getRangeAt(0) : document.createRange();
    if (!inBox) {
      range.selectNodeContents(box.current);
      range.collapse(false);
    }
    range.deleteContents();
    const last = fragment.lastChild;
    range.insertNode(fragment);
    if (last) {
      range.setStartAfter(last);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-[13px] text-muted">
        In Gmail open Settings, See all settings, Signature. Select your whole signature there, press Ctrl+C, and paste it here with Ctrl+V.
      </p>
      <div
        ref={box}
        role="textbox"
        aria-multiline="true"
        aria-label="Your signature"
        contentEditable
        suppressContentEditableWarning
        onPaste={onPaste}
        // Starts with the saved signature, already cleaned.
        dangerouslySetInnerHTML={{ __html: clean(current || '') }}
        className="min-h-28 max-w-full overflow-x-auto overflow-y-hidden rounded-lg border border-line bg-surface p-3 font-[Arial,Helvetica,sans-serif] text-[13px] dark:bg-white dark:text-[#202124] focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15 [&_img]:inline-block [&_img]:max-w-full"
      />
      {notice && (
        <p role="status" className="rounded-lg bg-pending-soft px-3 py-2 text-[13px] text-pending">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="text-[13px] text-rejected">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button loading={save.isPending} onClick={() => save.mutate(trimSignature(clean(box.current.innerHTML)))}>
          Save signature
        </Button>
        <Button variant="secondary" disabled={save.isPending} onClick={() => save.mutate('')}>
          Use the standard one
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

// The person's signature on its own, for the profile: what their mails end
// with, and the box to paste a new one.
export function SignatureSettings() {
  const { data: compose } = useQuery({ queryKey: ['compose'], queryFn: () => api.get('/me/compose') });
  const [editing, setEditing] = useState(false);
  const signature = compose?.signature;

  if (!signature) return null;
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-line bg-bg/50 p-3">
        {editing ? <SignatureEditor current={signature.customHtml} onDone={() => setEditing(false)} /> : <SignatureCard signature={signature} />}
      </div>
      {!editing && (
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={() => setEditing(true)}>
            {signature.customHtml ? 'Change signature' : 'Paste my signature'}
          </Button>
          <p className="text-[13px] text-muted">{signature.customHtml ? 'Your own signature.' : 'The standard signature.'}</p>
        </div>
      )}
    </div>
  );
}

// A text box with the signature under it, inside one frame, the way a mail
// app shows a mail being written. The signature can be swapped for a pasted one.
export function MailBody({ label, value, onChange, signature, error, hint, rows = 9, ...props }) {
  const id = useId();
  const [editing, setEditing] = useState(false);

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-ink">
        {label}
      </label>
      <div
        className={`overflow-hidden rounded-lg border bg-surface transition-shadow focus-within:ring-3 focus-within:ring-accent/15 ${
          error ? 'border-rejected' : 'border-line focus-within:border-accent'
        }`}
      >
        <textarea
          id={id}
          rows={rows}
          value={value}
          onChange={onChange}
          className="block w-full resize-y bg-transparent px-3 py-2.5 text-base leading-relaxed text-ink focus:outline-none sm:text-sm"
          {...props}
        />
        <div className="border-t border-dashed border-line bg-bg/50 px-3 py-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs text-muted">--</p>
            {!editing && signature && (
              <button type="button" onClick={() => setEditing(true)} className="min-h-8 rounded px-2 text-[13px] font-medium text-accent hover:bg-accent-soft">
                Change signature
              </button>
            )}
          </div>
          {editing ? (
            <SignatureEditor current={signature?.customHtml} onDone={() => setEditing(false)} />
          ) : (
            <SignatureCard signature={signature} />
          )}
        </div>
      </div>
      {hint && !error && <p className="mt-1.5 text-[13px] text-muted">{hint}</p>}
      {error && (
        <p role="alert" className="mt-1.5 text-[13px] text-rejected">
          {error}
        </p>
      )}
    </div>
  );
}
