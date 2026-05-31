import { useState, useRef } from "react";
import {
  Plus, Trash2, BookOpen, FileJson, Download, Save, Upload,
  ChevronDown, ChevronUp,
  ToggleLeft, ToggleRight, Copy, Check, ClipboardPaste,
} from "lucide-react";
import type { LoreBook, LoreEntry } from "../types";
import { countTokens, getTokenBudgetLevel, TOKEN_BUDGET_COLORS, TOKEN_BUDGET_BAR_COLORS } from "../lib/tokenizer";
import { encodeCharaToPng } from "../lib/pngMetadata";
import { saveAnyCard } from "../lib/library";

const DEFAULT_ENTRY = (): LoreEntry => ({
  id: crypto.randomUUID(),
  name: "",
  keys: [],
  secondary_keys: [],
  content: "",
  enabled: true,
  insertion_order: 100,
  case_sensitive: false,
  priority: 10,
  selective: false,
  constant: false,
  position: "before_char",
  comment: "",
});

const DEFAULT_BOOK: LoreBook = {
  name: "",
  description: "",
  scan_depth: 50,
  token_budget: 512,
  recursive_scanning: false,
  entries: [],
};

const MINIMAL_PNG = new Uint8Array([
  137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,
  0,0,0,1,0,0,0,1,8,2,0,0,0,144,119,83,222,
  0,0,0,12,73,68,65,84,8,215,99,248,207,0,0,0,2,0,1,
  226,33,188,51,0,0,0,0,73,69,78,68,174,66,96,130,
]);

