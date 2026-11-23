import { AlertCircle, CheckCircle2, X } from 'lucide-react';

export interface ToastMessage {
  id: number;
  text: string;
  variant: 'success' | 'error';
}

interface ToastProps {
  toast: ToastMessage | null;
  onDismiss: () => void;
}

export function Toast({ toast, onDismiss }: ToastProps) {
  if (!toast) return null;

  const isSuccess = toast.variant === 'success';

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-20 left-1/2 z-50 w-[calc(100%-2rem)] max-w-[400px] -translate-x-1/2"
    >
      <div
        className={`flex items-center justify-between gap-2.5 rounded-full border px-3 py-2 shadow-lg backdrop-blur-md ${
          isSuccess
            ? 'border-slate-200 bg-white/95 text-slate-900'
            : 'border-rose-200 bg-rose-50/95 text-rose-900'
        }`}
      >
        <button
          type="button"
          onClick={onDismiss}
          aria-label="إغلاق الإشعار"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200 cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-1 items-center justify-center gap-2 min-w-0 px-2">
          {isSuccess ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" aria-hidden="true" />
          )}
          <span className="text-xs font-bold truncate">{toast.text}</span>
        </div>
      </div>
    </div>
  );
}
