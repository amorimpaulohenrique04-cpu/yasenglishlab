"use client";

import { AnimatePresence, m } from "motion/react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { yasTokens } from "@/styles/tokens";
import { Toast, type ToastProps } from "./feedback";

interface QueuedToast extends ToastProps {
  id: number;
}

const ToastContext = createContext<((toast: ToastProps) => void) | null>(null);

/** Queue for transient confirmations. Errors that block a task belong in an inline Alert. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<QueuedToast[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, number>());

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    window.clearTimeout(timers.current.get(id));
    timers.current.delete(id);
  }, []);

  const push = useCallback(
    (toast: ToastProps) => {
      const id = ++nextId.current;
      setToasts((current) => [...current.slice(-2), { ...toast, id }]);
      timers.current.set(
        id,
        window.setTimeout(() => dismiss(id), toast.tone === "error" ? 8000 : 4500),
      );
    },
    [dismiss],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => window.clearTimeout(timer));
  }, []);

  const value = useMemo(() => push, [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="yas-toast-region" role="region" aria-label="Notificações">
        <AnimatePresence initial={false}>
          {toasts.map((toast) => (
            <m.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, transition: { duration: 0.18 } }}
              transition={yasTokens.motion.springs.snappy}
            >
              <Toast
                tone={toast.tone ?? "success"}
                title={toast.title}
                {...(toast.description ? { description: toast.description } : {})}
                action={
                  toast.action ?? (
                    <button
                      type="button"
                      className="yas-toast-close"
                      aria-label="Fechar notificação"
                      onClick={() => dismiss(toast.id)}
                    >
                      ×
                    </button>
                  )
                }
              />
            </m.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const push = useContext(ToastContext);
  return useCallback(
    (toast: ToastProps) => {
      push?.(toast);
    },
    [push],
  );
}
