import { useState, useRef } from "react";
import { Copy, ClipboardPaste, Check } from "lucide-react";
import { countTokens, getTokenBudgetLevel, TOKEN_BUDGET_COLORS } from "../lib/tokenizer";

interface TextAreaFieldProps {
  label: string;
  value: string;
  rows: number;
  onChange: (v: string) => void;
  placeholder?: string;
  showTokens?: boolean;
}

/**
 * Labelled textarea with copy/paste buttons, token counter, and a
 * drag-to-resize handle that sits BELOW the textarea (not over it),
 * avoiding all z-index / native-form-control stacking issues.
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
  const [height, setHeight] = useState<number | null>(null);
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

  function startResize(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const startH = textareaRef.current?.offsetHeight ?? rows * 24;

    function onMove(ev: MouseEvent) {
      setHeight(Math.max(52, startH + (ev.clientY - startY)));
    }
    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  return (
    <div>
      {/* Label row */}
      <div className="flex items-center justify-between mb-1.5">
        <label className="label-base mb-0">{label}</label>
        <div className="flex items-center gap-2">
          {showTokens && value.length > 0 && (
            <span className={`text-xs font-medium ${TOKEN_BUDGET_COLORS[getTokenBudgetLevel(tokens)]}`}>
              {tokens} tk
            </span>
          )}
          <div className="flex items-center gap-1">
            <button type="button" onClick={handleCopy} title="Copy"
              className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors">
              {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
            </button>
            <div className="relative">
              <button type="button" onClick={handlePaste} title="Paste from clipboard"
                className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors">
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

      {/* Textarea + resize handle as a flex column — handle lives BELOW textarea */}
      <div className="flex flex-col">
        <textarea
          ref={textareaRef}
          className="input-base resize-none rounded-b-none"
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={height !== null ? { height: `${height}px` } : undefined}
        />
        {/* Resize handle bar — distinct purple tint so it's always visible */}
        <div
          onMouseDown={startResize}
          className="flex items-center justify-center h-3 rounded-b-lg cursor-s-resize select-none transition-colors group"
          style={{ background: "rgba(139,92,246,0.18)", borderTop: "1px solid rgba(139,92,246,0.25)" }}
          title="Drag to resize"
        >
          <svg width="24" height="6" viewBox="0 0 24 6" fill="none">
            <line x1="3" y1="1.5" x2="21" y2="1.5" stroke="rgba(139,92,246,0.6)" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="3" y1="4.5" x2="21" y2="4.5" stroke="rgba(139,92,246,0.6)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      </div>
    </div>
  );
}
