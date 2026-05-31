import { useState, useRef, useCallback } from "react";
import { Download, FileJson, FileCode2, Save } from "lucide-react";
import type { ScriptCard } from "../types";
import { countTokens, getTokenBudgetLevel, TOKEN_BUDGET_COLORS, TOKEN_BUDGET_BAR_COLORS } from "../lib/tokenizer";
import { encodeCharaToPng } from "../lib/pngMetadata";
import { saveAnyCard } from "../lib/library";

const DEFAULT: ScriptCard = {
  spec: "script_card_v1",
  name: "",
  description: "",
  content: "",
  tags: [],
  author: "",
  version: "1.0",
};

const MINIMAL_PNG = new Uint8Array([
  137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,
  0,0,0,1,0,0,0,1,8,2,0,0,0,144,119,83,222,
  0,0,0,12,73,68,65,84,8,215,99,248,207,0,0,0,2,0,1,
  226,33,188,51,0,0,0,0,73,69,78,68,174,66,96,130,
]);

interface ScriptEditorProps {
  initialCard?: ScriptCard;
  initialImageSrc?: string | null;
  initialLibraryId?: string;
}

export default function ScriptEditor({ initialCard, initialImageSrc, initialLibraryId }: ScriptEditorProps) {
  const [card, setCard] = useState<ScriptCard>(initialCard ?? DEFAULT);
  const [status, setStatus] = useState<{ msg: string; ok: boolean } | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(initialImageSrc ?? null);
  const [libraryId, setLibraryId] = useState<string | undefined>(initialLibraryId);
  const [saving, setSaving] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [outputFileName, setOutputFileName] = useState(
    ((initialCard?.name || "script").replace(/\s+/g, "_")) + "_script.png"
  );
  const imageInputRef = useRef<HTMLInputElement>(null);

  function update(patch: Partial<ScriptCard>) {
    setCard((c) => ({ ...c, ...patch }));
  }

  function setMsg(msg: string, ok: boolean) {
    setStatus({ msg, ok });
    setTimeout(() => setStatus(null), 3000);
  }

  function clearForNew() {
    setCard(DEFAULT);
    setImageSrc(null);
    setLibraryId(undefined);
    setOutputFileName("script.png");
    setConfirmClear(false);
    setStatus(null);
  }

  function handleImageFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => { if (e.target?.result) setImageSrc(e.target.result as string); };
    reader.readAsDataURL(file);
  }

  function exportJson() {
    const json = JSON.stringify(card, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = outputFileName.replace(/\.png$/, ".json");
    a.click();
    URL.revokeObjectURL(url);
    setMsg("JSON exported!", true);
  }

  function exportPng() {
    try {
      let pngBytes: Uint8Array;
      if (imageSrc?.startsWith("data:image/")) {
        const b64 = imageSrc.split(",")[1];
        pngBytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      } else {
        pngBytes = MINIMAL_PNG;
      }
      const json = JSON.stringify(card);
      const result = encodeCharaToPng(pngBytes, json, "script" as never, false);
      const blob = new Blob([result.buffer as ArrayBuffer], { type: "image/png" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = outputFileName;
      a.click();
      URL.revokeObjectURL(url);
      setMsg("PNG exported!", true);
    } catch {
      setMsg("PNG export failed.", false);
    }
  }

  async function handleSaveToLibrary() {
    setSaving(true);
    try {
      const saved = await saveAnyCard("script", card.name || "Unnamed Script", card, imageSrc, card.tags, libraryId);
      setLibraryId(saved.id);
      setMsg(libraryId ? "Library updated!" : "Saved to library!", true);
    } catch {
      setMsg("Failed to save to library.", false);
    }
    setSaving(false);
  }

  const tokens = countTokens(card.content);
  const level = getTokenBudgetLevel(tokens);
  const barPct = Math.min((tokens / 3000) * 100, 100);

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

        {/* Tags */}
        <div>
          <label className="label-base">Tags (comma-separated)</label>
          <input className="input-base" placeholder="roleplay, assistant, narration..." value={card.tags.join(", ")} onChange={(e) => update({ tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })} />
          {card.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {card.tags.map((t) => <span key={t} className="badge-purple">{t}</span>)}
            </div>
          )}
        </div>
      </div>

      {/* ── Export panel ── */}
      <aside className="w-64 border-l border-border bg-bg-secondary flex flex-col shrink-0 p-4 gap-3">
        <p className="section-title">Export</p>

        {/* Cover image */}
        <div>
          <label className="label-base">Cover Image</label>
          <div
            className="w-full h-28 rounded-xl border-2 border-dashed border-border hover:border-accent-purple/50 transition-colors cursor-pointer overflow-hidden relative group bg-bg-tertiary flex items-center justify-center"
            onClick={() => imageInputRef.current?.click()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.type.startsWith("image/")) handleImageFile(f); }}
            onDragOver={(e) => e.preventDefault()}
          >
            {imageSrc
              ? <img src={imageSrc} alt="cover" className="w-full h-full object-cover" />
              : <span className="text-xs text-text-muted text-center px-2">Drop image or click<br /><span className="text-[10px]">(optional)</span></span>
            }
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <span className="text-xs text-white">Change</span>
            </div>
          </div>
          <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageFile(f); }} />
        </div>

        <div className="space-y-1 text-xs">
          <div className="flex justify-between"><span className="text-text-muted">Tokens</span><span className={`font-bold ${TOKEN_BUDGET_COLORS[level]}`}>{tokens}</span></div>
          <div className="flex justify-between items-center"><span className="text-text-muted">Version</span><input className="input-base py-0.5 text-xs w-20 text-right" value={card.version} onChange={(e) => update({ version: e.target.value })} /></div>
          {tokens > 0 && (
            <div className="w-full h-1 bg-bg-tertiary rounded-full overflow-hidden mt-1">
              <div className={`h-full rounded-full ${TOKEN_BUDGET_BAR_COLORS[level]}`} style={{ width: `${barPct}%` }} />
            </div>
          )}
        </div>

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
        </div>

        <div className="border-t border-border pt-3 space-y-2">
          <button onClick={handleSaveToLibrary} disabled={saving} className="btn-primary w-full justify-center py-2.5">
            <Save size={14} /> {saving ? "Saving…" : libraryId ? "Update in Library" : "Save to Library"}
          </button>
          {!confirmClear ? (
            <button
              onClick={() => setConfirmClear(true)}
              className="w-full flex items-center justify-center gap-2 text-xs py-2 rounded-lg border border-dashed border-border text-text-secondary hover:border-red-400/60 hover:text-red-500 hover:bg-red-50 transition-colors"
            >
              <span className="text-base leading-none">+</span> New Script Card
            </button>
          ) : (
            <div className="rounded-lg border border-red-300/50 bg-red-50 px-3 py-2.5 space-y-2">
              <p className="text-xs font-medium text-red-700">Clear this script and start fresh?</p>
              <p className="text-[11px] text-red-500">Library saves are not affected.</p>
              <div className="flex gap-2">
                <button onClick={clearForNew} className="flex-1 text-xs py-1.5 rounded-md bg-red-500 text-white hover:bg-red-600 transition-colors">Yes, clear it</button>
                <button onClick={() => setConfirmClear(false)} className="flex-1 text-xs py-1.5 rounded-md border border-red-300/60 text-red-600 hover:bg-red-100 transition-colors">Cancel</button>
              </div>
            </div>
          )}
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
          <p className={`text-xs text-center ${status.ok ? "text-green-600" : "text-red-500"}`}>{status.msg}</p>
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

  const lineCount = Math.max(1, value.split("\n").length);

  const syncScroll = useCallback(() => {
    if (gutterRef.current && textareaRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Tab") {
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
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i} style={{ height: "1.65em" }}>{i + 1}</div>
          ))}
        </div>

        {/* Code textarea */}
        <textarea
          ref={textareaRef}
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
