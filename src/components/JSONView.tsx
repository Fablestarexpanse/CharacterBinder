import { useState, useEffect } from "react";
import type { TavernCardV2 } from "../types";
import { Check, AlertCircle, Copy, RefreshCw, Save } from "lucide-react";
import { validateJson } from "../lib/validators";

interface JSONViewProps {
  card: TavernCardV2;
  onUpdate: (updates: Partial<TavernCardV2["data"]>) => void;
}

export default function JSONView({ card, onUpdate }: JSONViewProps) {
  const [jsonText, setJsonText] = useState(() => JSON.stringify(card, null, 2));
  const [validationError, setValidationError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [applied, setApplied] = useState(false);
  // Track whether local edits differ from the external card prop
  const [isDirty, setIsDirty] = useState(false);

  // When the card changes externally (e.g. editor tab updates), only overwrite
  // if the local text is clean (no un-applied edits).
  useEffect(() => {
    if (!isDirty) {
      setJsonText(JSON.stringify(card, null, 2));
      setValidationError(null);
    }
  }, [card, isDirty]);

  const handleChange = (val: string) => {
    setJsonText(val);
    setIsDirty(true);
    const result = validateJson(val);
    setValidationError(result.valid ? null : result.error ?? "Invalid JSON");
  };

  const handleApply = () => {
    if (validationError) return;
    try {
      const parsed: TavernCardV2 = JSON.parse(jsonText);
      // Apply the full card's data fields back to the parent
      onUpdate(parsed.data);
      setIsDirty(false);
      setApplied(true);
      setTimeout(() => setApplied(false), 1500);
    } catch {
      setValidationError("Could not parse JSON");
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(jsonText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleRefresh = () => {
    setJsonText(JSON.stringify(card, null, 2));
    setValidationError(null);
    setIsDirty(false);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-bg-secondary shrink-0">
        <span className="text-xs text-text-secondary font-medium">JSON Editor</span>
        {isDirty && <span className="text-xs text-yellow-500 font-medium">• unsaved</span>}
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
        <button onClick={handleRefresh} className="btn-ghost py-1 text-xs" title="Discard local edits and reload from editor">
          <RefreshCw size={13} /> Refresh
        </button>
        <button onClick={handleCopy} className="btn-ghost py-1 text-xs">
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? "Copied!" : "Copy"}
        </button>
        <button
          onClick={handleApply}
          disabled={!!validationError || !isDirty}
          className={`btn-ghost py-1 text-xs font-medium transition-colors ${
            !validationError && isDirty
              ? "text-accent-purple hover:text-accent-purple-light"
              : "opacity-40 cursor-not-allowed"
          }`}
          title="Apply JSON changes back to the editor"
        >
          {applied ? <Check size={13} /> : <Save size={13} />}
          {applied ? "Applied!" : "Apply"}
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
