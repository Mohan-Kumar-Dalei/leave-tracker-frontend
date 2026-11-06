import { createContext, useCallback, useContext, useMemo, useRef } from 'react';
import ToastStack from '../ApexUI-Kit/ToastStack/ToastStack';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const ref = useRef(null);

  const show = useCallback((toast) => ref.current?.show(toast), []);
  const value = useMemo(
    () => ({
      success: (title, description) => show({ type: 'success', title, description }),
      error: (title, description) => show({ type: 'error', title, description }),
      info: (title, description) => show({ type: 'info', title, description }),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastStack ref={ref} position="top-right" duration={5000} className="top-20! max-sm:top-16!" />
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
