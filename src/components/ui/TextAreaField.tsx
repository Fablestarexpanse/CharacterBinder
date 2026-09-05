import { useRef, useMemo, useId } from "react";
import { Copy, ClipboardPaste, Check } from "lucide-react";
import { countTokens, getTokenBudgetLevel, TOKEN_BUDGET_COLORS } from "../../lib/tokenizer";
import ResizableTextArea from "./ResizableTextArea";
import { useTimedFlag } from "../../hooks/useTimedFlag";

interface TextAreaFieldProps {
  label: string;
  value: string;
  rows: number;
  onChange: (v: string) => void;
  placeholder?: string;
  showTokens?: boolean;
}

/**
 * Labelled textarea with copy/paste buttons and a token counter.
 * The textarea itself — and its drag-to-resize handle — is ResizableTextArea.
 */
export default function TextAreaField({
  label,
  value,
  rows,
  onChange,
  placeholder,
  showTokens = true,
}: TextAreaFieldProps) {
  const fieldId = useId();
  const [copied, flashCopied] = useTimedFlag();
  const [pasteHint, flashPasteHint] = useTimedFlag(2500);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // countTokens is a full BPE encode; unmemoized, every keystroke in any field
  // re-tokenizes every other field on the page.
  const tokens = useMemo(() => (showTokens ? countTokens(value) : 0), [value, showTokens]);

  function handleCopy() {
    navigator.clipboard.writeText(value);
    flashCopied();
  }

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText();
      if (!textareaRef.current || !text) return;
      const el = textareaRef.current;
      const start = el.selectionStart ?? value.length;
      const end = el.selectionEnd ?? value.length;
      const next = value.slice(0, start) + text + value.slice(end);
      onChange(next);
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(start + text.length, start + text.length);
      });
    } catch {
      textareaRef.current?.focus();
      flashPasteHint();
    }
  }

  return (
    <div>
      {/* Label row */}
      <div className="flex items-center justify-between mb-1.5">
        <label htmlFor={fieldId} className="label-base mb-0">{label}</label>
        <div className="flex items-center gap-2">
          {showTokens && value.length > 0 && (
            <span className={`text-xs font-medium ${TOKEN_BUDGET_COLORS[getTokenBudgetLevel(tokens)]}`}>
              {tokens} tk
            </span>
          )}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleCopy}
              title="Copy"
              aria-label={`Copy ${label}`}
              className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
            >
              {copied ? <Check size={12} className="text-status-ok" /> : <Copy size={12} />}
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={handlePaste}
                title="Paste from clipboard"
                aria-label={`Paste into ${label}`}
                className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
              >
                <ClipboardPaste size={12} />
              </button>
              {pasteHint && (
                <div className="absolute right-0 top-6 z-10 whitespace-nowrap bg-text-primary text-white text-xs px-2 py-1 rounded shadow-lg">
                  Press Ctrl+V to paste
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <ResizableTextArea
        id={fieldId}
        ref={textareaRef}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
