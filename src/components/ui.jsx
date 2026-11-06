import { motion, useReducedMotion } from 'framer-motion';
import { ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import RollingCounter from '../ApexUI-Kit/RollingCounter/RollingCounter';

const EASE = [0.16, 1, 0.3, 1];

export function Reveal({ delay = 0, y = 16, className = '', children }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

const BUTTON_STYLES = {
  primary: 'bg-accent text-on-accent hover:bg-accent-deep',
  secondary: 'border border-line bg-surface text-ink hover:border-ink',
  ghost: 'text-muted hover:text-ink hover:bg-sunken',
  danger: 'border border-rejected text-rejected hover:bg-rejected hover:text-surface',
};

export function Button({ variant = 'primary', className = '', loading, disabled, children, type = 'button', ...props }) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded px-4 text-sm font-medium transition-colors duration-200 disabled:opacity-50 max-sm:min-h-11 ${BUTTON_STYLES[variant]} ${className}`}
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
      className={`grid h-10 w-10 place-items-center rounded text-muted transition-colors hover:bg-sunken hover:text-ink disabled:opacity-40 max-sm:h-11 max-sm:w-11 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

const INPUT = 'w-full min-h-11 rounded border border-line bg-surface px-3 text-base text-ink transition-colors placeholder:text-muted hover:border-muted focus:border-accent focus:outline-none sm:text-sm';

export function Field({ label, hint, error, children }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
      </label>
      {children(id)}
      {hint && !error && <p className="mt-1.5 text-sm text-muted">{hint}</p>}
      {error && (
        <p role="alert" className="mt-1.5 text-sm text-rejected">
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

export function TextArea({ label, hint, error, rows = 3, ...props }) {
  return (
    <Field label={label} hint={hint} error={error}>
      {(id) => <textarea id={id} rows={rows} className={`${INPUT} resize-y py-2.5`} {...props} />}
    </Field>
  );
}

export function SelectBox({ className = '', children, ...props }) {
  return (
    <span className={`relative inline-block ${className}`}>
      <select className={`${INPUT} appearance-none pr-9`} {...props}>
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        strokeWidth={1.5}
        className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
      />
    </span>
  );
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
  return <section className={`rounded border border-line bg-surface ${className}`}>{children}</section>;
}

export function Empty({ title, children }) {
  return (
    <div className="px-5 py-12 text-center">
      <p className="font-display text-[22px] leading-tight">{title}</p>
      {children && <p className="mx-auto mt-2 max-w-sm text-sm text-muted">{children}</p>}
    </div>
  );
}

export function RowsSkeleton({ rows = 4 }) {
  return (
    <div className="space-y-3 p-5" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="skeleton h-9" />
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
    <nav aria-label="Pages" className="flex items-center justify-between border-t border-line px-4 py-2 text-sm text-muted">
      <span className="tabular-nums">
        {total} in total, page {page} of {pages}
      </span>
      <span className="flex">
        <IconButton label="Previous page" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
        </IconButton>
        <IconButton label="Next page" disabled={page >= pages} onClick={() => onChange(page + 1)}>
          <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
        </IconButton>
      </span>
    </nav>
  );
}

// Uses the native dialog element, which handles focus and the Escape key.
export function Dialog({ open, onClose, title, kind = 'sheet', children, footer }) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (open && !dialog.open) {
      dialog.showModal();
      dialog.querySelector('[data-autofocus]')?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={kind}
      aria-label={title}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      {open && (
        <div className={`flex flex-col ${kind === 'sheet' ? 'h-full' : 'max-h-[85dvh]'}`}>
          <header className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
            <h2 className="text-[22px]">{title}</h2>
            <IconButton label="Close" onClick={onClose}>
              <X className="h-5 w-5" strokeWidth={1.5} />
            </IconButton>
          </header>
          <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
          {footer && <footer className="flex justify-end gap-2 border-t border-line px-5 py-4">{footer}</footer>}
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
      <p className="text-base text-muted">{body}</p>
    </Dialog>
  );
}

export function BigNumber({ value, size = 2.5, className = '' }) {
  const decimals = Number.isInteger(value) ? 0 : 1;
  return (
    <RollingCounter
      value={value}
      decimals={decimals}
      fontSize={size}
      spring={{ stiffness: 170, damping: 26, mass: 1 }}
      className={`font-display ${className}`}
    />
  );
}

export function PageHeading({ title, children, actions }) {
  return (
    <Reveal className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[40px] text-balance sm:text-[56px]">{title}</h1>
        {children && <p className="mt-3 max-w-2xl text-base text-muted sm:text-lg">{children}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </Reveal>
  );
}
