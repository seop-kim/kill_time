"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

type ToastVariant = "info" | "error";

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

type ShowToast = (message: string, variant?: ToastVariant) => void;

const ToastContext = createContext<ShowToast | null>(null);
const MAX_TOASTS = 4;

const VARIANT_STYLE: Record<ToastVariant, { border: string; icon: string }> = {
  info: { border: "#217346", icon: "ℹ" },
  error: { border: "#d13438", icon: "⚠" },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const showToast = useCallback<ShowToast>((message, variant = "info") => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, message, variant }].slice(-MAX_TOASTS));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className="fixed top-3 right-3 z-50 flex flex-col gap-2 w-72">
        {toasts.map((t) => {
          const style = VARIANT_STYLE[t.variant];
          return (
            <div
              key={t.id}
              className="bg-white shadow-md rounded-sm text-[13px] text-[#333] flex items-start gap-2 py-2 px-3"
              style={{ borderLeft: `3px solid ${style.border}` }}
            >
              <span style={{ color: style.border }}>{style.icon}</span>
              <span>{t.message}</span>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ShowToast {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
