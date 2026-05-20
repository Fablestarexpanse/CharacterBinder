import { useState, useEffect } from "react";
import type { TavernCardV2 } from "../types";
import { Check, AlertCircle, Copy, RefreshCw } from "lucide-react";
import { validateJson } from "../lib/validators";

interface JSONViewProps {
  card: TavernCardV2;
  onUpdate: (updates: Partial<TavernCardV2["data"]>) => void;
}

export default function JSONView({ card }: JSONViewProps) {
  const [jsonText, setJsonText] = useState(() => JSON.stringify(card, null, 2));
  const [validationError, setValidationError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setJsonText(JSON.stringify(card, null, 2));
  }, [card]);

  const handleChange = (val: string) => {
    setJsonText(val);
    const result = validateJson(val);
    setValidationError(result.valid ? null : result.error ?? "Invalid JSON");
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(jsonText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleRefresh = () => {
    setJsonText(JSON.stringify(card, null, 2));
    setValidationError(null);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-bg-secondary shrink-0">
        <span className="text-xs text-text-secondary font-medium">JSON Editor</span>
        <div className="flex-1" />
        {validationError ? (
          <div className="flex items-center gap-1.5 text-red-400 text-xs">
            <AlertCircle size={13} />
            <span>{validationError}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-accent-green text-xs">
            <Check size={13} />
            <span>Valid JSON</span>
          </div>
        )}
        <button onClick={handleRefresh} className="btn-ghost py-1 text-xs">
          <RefreshCw size={13} /> Refresh
        </button>
        <button onClick={handleCopy} className="btn-ghost py-1 text-xs">
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        <textarea
          className="w-full h-full bg-bg-primary text-text-primary font-mono text-xs p-4 resize-none focus:outline-none border-none leading-relaxed"
          value={jsonText}
          onChange={(e) => handleChange(e.target.value)}
          spellCheck={false}
        />
      </div>
    </div>
  );
}
