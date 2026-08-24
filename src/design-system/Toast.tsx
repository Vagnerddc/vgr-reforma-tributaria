import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

interface ToastItem {
  id: number;
  message: string;
  isError: boolean;
  visible: boolean;
}

interface ToastApi {
  showToast: (message: string, isError?: boolean) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const showToast = useCallback((message: string, isError = false) => {
    const id = nextId.current++;
    setToasts((atual) => [...atual, { id, message, isError, visible: false }]);
    requestAnimationFrame(() => {
      setToasts((atual) => atual.map((t) => (t.id === id ? { ...t, visible: true } : t)));
    });
    setTimeout(() => {
      setToasts((atual) => atual.map((t) => (t.id === id ? { ...t, visible: false } : t)));
      setTimeout(() => setToasts((atual) => atual.filter((t) => t.id !== id)), 200);
    }, 3200);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="vgr-toast-stack">
        {toasts.map((t) => (
          <div key={t.id} className={`vgr-toast ${t.isError ? "err" : ""} ${t.visible ? "show" : ""}`}>
            {t.isError ? "⚠ " : "✓ "}
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast precisa estar dentro de um <ToastProvider>.");
  return ctx;
}
