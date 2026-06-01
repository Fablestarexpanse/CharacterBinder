import { useState, useRef } from "react";
import { Copy, ClipboardPaste, Check } from "lucide-react";
import { countTokens, getTokenBudgetLevel, TOKEN_BUDGET_COLORS } from "../lib/tokenizer";

interface TextAreaFieldProps {
  label: string;
  value: string;
  rows: number;
  onChange: (v: string) => void;
  placeholder?: string;
  /** Show token count next to the label. Defaults to true. */
  showTokens?: boolean;
}

/**
 * Shared labelled textarea with copy/paste buttons and optional token counter.
 * Textarea is vertically resizable (resize-y via CSS).
 */
export default function TextAreaField({
  label,
  value,
  rows,
  onChange,
  placeholder,
  showTokens = true,
}: TextAreaFieldProps) {
  const tokens = countTokens(value);
  const [copied, setCopied] = useState(false);
  const [pasteHint, setPasteHint] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleCopy() {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
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
      setPasteHint(true);
      setTimeout(() => setPasteHint(false), 2500);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="label-base mb-0">{label}</label>
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
              className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
            >
              {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={handlePaste}
                title="Paste from clipboard"
                className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
              >
                <ClipboardPaste size={12} />
              </button>
              {pasteHint && (
                <div className="absolute right-0 top-6 z-10 whitespace-nowrap bg-gray-800 text-white text-xs px-2 py-1 rounded shadow-lg">
                  Press Ctrl+V to paste
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <textarea
        ref={textareaRef}
        className="input-base"
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
