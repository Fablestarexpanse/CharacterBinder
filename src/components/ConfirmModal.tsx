import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

interface ConfirmModalProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter") onConfirm();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onConfirm, onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Dialog */}
      <div className="relative bg-bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
            destructive ? "bg-red-900/40" : "bg-yellow-900/40"
          }`}>
            <AlertTriangle size={18} className={destructive ? "text-red-400" : "text-yellow-400"} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-text-primary">{title}</h2>
            <p className="text-sm text-text-secondary mt-1 leading-relaxed">{message}</p>
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={onCancel}
            autoFocus
            className="btn-secondary flex-1 justify-center"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 justify-center font-medium px-4 py-2 rounded-lg transition-colors text-sm flex items-center gap-2 ${
              destructive
                ? "bg-red-600 hover:bg-red-700 text-white"
                : "bg-accent-purple hover:bg-accent-purple-hover text-white"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
