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

/** Three-dot diagonal grip SVG — mirrors the OS resize handle */
function ResizeGrip() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="10" r="1.5" fill="currentColor" />
      <circle cx="6"  cy="10" r="1.5" fill="currentColor" />
      <circle cx="10" cy="6"  r="1.5" fill="currentColor" />
      <circle cx="2"  cy="10" r="1.5" fill="currentColor" />
      <circle cx="6"  cy="6"  r="1.5" fill="currentColor" />
      <circle cx="10" cy="2"  r="1.5" fill="currentColor" />
    </svg>
  );
}

/**
 * Labelled textarea with copy/paste buttons, optional token counter,
 * and a visible bottom-right corner drag-to-resize handle.
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

      <div className="relative">
        <textarea
          ref={textareaRef}
          className="input-base resize-none block"
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={height !== null ? { height: `${height}px` } : undefined}
        />
        {/* Corner resize grip — sits on top of the textarea (z-10) */}
        <div
          onMouseDown={startResize}
          className="absolute bottom-0 right-0 w-6 h-6 flex items-center justify-center rounded-br-lg cursor-s-resize select-none z-10 text-accent-purple hover:text-white transition-colors"
          style={{ background: "rgba(139,92,246,0.25)" }}
          title="Drag to resize"
        >
          <ResizeGrip />
        </div>
      </div>
    </div>
  );
}
