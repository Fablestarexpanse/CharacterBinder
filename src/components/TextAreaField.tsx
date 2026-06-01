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

const ROW_HEIGHT_PX = 24; // approximate px per row for initial height

/**
 * Labelled textarea with copy/paste buttons, optional token counter,
 * and a visible drag-to-resize handle at the bottom.
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
    const startY = e.clientY;
    const startH = textareaRef.current?.offsetHeight ?? rows * ROW_HEIGHT_PX;

    function onMove(ev: MouseEvent) {
      const next = Math.max(60, startH + (ev.clientY - startY));
      setHeight(next);
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

      {/* Wrapper holds the textarea + drag handle as a unit */}
      <div className="relative group/resize">
        <textarea
          ref={textareaRef}
          className="input-base resize-none block"
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={height !== null ? { height: `${height}px` } : undefined}
        />
        {/* Drag-to-resize handle — always visible, brightens on hover */}
        <div
          onMouseDown={startResize}
          className="absolute bottom-0 left-0 right-0 h-3 flex items-center justify-center cursor-ns-resize rounded-b-lg select-none"
          style={{ background: "rgba(139,92,246,0.08)" }}
          title="Drag to resize"
        >
          <div className="flex gap-0.5">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="w-3 h-0.5 rounded-full bg-accent-purple/30 group-hover/resize:bg-accent-purple/70 transition-colors"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
