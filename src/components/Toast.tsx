import React from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'error' | 'warning' | 'success' | 'info';
  title: string;
  message?: string;
  detail?: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-md w-full px-4 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto rounded-2xl shadow-lg border p-4 backdrop-blur-md transition-all duration-200 animate-in fade-in slide-in-from-bottom-2 ${
            toast.type === 'error'
              ? 'bg-rose-50/95 border-rose-200 text-rose-950'
              : toast.type === 'warning'
              ? 'bg-amber-50/95 border-amber-200 text-amber-950'
              : toast.type === 'success'
              ? 'bg-emerald-50/95 border-emerald-200 text-emerald-950'
              : 'bg-[#FAF9F5]/95 border-[#E5E1D6] text-[#1C1917]'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="shrink-0 mt-0.5">
              {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-600" />}
              {toast.type === 'warning' && <AlertCircle className="w-4 h-4 text-amber-600" />}
              {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
              {toast.type === 'info' && <Info className="w-4 h-4 text-amber-600" />}
            </div>

            <div className="flex-1 text-xs sm:text-sm">
              <div className="font-bold text-[#1C1917]">{toast.title}</div>
              {toast.message && <div className="mt-0.5 text-xs text-[#58534E] leading-relaxed">{toast.message}</div>}
              {toast.detail && (
                <details className="mt-2 text-xs font-mono bg-black/5 p-2 rounded-xl text-[#58534E]">
                  <summary className="cursor-pointer font-sans font-semibold mb-1">エラー詳細</summary>
                  <pre className="whitespace-pre-wrap overflow-x-auto">{toast.detail}</pre>
                </details>
              )}
            </div>

            <button
              onClick={() => onDismiss(toast.id)}
              className="shrink-0 p-1 rounded-lg hover:bg-black/5 text-[#8E8880] hover:text-[#1C1917] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
