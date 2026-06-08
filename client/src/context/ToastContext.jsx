import { createContext, useCallback, useContext, useState } from "react";
import { IconAlertCircle, IconCheck, IconX } from "../components/icons/Icons";

const ToastContext = createContext(null);

const toastStyles = {
  success: {
    border: "border-sti-gold",
    icon: "text-sti-gold",
    Icon: IconCheck,
  },
  error: {
    border: "border-red-500",
    icon: "text-red-500",
    Icon: IconAlertCircle,
  },
  info: {
    border: "border-sti-blue",
    icon: "text-sti-blue",
    Icon: IconAlertCircle,
  },
};

const ToastItem = ({ toast, onDismiss }) => {
  const style = toastStyles[toast.type] ?? toastStyles.info;
  const Icon = style.Icon;

  return (
    <div
      className={`pointer-events-auto flex max-w-xs transform items-start gap-3 rounded-lg border-l-4 bg-white p-4 shadow-lg transition-all duration-300 ${style.border}`}
      role="alert"
    >
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${style.icon}`} />
      <p className="flex-1 text-sm font-medium text-gray-800">{toast.message}</p>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 text-gray-400 hover:text-gray-600"
        aria-label="Dismiss"
      >
        <IconX className="h-4 w-4" />
      </button>
    </div>
  );
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message, type = "info") => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => dismiss(id), 5000);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[200] flex flex-col gap-2">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
};
