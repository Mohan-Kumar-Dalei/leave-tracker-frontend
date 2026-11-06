import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const ToastContext = createContext(null);

const DURATION_MS = 5000;
const MAX_TOASTS = 4;

const TONE = {
  success: { icon: CheckCircle2, color: 'text-approved' },
  error: { icon: XCircle, color: 'text-rejected' },
  info: { icon: Info, color: 'text-accent' },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(
    (type, title, description) => {
      nextId.current += 1;
      const id = nextId.current;
      setToasts((list) => [...list, { id, type, title, description }].slice(-MAX_TOASTS));
      setTimeout(() => dismiss(id), DURATION_MS);
    },
    [dismiss],
  );

  const value = useMemo(
    () => ({
      success: (title, description) => show('success', title, description),
      error: (title, description) => show('error', title, description),
      info: (title, description) => show('info', title, description),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ol
        aria-live="polite"
        className="fixed right-4 top-4 z-[200] flex w-[min(360px,calc(100%-32px))] flex-col gap-2"
      >
        <AnimatePresence initial={false}>
          {toasts.map((toast) => {
            const { icon: Icon, color } = TONE[toast.type];
            return (
              <motion.li
                key={toast.id}
                layout="position"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 16 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="relative flex items-start gap-3 rounded-xl border border-line bg-surface p-3 pr-9 shadow-float"
              >
                <Icon className={`mt-0.5 h-[18px] w-[18px] shrink-0 ${color}`} strokeWidth={2} aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{toast.title}</p>
                  {toast.description && <p className="mt-0.5 text-[13px] text-muted">{toast.description}</p>}
                </div>
                <button
                  type="button"
                  aria-label="Dismiss"
                  onClick={() => dismiss(toast.id)}
                  className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-md text-muted hover:bg-sunken hover:text-ink"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ol>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