// ─── SillyTavern lorebook JSON parser ───────────────────────────────────────
// ST entries can be an object keyed by numeric strings OR a plain array.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseSillyTavernLorebook(raw: any): LoreBook {
  const name: string               = raw.name              ?? "";
  const description: string        = raw.description       ?? "";
  const scan_depth: number         = raw.scan_depth        ?? 50;
  const token_budget: number       = raw.token_budget      ?? 512;
  const recursive_scanning: boolean = raw.recursive_scanning ?? false;

  // Entries: handle both object-map {"0": {...}, "1": {...}} and array [{...}]
  let rawEntries: unknown[];
  if (Array.isArray(raw.entries)) {
    rawEntries = raw.entries;
  } else if (raw.entries && typeof raw.entries === "object") {
    rawEntries = Object.values(raw.entries);
  } else {
    rawEntries = [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entries: LoreEntry[] = rawEntries.map((e: any) => ({
    id:               crypto.randomUUID(),
    name:             e.name             ?? e.comment ?? "",
    comment:          e.comment          ?? e.name    ?? "",
    keys:             Array.isArray(e.keys)           ? e.keys           : [],
    secondary_keys:   Array.isArray(e.secondary_keys) ? e.secondary_keys : [],
    content:          e.content          ?? "",
    enabled:          e.enabled          ?? true,
    insertion_order:  e.insertion_order  ?? 100,
    case_sensitive:   e.case_sensitive   ?? false,
    priority:         e.priority         ?? 10,
    selective:        e.selective        ?? false,
    constant:         e.constant         ?? false,
    position:         (e.position === "after_char" ? "after_char" : "before_char") as LoreEntry["position"],
  }));

  return { name, description, scan_depth, token_budget, recursive_scanning, entries };
}

interface LoreBookEditorProps {
  initialBook?: LoreBook;
  initialImageSrc?: string | null;
  initialLibraryId?: string;
}

export default function LoreBookEditor({ initialBook, initialImageSrc, initialLibraryId }: LoreBookEditorProps) {
  const [book, setBook] = useState<LoreBook>(initialBook ?? DEFAULT_BOOK);
  const [selectedId, setSelectedId] = useState<string | null>(initialBook?.entries[0]?.id ?? null);
  const [status, setStatus] = useState<{ msg: string; ok: boolean } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(initialImageSrc ?? null);
  const [libraryId, setLibraryId] = useState<string | undefined>(initialLibraryId);
  const [saving, setSaving] = useState(false);
  const [draggingJson, setDraggingJson] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef  = useRef<HTMLInputElement>(null);

  function updateBook(patch: Partial<LoreBook>) {
    setBook((b) => ({ ...b, ...patch }));
  }

  function addEntry() {
    const entry = DEFAULT_ENTRY();
    setBook((b) => ({ ...b, entries: [...b.entries, entry] }));
    setSelectedId(entry.id);
  }

  function deleteEntry(id: string) {
    setBook((b) => ({ ...b, entries: b.entries.filter((e) => e.id !== id) }));
    if (selectedId === id) setSelectedId(book.entries.find((e) => e.id !== id)?.id ?? null);
  }

  function updateEntry(id: string, patch: Partial<LoreEntry>) {
    setBook((b) => ({
      ...b,
      entries: b.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }));
  }

  function toggleEnabled(id: string) {
    const entry = book.entries.find((e) => e.id === id);
    if (entry) updateEntry(id, { enabled: !entry.enabled });
  }

  function handleImageFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => { if (e.target?.result) setImageSrc(e.target.result as string); };
    reader.readAsDataURL(file);
  }

  function handleJsonFile(file: File) {
    if (!file.name.endsWith(".json")) { setMsg("Please drop a .json file.", false); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const raw = JSON.parse(e.target?.result as string);
        const parsed = parseSillyTavernLorebook(raw);
        setBook(parsed);
        setSelectedId(parsed.entries[0]?.id ?? null);
        setLibraryId(undefined); // treat as a new unsaved book
        setMsg(`Imported "${parsed.name || file.name}" — ${parsed.entries.length} entries`, true);
      } catch {
        setMsg("Failed to parse lorebook JSON.", false);
      }
    };
    reader.readAsText(file);
  }

  function setMsg(msg: string, ok: boolean) {
    setStatus({ msg, ok });
    setTimeout(() => setStatus(null), 3000);
  }

  function clearForNew() {
    setBook(DEFAULT_BOOK);
    setSelectedId(null);
    setImageSrc(null);
    setLibraryId(undefined);
    setConfirmClear(false);
    setStatus(null);
  }

  function buildExportData() {
    return {
      name: book.name,
      description: book.description,
      scan_depth: book.scan_depth,
      token_budget: book.token_budget,
      recursive_scanning: book.recursive_scanning,
      extensions: {},
      entries: book.entries.map((e, i) => ({
        id: i,
        keys: e.keys,
        secondary_keys: e.secondary_keys,
        comment: e.comment || e.name,
        content: e.content,
        constant: e.constant,
        selective: e.selective,
        insertion_order: e.insertion_order,
        enabled: e.enabled,
        position: e.position,
        case_sensitive: e.case_sensitive,
        name: e.name,
        priority: e.priority,
        extensions: {},
      })),
    };
  }

  function exportJson() {
    const json = JSON.stringify(buildExportData(), null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (book.name || "lorebook").replace(/\s+/g, "_") + ".json";
    a.click();
    URL.revokeObjectURL(url);
    setMsg("Lorebook JSON exported!", true);
  }

  async function exportPng() {
    try {
      let pngBytes: Uint8Array;
      if (imageSrc?.startsWith("data:image/")) {
        const b64 = imageSrc.split(",")[1];
        pngBytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      } else {
        pngBytes = MINIMAL_PNG;
      }
      const json = JSON.stringify(buildExportData());
      const result = encodeCharaToPng(pngBytes, json, "lorebook" as never, false);
      const blob = new Blob([result.buffer as ArrayBuffer], { type: "image/png" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = (book.name || "lorebook").replace(/\s+/g, "_") + "_lorebook.png";
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
      const allKeys = book.entries.flatMap((e) => e.keys);
      const saved = await saveAnyCard(
        "lorebook",
        book.name || "Unnamed Lorebook",
        buildExportData(),
        imageSrc,
        allKeys.slice(0, 10),
        libraryId
      );
      setLibraryId(saved.id);
      setMsg(libraryId ? "Library updated!" : "Saved to library!", true);
    } catch {
      setMsg("Failed to save to library.", false);
    }
    setSaving(false);
  }

  const selected = book.entries.find((e) => e.id === selectedId) ?? null;
  const totalTokens = book.entries.reduce((sum, e) => sum + countTokens(e.content), 0);
  const level = getTokenBudgetLevel(totalTokens);
  const budgetPct = Math.min((totalTokens / Math.max(book.token_budget, 1)) * 100, 100);

  return (
    <div
      className="h-full flex overflow-hidden relative"
      onDragOver={(e) => { e.preventDefault(); if (e.dataTransfer.types.includes("Files")) setDraggingJson(true); }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDraggingJson(false); }}
      onDrop={(e) => {
        e.preventDefault();
        setDraggingJson(false);
        const file = Array.from(e.dataTransfer.files).find((f) => f.name.endsWith(".json"));
        if (file) handleJsonFile(file);
      }}
    >
      {/* Full-screen JSON drop overlay */}
      {draggingJson && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 pointer-events-none"
          style={{ background: "rgba(139,92,246,0.12)", border: "2px dashed rgba(139,92,246,0.5)" }}>
          <Upload size={36} className="text-accent-purple opacity-80" />
          <p className="text-sm font-semibold text-accent-purple">Drop SillyTavern lorebook JSON</p>
        </div>
      )}

      {/* Hidden JSON file input */}
      <input
        ref={jsonInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleJsonFile(f); e.target.value = ""; }}
      />

      {/* ── Entry list sidebar ── */}
      <div className="w-60 border-r border-border bg-bg-secondary flex flex-col shrink-0">
        <div className="p-3 border-b border-border space-y-2">
          <div className="flex items-center gap-2">
            <BookOpen size={15} className="text-accent-purple shrink-0" />
            <input
              className="input-base py-1 text-sm font-semibold flex-1 min-w-0"
              placeholder="Lorebook name..."
              value={book.name}
              onChange={(e) => updateBook({ name: e.target.value })}
            />
            <button
              onClick={() => jsonInputRef.current?.click()}
              title="Import SillyTavern lorebook JSON"
              className="shrink-0 p-1.5 rounded-lg text-text-muted hover:text-accent-purple hover:bg-accent-purple/10 transition-colors"
            >
              <Upload size={14} />
            </button>
          </div>
          <textarea
            className="input-base resize-none text-xs"
            rows={2}
            placeholder="Brief description..."
            value={book.description}
            onChange={(e) => updateBook({ description: e.target.value })}
          />
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {book.entries.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-text-muted">
              No entries yet.<br />Click + to add one.
            </div>
          ) : (
            book.entries.map((entry) => (
              <div
                key={entry.id}
                onClick={() => setSelectedId(entry.id)}
                className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors group ${
                  selectedId === entry.id
                    ? "bg-accent-purple/10 border-r-2 border-accent-purple"
                    : "hover:bg-bg-hover"
                }`}
              >
                <button
                  onClick={(e) => { e.stopPropagation(); toggleEnabled(entry.id); }}
                  className="shrink-0"
                  title={entry.enabled ? "Disable" : "Enable"}
                >
                  {entry.enabled
                    ? <ToggleRight size={15} className="text-accent-purple" />
                    : <ToggleLeft size={15} className="text-text-muted" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-medium truncate ${entry.enabled ? "text-text-primary" : "text-text-muted line-through"}`}>
                    {entry.name || "Untitled entry"}
                  </p>
                  <p className="text-[10px] text-text-muted truncate">
                    {entry.keys.join(", ") || "No keys"}
                  </p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteEntry(entry.id); }}
                  className="shrink-0 opacity-0 group-hover:opacity-100 text-text-muted hover:text-red-500 transition-all"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-border p-3">
          <button onClick={addEntry} className="btn-primary w-full justify-center py-2 text-sm">
            <Plus size={14} /> Add Entry
          </button>
        </div>
      </div>

      {/* ── Entry editor (center) ── */}
      {selected ? (
        <EntryEditor
          entry={selected}
          onChange={(patch) => updateEntry(selected.id, patch)}
        />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-text-muted">
          <BookOpen size={36} className="opacity-20" />
          <div className="text-center">
            <p className="text-sm font-medium text-text-secondary">No entry selected</p>
            <p className="text-xs mt-1">Add an entry or click one in the list to edit it.</p>
          </div>
          <div className="mt-4 text-xs text-text-muted text-center max-w-xs space-y-1.5">
            <p>Each entry has <strong className="text-text-secondary">trigger keys</strong> and <strong className="text-text-secondary">content</strong> that gets injected when those keywords appear in conversation.</p>
          </div>
          {/* Import hint */}
          <button
            onClick={() => jsonInputRef.current?.click()}
            className="mt-2 flex items-center gap-2 text-xs text-text-muted border border-dashed border-border rounded-lg px-4 py-2.5 hover:border-accent-purple/50 hover:text-accent-purple transition-colors"
          >
            <Upload size={13} />
            Import SillyTavern lorebook JSON
          </button>
          <p className="text-[10px] text-text-muted">or drag &amp; drop a .json file anywhere</p>
        </div>
      )}

      {/* ── Export panel (right) ── */}
      <aside className="w-64 border-l border-border bg-bg-secondary flex flex-col shrink-0 p-4 gap-3">
        <div className="flex items-center justify-between">
          <p className="section-title mb-0">Export</p>
          <button
            onClick={() => setConfirmClear(true)}
            className="text-xs text-text-muted hover:text-red-400 transition-colors flex items-center gap-1"
            title="Clear and start a new lorebook"
          >
            + New
          </button>
        </div>

        {/* Inline confirm banner */}
        {confirmClear && (
          <div className="rounded-lg border border-red-300/40 bg-red-50 px-3 py-2.5 space-y-2">
            <p className="text-xs text-red-700 font-medium">Clear this lorebook?</p>
            <p className="text-[11px] text-red-600">Unsaved changes will be lost. Library saves are not affected.</p>
            <div className="flex gap-2 pt-0.5">
              <button onClick={clearForNew} className="flex-1 text-xs py-1.5 rounded-md bg-red-500 text-white hover:bg-red-600 transition-colors">
                Yes, clear it
              </button>
              <button onClick={() => setConfirmClear(false)} className="flex-1 text-xs py-1.5 rounded-md border border-red-300/60 text-red-600 hover:bg-red-100 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}

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

        {/* Token stats */}
        <div className="space-y-1 text-xs">
          <div className="flex justify-between"><span className="text-text-muted">Entries</span><span className="font-medium text-text-primary">{book.entries.length}</span></div>
          <div className="flex justify-between"><span className="text-text-muted">Total tokens</span><span className={`font-bold ${TOKEN_BUDGET_COLORS[level]}`}>{totalTokens} tk</span></div>
          <div className="flex justify-between"><span className="text-text-muted">Budget</span><span className="font-medium text-text-primary">{book.token_budget} tk</span></div>
          <div className="w-full h-1 bg-bg-tertiary rounded-full overflow-hidden mt-1">
            <div className={`h-full rounded-full ${TOKEN_BUDGET_BAR_COLORS[level]}`} style={{ width: `${budgetPct}%` }} />
          </div>
        </div>

        {/* Book settings */}
        <div className="border-t border-border pt-3">
          <button
            onClick={() => setSettingsOpen(!settingsOpen)}
            className="w-full flex items-center justify-between text-xs text-text-secondary hover:text-text-primary transition-colors mb-2"
          >
            <span className="font-medium">Book Settings</span>
            {settingsOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          {settingsOpen && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-muted">Scan depth</span>
                <input type="number" className="input-base py-0.5 w-16 text-right text-xs" value={book.scan_depth} onChange={(e) => updateBook({ scan_depth: Number(e.target.value) })} />
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-muted">Token budget</span>
                <input type="number" className="input-base py-0.5 w-16 text-right text-xs" value={book.token_budget} onChange={(e) => updateBook({ token_budget: Number(e.target.value) })} />
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-muted">Recursive scan</span>
                <button onClick={() => updateBook({ recursive_scanning: !book.recursive_scanning })} className="text-accent-purple">
                  {book.recursive_scanning ? <ToggleRight size={18} /> : <ToggleLeft size={18} className="text-text-muted" />}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Save to Library */}
        <div className="border-t border-border pt-3">
          <button onClick={handleSaveToLibrary} disabled={saving} className="btn-primary w-full justify-center py-2.5">
            <Save size={14} /> {saving ? "Saving…" : libraryId ? "Update in Library" : "Save to Library"}
          </button>
        </div>

        {/* Export buttons */}
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
          <p><strong className="text-text-secondary">JSON</strong> — SillyTavern-compatible lorebook format.</p>
          <p><strong className="text-text-secondary">PNG</strong> — embeds lorebook in a <code className="bg-bg-tertiary px-1 rounded">lorebook</code> chunk.</p>
        </div>
      </aside>
    </div>
  );
}

function EntryEditor({ entry, onChange }: {
  entry: LoreEntry;
  onChange: (patch: Partial<LoreEntry>) => void;
}) {
  const tokens = countTokens(entry.content);
  const entryLevel = getTokenBudgetLevel(tokens);
  const [copied, setCopied] = useState(false);
  const [hint, setHint] = useState(false);

  function copy() { navigator.clipboard.writeText(entry.content); setCopied(true); setTimeout(() => setCopied(false), 1500); }
  async function paste() {
    try { const t = await navigator.clipboard.readText(); onChange({ content: entry.content + t }); }
    catch { setHint(true); setTimeout(() => setHint(false), 2500); }
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label-base">Entry Name</label>
          <input className="input-base" placeholder="Dragon Lore..." value={entry.name} onChange={(e) => onChange({ name: e.target.value })} />
        </div>
        <div>
          <label className="label-base">Comment / Note</label>
          <input className="input-base" placeholder="Internal note..." value={entry.comment} onChange={(e) => onChange({ comment: e.target.value })} />
        </div>
      </div>

      <div>
        <label className="label-base">Trigger Keys <span className="text-text-muted normal-case font-normal">(comma-separated)</span></label>
        <input
          className="input-base"
          placeholder="dragon, wyrm, firebreather..."
          value={entry.keys.join(", ")}
          onChange={(e) => onChange({ keys: e.target.value.split(",").map((k) => k.trim()).filter(Boolean) })}
        />
        {entry.keys.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {entry.keys.map((k) => <span key={k} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{k}</span>)}
          </div>
        )}
      </div>

      {entry.selective && (
        <div>
          <label className="label-base">Secondary Keys <span className="text-text-muted normal-case font-normal">(requires one of these too)</span></label>
          <input
            className="input-base"
            placeholder="fire, attack, breath..."
            value={entry.secondary_keys.join(", ")}
            onChange={(e) => onChange({ secondary_keys: e.target.value.split(",").map((k) => k.trim()).filter(Boolean) })}
          />
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="label-base mb-0">Content</label>
          <div className="flex items-center gap-2">
            {tokens > 0 && <span className={`text-xs font-medium ${TOKEN_BUDGET_COLORS[entryLevel]}`}>{tokens} tk</span>}
            <div className="flex items-center gap-1">
              <button type="button" onClick={copy} className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors">
                {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
              </button>
              <div className="relative">
                <button type="button" onClick={paste} className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors">
                  <ClipboardPaste size={12} />
                </button>
                {hint && <div className="absolute right-0 top-6 z-10 whitespace-nowrap bg-gray-800 text-white text-xs px-2 py-1 rounded shadow-lg">Press Ctrl+V</div>}
              </div>
            </div>
          </div>
        </div>
        <textarea
          className="input-base resize-none"
          rows={9}
          placeholder="Dragons are ancient creatures of immense power..."
          value={entry.content}
          onChange={(e) => onChange({ content: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ToggleField label="Enabled"        value={entry.enabled}        onChange={(v) => onChange({ enabled: v })} />
        <ToggleField label="Constant"       value={entry.constant}       onChange={(v) => onChange({ constant: v })}       description="Always inject" />
        <ToggleField label="Selective"      value={entry.selective}      onChange={(v) => onChange({ selective: v })}      description="Require 2nd key" />
        <ToggleField label="Case Sensitive" value={entry.case_sensitive} onChange={(v) => onChange({ case_sensitive: v })} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="label-base">Position</label>
          <select className="input-base text-sm" value={entry.position} onChange={(e) => onChange({ position: e.target.value as LoreEntry["position"] })}>
            <option value="before_char">Before char</option>
            <option value="after_char">After char</option>
          </select>
        </div>
        <div>
          <label className="label-base">Insertion Order</label>
          <input type="number" className="input-base" value={entry.insertion_order} onChange={(e) => onChange({ insertion_order: Number(e.target.value) })} />
        </div>
        <div>
          <label className="label-base">Priority</label>
          <input type="number" className="input-base" value={entry.priority} onChange={(e) => onChange({ priority: Number(e.target.value) })} />
        </div>
      </div>
    </div>
  );
}

function ToggleField({ label, value, onChange, description }: { label: string; value: boolean; onChange: (v: boolean) => void; description?: string }) {
  return (
    <div
      className={`flex items-center justify-between px-3 py-2 rounded-lg border cursor-pointer transition-colors ${value ? "border-accent-purple/40 bg-accent-purple/5" : "border-border"}`}
      onClick={() => onChange(!value)}
    >
      <div>
        <p className="text-xs font-medium text-text-primary">{label}</p>
        {description && <p className="text-[10px] text-text-muted">{description}</p>}
      </div>
      {value ? <ToggleRight size={16} className="text-accent-purple shrink-0" /> : <ToggleLeft size={16} className="text-text-muted shrink-0" />}
    </div>
  );
}
