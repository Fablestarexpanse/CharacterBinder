import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Download, FileJson, FileCode2, Save } from "lucide-react";
import ResizableTextArea from "./ResizableTextArea";
import type { ScriptCard } from "../types";
import { encodeCharaToPng } from "../lib/pngMetadata";
import { saveAnyCard } from "../lib/library";
import { getCarrierPng } from "../lib/carrierImage";
import { downloadJson, downloadPng } from "../lib/download";
import { useStatusMessage } from "../hooks/useStatusMessage";
import ImageDropzone from "./ImageDropzone";
import ConfirmClearPanel from "./ConfirmClearPanel";
import TagInput from "./TagInput";
import { blankScriptCard } from "../lib/blankCards";

const DEFAULT = blankScriptCard();

interface ScriptEditorProps {
  initialCard?: ScriptCard;
  initialImageSrc?: string | null;
  initialLibraryId?: string;
}

export default function ScriptEditor({ initialCard, initialImageSrc, initialLibraryId }: ScriptEditorProps) {
  const [card, setCard] = useState<ScriptCard>(initialCard ?? DEFAULT);
  const { status, setMsg } = useStatusMessage();
  const [imageSrc, setImageSrc] = useState<string | null>(initialImageSrc ?? null);
  const [libraryId, setLibraryId] = useState<string | undefined>(initialLibraryId);
  const [saving, setSaving] = useState(false);
  const [savedVersion, setSavedVersion] = useState<string>(initialCard?.version ?? "1.0");
  const [outputFileName, setOutputFileName] = useState(
    ((initialCard?.name || "script").replace(/\s+/g, "_")) + "_script.png"
  );

  // Auto-sync filename to script name
  useEffect(() => {
    const name = card.name.trim();
    setOutputFileName(name ? name.replace(/\s+/g, "_") + "_script.png" : "script.png");
  }, [card.name]);

  function update(patch: Partial<ScriptCard>) {
    setCard((c) => ({ ...c, ...patch }));
  }

  function clearForNew() {
    setCard(DEFAULT);
    setImageSrc(null);
    setLibraryId(undefined);
    setSavedVersion("1.0");
    setOutputFileName("script.png");
  }

  function exportJson() {
    downloadJson(card, outputFileName);
    setMsg("JSON exported!", true);
  }

  async function exportPng() {
    try {
      const pngBytes = await getCarrierPng(imageSrc);
      const json = JSON.stringify(card);
      downloadPng(encodeCharaToPng(pngBytes, json, "script", false), outputFileName);
      setMsg("PNG exported!", true);
    } catch (err) {
      setMsg(`PNG export failed: ${(err as Error).message}`, false);
    }
  }

  async function handleSaveToLibrary() {
    setSaving(true);
    try {
      const versionChanged = !!libraryId && card.version.trim() !== savedVersion;
      const saved = await saveAnyCard("script", card.name || "Unnamed Script", card, imageSrc, card.tags, versionChanged ? undefined : libraryId);
      setLibraryId(saved.id);
      setSavedVersion(card.version);
      setMsg(versionChanged ? "Saved as new version!" : libraryId ? "Library updated!" : "Saved to library!", true);
    } catch {
      setMsg("Failed to save to library.", false);
    }
    setSaving(false);
  }

  return (
    <div className="h-full flex overflow-hidden">
      {/* ── Main editor area ── */}
      <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4 min-w-0">

        {/* Page title */}
        <div>
          <h1 className="text-lg font-bold text-text-primary flex items-center gap-2">
            <FileCode2 size={20} className="text-accent-purple" /> Script Card
          </h1>
          <p className="text-sm text-text-secondary mt-0.5">Write JavaScript for SillyTavern extensions or automation scripts.</p>
        </div>

        {/* Compact meta row */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label-base">Script Name</label>
            <input className="input-base" placeholder="My Script..." value={card.name} onChange={(e) => update({ name: e.target.value })} />
          </div>
          <div>
            <label className="label-base">Author</label>
            <input className="input-base" placeholder="Your name..." value={card.author} onChange={(e) => update({ author: e.target.value })} />
          </div>
          <div>
            <label className="label-base">Description</label>
            <input className="input-base" placeholder="What does this script do?" value={card.description} onChange={(e) => update({ description: e.target.value })} />
          </div>
        </div>

        {/* Code editor — fills remaining vertical space */}
        <div className="flex-1 min-h-0">
          <CodeEditor value={card.content} onChange={(v) => update({ content: v })} />
        </div>

        {/* Creator Notes */}
        <div>
          <label className="label-base">Creator Notes</label>
          <ResizableTextArea
            rows={3}
            placeholder="Notes for users of this script — usage instructions, requirements, changelog..."
            value={card.creator_notes}
            onChange={(e) => update({ creator_notes: e.target.value })}
          />
        </div>

        {/* Tags */}
        <TagInput
          label="Tags (comma-separated)"
          placeholder="roleplay, assistant, narration..."
          tags={card.tags}
          onChange={(tags) => update({ tags })}
        />
      </div>

      {/* ── Export panel ── */}
      <aside className="w-64 border-l border-border bg-bg-secondary flex flex-col shrink-0 p-4 gap-3">
        <p className="section-title">Export</p>

        <ImageDropzone label="Cover Image" imageSrc={imageSrc} onFile={setImageSrc} />

        {/* Output Settings */}
        <div className="border-t border-border pt-3 space-y-2">
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Output Settings</p>
          <div>
            <label className="label-base">Output File</label>
            <input
              className="input-base text-xs"
              value={outputFileName}
              onChange={(e) => setOutputFileName(e.target.value)}
            />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-muted">Metadata key</span>
            <code className="text-accent-purple-light bg-bg-tertiary px-1.5 py-0.5 rounded font-mono">script</code>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-muted">Version</span>
            <input className="input-base py-0.5 text-xs w-20 text-right" value={card.version} onChange={(e) => update({ version: e.target.value })} />
          </div>
        </div>

        <div className="border-t border-border pt-3 space-y-2">
          <button onClick={handleSaveToLibrary} disabled={saving} className="btn-primary w-full justify-center py-2.5">
            <Save size={14} /> {saving ? "Saving…" : libraryId ? "Update in Library" : "Save to Library"}
          </button>
          <ConfirmClearPanel label="Script Card" onConfirm={clearForNew} />
        </div>

        <div className="space-y-2">
          <button onClick={exportJson} className="btn-secondary w-full justify-center py-2">
            <FileJson size={14} /> Export JSON
          </button>
          <button onClick={exportPng} className="btn-secondary w-full justify-center py-2">
            <Download size={14} /> Embed in PNG
          </button>
        </div>

        {status && (
          <p
            role="status"
            aria-live="polite"
            className={`text-xs text-center ${status.ok ? "text-status-ok" : "text-status-danger"}`}
          >
            {status.msg}
          </p>
        )}

        <div className="border-t border-border pt-3 mt-auto text-xs text-text-muted space-y-1.5">
          <p><strong className="text-text-secondary">JSON</strong> — portable card format.</p>
          <p><strong className="text-text-secondary">PNG</strong> — embeds the script using the <code className="bg-bg-tertiary px-1 rounded">script</code> chunk.</p>
        </div>
      </aside>
    </div>
  );
}

// ─────────────────────────────────────────────
// Dark code editor with line numbers
// ─────────────────────────────────────────────
function CodeEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef   = useRef<HTMLDivElement>(null);

  // Count newlines with a regex instead of allocating a split array on every keystroke.
  const lineCount = useMemo(
    () => (value.match(/\n/g)?.length ?? 0) + 1,
    [value]
  );

  // Memoize the gutter line-number divs so they only rebuild when count changes.
  const gutterLines = useMemo(
    () => Array.from({ length: lineCount }, (_, i) => (
      <div key={i} style={{ height: "1.65em" }}>{i + 1}</div>
    )),
    [lineCount]
  );

  const syncScroll = useCallback(() => {
    if (gutterRef.current && textareaRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);

  // Tab inserts an indent here, which means Tab can't also move focus — and
  // with no way out that is a keyboard trap (WCAG 2.1.2, a Level A failure).
  // Escape arms an exit: the next Tab leaves the field as it normally would.
  const [escaped, setEscaped] = useState(false);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Escape") {
      setEscaped(true);
      return;
    }

    if (e.key !== "Tab") {
      if (escaped) setEscaped(false);
      return;
    }

    if (escaped) {
      // Let the browser move focus, and re-arm the trap for next time.
      setEscaped(false);
      return;
    }

    e.preventDefault();
    const ta = e.currentTarget;
    const start = ta.selectionStart;
    const end   = ta.selectionEnd;
    const next  = value.substring(0, start) + "  " + value.substring(end);
    onChange(next);
    requestAnimationFrame(() => {
      ta.selectionStart = ta.selectionEnd = start + 2;
    });
  }

  return (
    <div
      className="flex flex-col h-full rounded-lg overflow-hidden"
      style={{ background: "#1a1d2e", border: "1px solid rgba(100,110,160,0.2)" }}
    >
      {/* Header bar */}
      <div
        className="flex items-center gap-2 px-4 py-2 shrink-0"
        style={{
          borderBottom: "1px solid rgba(100,110,160,0.15)",
          color: "#7a8aaa",
          fontSize: "11px",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          fontFamily: "ui-monospace, monospace",
        }}
      >
        <span>Script Code</span>
        <span style={{ color: "#a78bfa" }}>◆</span>
        <span>JavaScript</span>
        <span style={{ marginLeft: "auto", textTransform: "none", letterSpacing: 0, opacity: 0.7 }}>
          Tab indents · Esc then Tab to leave
        </span>
      </div>

      {/* Editor body: gutter + textarea side-by-side */}
      <div className="flex flex-1 overflow-hidden">

        {/* Line-number gutter */}
        <div
          ref={gutterRef}
          className="overflow-hidden shrink-0 select-none"
          style={{
            paddingTop: "14px",
            paddingBottom: "14px",
            paddingLeft: "12px",
            paddingRight: "12px",
            minWidth: "3.5rem",
            textAlign: "right",
            background: "#1a1d2e",
            color: "#3d4a6b",
            fontFamily: "ui-monospace, 'Cascadia Code', 'Fira Code', monospace",
            fontSize: "13px",
            lineHeight: "1.65",
            borderRight: "1px solid rgba(100,110,160,0.12)",
          }}
        >
          {gutterLines}
        </div>

        {/* Code textarea — resize disabled because the editor manages its own scroll */}
        <textarea
          ref={textareaRef}
          aria-label="Script code, JavaScript. Tab inserts an indent; press Escape then Tab to move focus out."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={syncScroll}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          autoCapitalize="none"
          autoCorrect="off"
          placeholder="// Start writing your JavaScript here...&#10;&#10;// Example:&#10;// const greeting = (name) => `Hello, ${name}!`;"
          style={{
            flex: 1,
            background: "transparent",
            color: "#c8d3f5",
            caretColor: "#c8d3f5",
            fontFamily: "ui-monospace, 'Cascadia Code', 'Fira Code', monospace",
            fontSize: "13px",
            lineHeight: "1.65",
            padding: "14px 16px",
            outline: "none",
            resize: "none",
            border: "none",
            overflowY: "auto",
          }}
        />
      </div>
    </div>
  );
}
