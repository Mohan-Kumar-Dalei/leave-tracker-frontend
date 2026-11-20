import { motion, useReducedMotion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Eye, EyeOff, X } from 'lucide-react';
import { useId, useLayoutEffect, useRef, useState } from 'react';
import { Select } from './Select';

const EASE = [0.16, 1, 0.3, 1];

export function Reveal({ delay = 0, className = '', children }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

const BUTTON_STYLES = {
  primary: 'bg-accent text-on-accent shadow-card hover:bg-accent-deep',
  secondary: 'border border-line bg-surface text-ink shadow-card hover:bg-bg',
  ghost: 'text-muted hover:bg-sunken hover:text-ink',
  danger: 'bg-rejected text-surface shadow-card hover:opacity-90',
};

export function Button({ variant = 'primary', className = '', loading, disabled, children, type = 'button', ...props }) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3.5 text-sm font-medium transition-colors duration-150 disabled:opacity-50 max-sm:h-11 ${BUTTON_STYLES[variant]} ${className}`}
      {...props}
    >
      {loading ? 'Please wait' : children}
    </button>
  );
}

export function IconButton({ label, className = '', children, ...props }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`grid h-9 w-9 place-items-center rounded-lg text-muted transition-colors hover:bg-sunken hover:text-ink disabled:opacity-40 max-sm:h-11 max-sm:w-11 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

const INPUT =
  'w-full h-10 rounded-lg border border-line bg-surface px-3 text-base text-ink transition-shadow placeholder:text-muted hover:border-muted/40 focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15 sm:text-sm max-sm:h-11';

export function Field({ label, hint, error, children }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-ink">
        {label}
      </label>
      {children(id)}
      {hint && !error && <p className="mt-1.5 text-[13px] text-muted">{hint}</p>}
      {error && (
        <p role="alert" className="mt-1.5 text-[13px] text-rejected">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextInput({ label, hint, error, ...props }) {
  return (
    <Field label={label} hint={hint} error={error}>
      {(id) => <input id={id} className={INPUT} {...props} />}
    </Field>
  );
}

export function PasswordInput({ label, hint, error, ...props }) {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;

  return (
    <Field label={label} hint={hint} error={error}>
      {(id) => (
        <span className="relative block">
          <input id={id} type={visible ? 'text' : 'password'} className={`${INPUT} pr-10 [&::-ms-reveal]:hidden`} {...props} />
          <button
            type="button"
            aria-label={visible ? 'Hide password' : 'Show password'}
            aria-pressed={visible}
            title={visible ? 'Hide password' : 'Show password'}
            onClick={() => setVisible((value) => !value)}
            className="absolute inset-y-0 right-0 grid w-10 place-items-center rounded-r-lg text-muted transition-colors hover:text-ink"
          >
            <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
          </button>
        </span>
      )}
    </Field>
  );
}

export function TextArea({ label, hint, error, rows = 3, ...props }) {
  return (
    <Field label={label} hint={hint} error={error}>
      {(id) => <textarea id={id} rows={rows} className={`${INPUT} h-auto! resize-y py-2.5`} {...props} />}
    </Field>
  );
}

export function SelectBox(props) {
  return <Select triggerClassName={INPUT} {...props} />;
}

export function SelectField({ label, hint, error, children, ...props }) {
  return (
    <Field label={label} hint={hint} error={error}>
      {(id) => (
        <SelectBox id={id} className="w-full" {...props}>
          {children}
        </SelectBox>
      )}
    </Field>
  );
}

export function Panel({ className = '', children }) {
  return <section className={`overflow-hidden rounded-xl border border-line bg-surface shadow-card ${className}`}>{children}</section>;
}

export function PanelTitle({ children, action }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-3 border-b border-line px-4 sm:px-5">
      <h2 className="text-sm font-semibold">{children}</h2>
      {action}
    </div>
  );
}

export function Empty({ title, children }) {
  return (
    <div className="px-5 py-12 text-center">
      <p className="text-[15px] font-medium">{title}</p>
      {children && <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{children}</p>}
    </div>
  );
}

export function RowsSkeleton({ rows = 4 }) {
  return (
    <div className="space-y-3 p-5" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="h-9 animate-pulse rounded-lg bg-sunken motion-reduce:animate-none" />
      ))}
    </div>
  );
}

export function LoadError({ error, onRetry }) {
  return (
    <div className="px-5 py-10 text-center" role="alert">
      <p className="text-sm text-rejected">{error?.message ?? 'This could not be loaded.'}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-3" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function Pagination({ page, pages, total, onChange }) {
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pages" className="flex items-center justify-between border-t border-line px-4 py-2 text-[13px] text-muted">
      <span className="tabular-nums">
        {total} in total, page {page} of {pages}
      </span>
      <span className="flex">
        <IconButton label="Previous page" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </IconButton>
        <IconButton label="Next page" disabled={page >= pages} onClick={() => onChange(page + 1)}>
          <ChevronRight className="h-4 w-4" />
        </IconButton>
      </span>
    </nav>
  );
}

// Uses the native dialog element, which handles focus and the Escape key.
const DIALOG_BASE =
  'rounded-2xl border border-line bg-surface p-0 text-ink shadow-float backdrop:bg-black/40 backdrop:animate-backdrop-in motion-reduce:animate-none motion-reduce:backdrop:animate-none';

const DIALOG_KIND = {
  sheet: `${DIALOG_BASE} my-3 ml-auto mr-3 h-[calc(100dvh-24px)] max-h-[calc(100dvh-24px)] w-[min(480px,calc(100%-24px))] max-w-full open:animate-sheet-in`,
  modal: `${DIALOG_BASE} m-auto w-[min(440px,calc(100%-32px))] open:animate-modal-in`,
};

const CLOSE_MS = 150;

