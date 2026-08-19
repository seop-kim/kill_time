"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

type ToastVariant = "info" | "error";

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
  placement: ToastPlacement;
  emphasis?: boolean;
}

type ToastPlacement = "top-right" | "top-center";
type ToastOptions = { placement?: ToastPlacement; emphasis?: boolean };
type ShowToast = (message: string, variant?: ToastVariant, options?: ToastOptions) => void;

const ToastContext = createContext<ShowToast | null>(null);
const MAX_TOASTS = 4;

const VARIANT_STYLE: Record<ToastVariant, { border: string; icon: string }> = {
  info: { border: "#217346", icon: "ℹ" },
  error: { border: "#d13438", icon: "⚠" },
};

export function ToastCard({
  message,
  variant,
  onClose,
  emphasis = false,
}: Pick<ToastItem, "message" | "variant"> & { onClose: () => void; emphasis?: boolean }) {
  const style = VARIANT_STYLE[variant];
  const cardClass = emphasis
    ? "w-[420px] bg-white shadow-lg rounded-sm text-[18px] text-[#333] flex items-start gap-3 py-3 px-5"
    : "w-80 bg-white shadow-md rounded-sm text-[14px] text-[#333] flex items-start gap-2.5 py-2.5 px-4";

  return (
    <div
      className={cardClass}
      style={{ borderLeft: `3px solid ${style.border}` }}
    >
      <span className={emphasis ? "text-[20px]" : undefined} style={{ color: style.border }}>
        {style.icon}
      </span>
      <span className="flex-1">{message}</span>
      <button
        type="button"
        onClick={onClose}
        aria-label="토스트 닫기"
        className="shrink-0 text-[18px] leading-none text-[#777] hover:text-[#333]"
      >
        ×
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const showToast = useCallback<ShowToast>((message, variant = "info", options = {}) => {
    const id = nextId.current++;
    setToasts((prev) =>
      [...prev, { id, message, variant, placement: options.placement ?? "top-right", emphasis: options.emphasis }].slice(
        -MAX_TOASTS,
      ),
    );
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  return (
      <ToastContext.Provider value={showToast}>
      {children}
      <div className="fixed top-3 right-3 z-50 flex flex-col gap-2.5 w-80">
        {toasts
          .filter((toast) => toast.placement === "top-right")
          .map((t) => (
            <ToastCard
              key={t.id}
              message={t.message}
              variant={t.variant}
              emphasis={t.emphasis}
              onClose={() => setToasts((prev) => prev.filter((toast) => toast.id !== t.id))}
            />
          ))}
      </div>
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2.5">
        {toasts
          .filter((toast) => toast.placement === "top-center")
          .map((t) => (
            <ToastCard
              key={t.id}
              message={t.message}
              variant={t.variant}
              emphasis={t.emphasis}
              onClose={() => setToasts((prev) => prev.filter((toast) => toast.id !== t.id))}
            />
          ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ShowToast {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
