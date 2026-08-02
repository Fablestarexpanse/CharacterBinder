import { useEffect, useId, useRef } from "react";
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
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const messageId = useId();

  useEffect(() => {
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
        return;
      }

      // Deliberately NO global Enter handler. There used to be one, and because
      // Cancel is the focused button it meant pressing Enter to dismiss the
      // dialog ran onConfirm() first — the delete confirmation deleted the card
      // on the most natural "get me out of here" keystroke. Enter now does
      // whatever the focused button does, which is the platform behaviour.

      if (e.key !== "Tab") return;

      // Focus trap: without it, Tab walks out of the dialog and into the page
      // behind, which is still fully interactive.
      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables?.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      restoreFocusRef.current?.focus?.();
    };
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop. The click handler lives here rather than on the parent: the
          backdrop is an absolutely-positioned child covering the whole area, so
          a parent-level `e.target === e.currentTarget` check could never be
          true and click-to-dismiss silently did nothing. */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden="true"
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        className="relative bg-bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-4"
      >
        <div className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
            destructive ? "bg-status-danger-soft" : "bg-status-warn-soft"
          }`}>
            <AlertTriangle size={18} className={destructive ? "text-status-danger" : "text-status-warn"} />
          </div>
          <div>
            <h2 id={titleId} className="text-base font-semibold text-text-primary">{title}</h2>
            <p id={messageId} className="text-sm text-text-secondary mt-1 leading-relaxed">{message}</p>
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="btn-secondary flex-1 justify-center"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 justify-center font-medium px-4 py-2 rounded-lg transition-colors text-sm flex items-center gap-2 ${
              destructive
                ? "bg-status-danger hover:brightness-110 text-white"
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