// Fades a closing dialog out. The dialog itself goes at once (it may be
// leaving the page), so a still copy of it, with its backdrop, is laid on top
// and faded away. It works however the dialog closes: the close button,
// Escape, the backdrop, or a Cancel or Save button that unmounts it.
function fadeOut(dialog) {
  if (!dialog?.open || !dialog.isConnected) return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const rect = dialog.getBoundingClientRect();
  const layer = document.createElement('div');
  layer.setAttribute('aria-hidden', 'true');
  layer.inert = true;
  layer.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none;background:rgb(0 0 0 / 0.4)';
  const ghost = document.createElement('div');
  ghost.className = dialog.className.replace(/(^|\s)(open|backdrop):\S+/g, ' ');
  ghost.style.cssText = `position:fixed;margin:0;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;max-height:none;overflow:hidden`;
  for (const child of dialog.childNodes) ghost.append(child.cloneNode(true));
  // A copy keeps what was typed and how far the content was scrolled.
  const fields = dialog.querySelectorAll('input, textarea, select');
  ghost.querySelectorAll('input, textarea, select').forEach((field, index) => {
    if (fields[index] && field.type !== 'file') field.value = fields[index].value;
  });
  const scrolled = [...dialog.querySelectorAll('*')]
    .filter((node) => node.scrollTop > 0)
    .map((node) => {
      const path = [];
      for (let at = node; at && at !== dialog; at = at.parentElement) path.unshift([...at.parentElement.children].indexOf(at));
      return [path, node.scrollTop];
    });
  layer.append(ghost);
  const sheet = dialog.dataset.kind === 'sheet';
  // Shown once the change is done: a dialog that is still open by then was not
  // closing at all (React's development check mounts things twice).
  queueMicrotask(() => {
    if (dialog.isConnected && dialog.open) return;
    document.body.append(layer);
    for (const [path, top] of scrolled) {
      let copy = ghost;
      for (const index of path) copy = copy?.children[index];
      if (copy) copy.scrollTop = top;
    }
    layer.animate([{ opacity: 1 }, { opacity: 0 }], { duration: CLOSE_MS, easing: 'ease-in', fill: 'forwards' });
    ghost
      .animate([{ transform: 'none' }, { transform: sheet ? 'translateX(24px)' : 'translateY(6px) scale(0.97)' }], {
        duration: CLOSE_MS,
        easing: 'cubic-bezier(0.4, 0, 1, 1)',
        fill: 'forwards',
      })
      .finished.finally(() => layer.remove());
  });
}

export function Dialog({ open, onClose, title, kind = 'sheet', children, footer }) {
  const ref = useRef(null);
  // The content stays while a dialog told to close (open = false) fades out.
  const [kept, setKept] = useState(open);
  if (open && !kept) setKept(true);

  // Opens in the same frame the content is drawn, so the animation starts on
  // the first frame instead of a frame late.
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (open && !dialog.open) {
      dialog.showModal();
      dialog.querySelector('[data-autofocus]')?.focus();
    }
    if (!open && dialog.open) {
      fadeOut(dialog);
      dialog.close();
    }
    if (!open && kept) setKept(false);
  }, [open, kept]);

  // Leaving the page while open (the usual way a dialog closes) fades too.
  useLayoutEffect(() => {
    const dialog = ref.current;
    return () => fadeOut(dialog);
  }, []);

  return (
    <dialog
      ref={ref}
      data-kind={kind}
      className={DIALOG_KIND[kind]}
      aria-label={title}
      onClose={onClose}
      // Escape asks to close like the close button does, so the dialog fades
      // out instead of the browser shutting it at once.
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      {(open || kept) && (
        // A modal never gets taller than this; longer content scrolls inside it
        // while the title and the buttons stay in place.
        <div className={`flex flex-col ${kind === 'sheet' ? 'h-full' : 'max-h-[min(680px,84dvh)]'}`}>
          <header className="flex items-center justify-between gap-4 border-b border-line py-3 pl-5 pr-3">
            <h2 className="text-base font-semibold">{title}</h2>
            <IconButton label="Close" onClick={onClose}>
              <X className="h-[18px] w-[18px]" />
            </IconButton>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">{children}</div>
          {footer && <footer className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}

export function ConfirmDialog({ open, onClose, title, body, confirmLabel, danger, loading, onConfirm }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      kind="modal"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Keep it
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted">{body}</p>
    </Dialog>
  );
}

// The top of a page that stays in place while the rest scrolls under it. It
// takes over the page's own top and side padding (so nothing moves) and paints
// the page colour behind itself. Its bottom padding fades from the page colour
// to clear, so cards scrolling under it melt away instead of being cut off by
// a hard edge; at rest that strip is only the page colour, so nothing changes.
// On phones it sits below the app's top bar. `roomy` leaves a wider strip, so
// the content under it starts lower and fades out over a longer stretch.
export function StickyTop({ children, className = '', roomy = false }) {
  const strip = roomy
    ? 'pb-8 bg-[linear-gradient(to_bottom,var(--color-bg)_calc(100%-1.5rem),transparent)]'
    : 'pb-4 bg-[linear-gradient(to_bottom,var(--color-bg)_calc(100%-1rem),transparent)]';
  return (
    <div
      className={`sticky top-[101px] z-20 -mx-4 -mt-3 ${strip} px-4 pt-3 sm:-mx-6 sm:px-6 lg:top-[57px] lg:-mx-8 lg:-mt-8 lg:px-8 lg:pt-8 ${className}`}
    >
      {children}
    </div>
  );
}

export function PageHeading({ title, children, actions }) {
  return (
    <Reveal className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[22px] sm:text-2xl">{title}</h1>
        {children && <p className="mt-1 text-sm text-muted">{children}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </Reveal>
  );
}
