import { useState, useRef, useMemo } from "react";
import ResizableTextArea from "../ui/ResizableTextArea";
import {
  Plus, Trash2, BookOpen, Upload,
  ChevronDown, ChevronUp,
  ToggleLeft, ToggleRight,
} from "lucide-react";
import type { LoreBook, LoreEntry } from "../../types";
import { countTokens, getTokenBudgetLevel, TOKEN_BUDGET_COLORS } from "../../lib/tokenizer";
import { parseLorebook, toExportedLorebook } from "../../lib/lorebook";
import { blankLoreBook } from "../../lib/blankCards";
import { useDataCardEditor } from "../../hooks/useDataCardEditor";
import ImageDropzone from "../ui/ImageDropzone";
import CardExportPanel from "../editor/CardExportPanel";
import TagInput from "../ui/TagInput";

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


interface LoreBookEditorProps {
  initialCard?: LoreBook;
  initialImageSrc?: string | null;
  initialLibraryId?: string;
}

export default function LoreBookEditor({ initialCard, initialImageSrc, initialLibraryId }: LoreBookEditorProps) {
  const {
    card: book, update: updateBook, setCard: setBook,
    imageSrc, setImageSrc, libraryId, saving, status, setMsg,
    outputFileName, setOutputFileName,
    save: handleSaveToLibrary, exportJson, exportPng, clear,
  } = useDataCardEditor({
    cardType: "lorebook",
    blank: blankLoreBook,
    initialCard: initialCard,
    initialImageSrc,
    initialLibraryId,
    // Files carry SillyTavern's positional entry format; the editor holds its
    // own UUID-keyed one.
    toExport: toExportedLorebook,
    // A lorebook has no tags of its own, so the library indexes it by the keys
    // its entries trigger on.
    tagsOf: (b) => b.entries.flatMap((e) => e.keys).slice(0, 10),
  });

  const [selectedId, setSelectedId] = useState<string | null>(initialCard?.entries[0]?.id ?? null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draggingJson, setDraggingJson] = useState(false);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  function addEntry() {
    const entry = DEFAULT_ENTRY();
    setBook({ ...book, entries: [...book.entries, entry] });
    setSelectedId(entry.id);
  }

  function deleteEntry(id: string) {
    const remaining = book.entries.filter((e) => e.id !== id);
    setBook({ ...book, entries: remaining });
    // Select the entry that took its place, or the new last one.
    if (selectedId === id) {
      const removedAt = book.entries.findIndex((e) => e.id === id);
      setSelectedId(remaining[Math.min(removedAt, remaining.length - 1)]?.id ?? null);
    }
  }

  function updateEntry(id: string, patch: Partial<LoreEntry>) {
    updateBook({ entries: book.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)) });
  }

  function toggleEnabled(id: string) {
    updateEntry(id, { enabled: !book.entries.find((e) => e.id === id)?.enabled });
  }

  function handleJsonFile(file: File) {
    if (!file.name.endsWith(".json")) { setMsg("Please drop a .json file.", false); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = parseLorebook(JSON.parse(e.target?.result as string));
        setBook(parsed);
        setSelectedId(parsed.entries[0]?.id ?? null);
        setMsg(`Imported "${parsed.name || file.name}" — ${parsed.entries.length} entries`, true);
      } catch {
        setMsg("Failed to parse lorebook JSON.", false);
      }
    };
    reader.readAsText(file);
  }

  function clearForNew() {
    clear();
    setSelectedId(null);
  }

  const selected = book.entries.find((e) => e.id === selectedId) ?? null;

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
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 pointer-events-none bg-accent-purple/10 border-2 border-dashed border-accent-purple/50">
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
          <ResizableTextArea
            className="input-base text-xs"
            rows={2}
            placeholder="Brief description..."
            value={book.description}
            onChange={(e) => updateBook({ description: e.target.value })}
          />
          <input
            className="input-base text-xs"
            placeholder="Creator name..."
            value={book.creator}
            onChange={(e) => updateBook({ creator: e.target.value })}
          />
          <ResizableTextArea
            className="input-base text-xs"
            rows={2}
            placeholder="Creator notes — usage tips, content warnings, changelog..."
            value={book.creator_notes}
            onChange={(e) => updateBook({ creator_notes: e.target.value })}
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
                  className="shrink-0 opacity-0 group-hover:opacity-100 text-text-muted hover:text-status-danger transition-all"
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
        <p className="section-title">Export</p>

        <ImageDropzone label="Cover Image" imageSrc={imageSrc} onFile={setImageSrc} />

        <CardExportPanel
          cardType="lorebook"
          label="Lorebook"
          outputFileName={outputFileName}
          onOutputFileNameChange={setOutputFileName}
          version={book.version}
          onVersionChange={(version) => updateBook({ version })}
          saving={saving}
          libraryId={libraryId}
          onSave={handleSaveToLibrary}
          onExportJson={exportJson}
          onExportPng={exportPng}
          onClear={clearForNew}
          status={status}
          outputExtras={
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-muted">Entries</span>
              <span className="font-medium text-text-primary">{book.entries.length}</span>
            </div>
          }
          belowOutput={
            <div className="border-t border-border pt-3">
              <button
                onClick={() => setSettingsOpen(!settingsOpen)}
                aria-expanded={settingsOpen}
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
          }
          footnotes={
            <>
              <p><strong className="text-text-secondary">JSON</strong> — SillyTavern-compatible lorebook format.</p>
              <p><strong className="text-text-secondary">PNG</strong> — embeds lorebook in a <code className="bg-bg-tertiary px-1 rounded">lorebook</code> chunk.</p>
            </>
          }
        />
      </aside>
    </div>
  );
}

function EntryEditor({ entry, onChange }: {
  entry: LoreEntry;
  onChange: (patch: Partial<LoreEntry>) => void;
}) {
  // Re-ran on every keystroke of the very field it measures.
  const tokens = useMemo(() => countTokens(entry.content), [entry.content]);
  const entryLevel = getTokenBudgetLevel(tokens);

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

      {/* Trigger keys — uses TagInput to fix the split-on-comma bug */}
      <TagInput
        label="Trigger Keys (comma-separated)"
        placeholder="dragon, wyrm, firebreather..."
        tags={entry.keys}
        onChange={(keys) => onChange({ keys })}
      />

      {entry.selective && (
        <TagInput
          label="Secondary Keys (requires one of these too)"
          placeholder="fire, attack, breath..."
          tags={entry.secondary_keys}
          onChange={(secondary_keys) => onChange({ secondary_keys })}
        />
      )}

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="label-base mb-0">Content</label>
          <div className="flex items-center gap-2">
            {tokens > 0 && <span className={`text-xs font-medium ${TOKEN_BUDGET_COLORS[entryLevel]}`}>{tokens} tk</span>}
          </div>
        </div>
        <ResizableTextArea
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
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-label={description ? `${label} — ${description}` : label}
      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border cursor-pointer transition-colors text-left ${value ? "border-accent-purple/40 bg-accent-purple/5" : "border-border"}`}
      onClick={() => onChange(!value)}
    >
      <div>
        <p className="text-xs font-medium text-text-primary">{label}</p>
        {description && <p className="text-[10px] text-text-muted">{description}</p>}
      </div>
      {value ? <ToggleRight size={16} className="text-accent-purple shrink-0" /> : <ToggleLeft size={16} className="text-text-muted shrink-0" />}
    </button>
  );
}
