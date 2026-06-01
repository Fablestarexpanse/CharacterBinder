import { useState } from "react";
import { Plus } from "lucide-react";

interface ConfirmClearPanelProps {
  /** Label used in the button, e.g. "Script Card" → "New Script Card" */
  label: string;
  onConfirm: () => void;
}

/**
 * "New X" button that expands into a red confirm/cancel panel before clearing.
 * Shared across all non-character card editors.
 */
export default function ConfirmClearPanel({ label, onConfirm }: ConfirmClearPanelProps) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="w-full flex items-center justify-center gap-2 text-xs py-2 rounded-lg border border-dashed border-border text-text-secondary hover:border-red-400/60 hover:text-red-500 hover:bg-red-950/20 transition-colors"
      >
        <Plus size={12} /> New {label}
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-red-500/30 bg-red-950/30 px-3 py-2.5 space-y-2">
      <p className="text-xs font-medium text-red-400">Clear this {label.toLowerCase()} and start fresh?</p>
      <p className="text-[11px] text-red-400/70">Library saves are not affected.</p>
      <div className="flex gap-2">
        <button
          onClick={() => { onConfirm(); setConfirming(false); }}
          className="flex-1 text-xs py-1.5 rounded-md bg-red-500 text-white hover:bg-red-600 transition-colors font-medium"
        >
          Yes, clear it
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="flex-1 text-xs py-1.5 rounded-md border border-red-500/40 text-red-400 hover:bg-red-950/50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
