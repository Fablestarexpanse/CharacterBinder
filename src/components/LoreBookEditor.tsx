import { useState } from "react";
import {
  Plus, Trash2, BookOpen, FileJson, ChevronDown, ChevronUp,
  ToggleLeft, ToggleRight, Copy, Check, ClipboardPaste,
} from "lucide-react";
import type { LoreBook, LoreEntry } from "../types";
import { countTokens, getTokenBudgetLevel, TOKEN_BUDGET_COLORS, TOKEN_BUDGET_BAR_COLORS } from "../lib/tokenizer";

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

export default function LoreBookEditor() {
  const [book, setBook] = useState<LoreBook>(DEFAULT_BOOK);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<{ msg: string; ok: boolean } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

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
      entries: b.entries.map((e) => e.id === id ? { ...e, ...patch } : e),
    }));
  }

  function toggleEnabled(id: string) {
    const entry = book.entries.find((e) => e.id === id);
    if (entry) updateEntry(id, { enabled: !entry.enabled });
  }

  function exportJson() {
    // Export in SillyTavern lorebook format
    const exported = {
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
    const json = JSON.stringify(exported, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (book.name || "lorebook").replace(/\s+/g, "_") + ".json";
    a.click();
    URL.revokeObjectURL(url);
    setStatus({ msg: "Lorebook exported!", ok: true });
    setTimeout(() => setStatus(null), 3000);
  }

  const selected = book.entries.find((e) => e.id === selectedId) ?? null;
  const totalTokens = book.entries.reduce((sum, e) => sum + countTokens(e.content), 0);
  const level = getTokenBudgetLevel(totalTokens);

  return (
    <div className="h-full flex overflow-hidden">
      {/* Entry list sidebar */}
      <div className="w-64 border-r border-border bg-bg-secondary flex flex-col shrink-0">
        {/* Book header */}
        <div className="p-3 border-b border-border space-y-2">
          <div className="flex items-center gap-2">
            <BookOpen size={16} className="text-accent-purple shrink-0" />
            <input
              className="input-base py-1 text-sm font-semibold"
              placeholder="Lorebook name..."
              value={book.name}
              onChange={(e) => updateBook({ name: e.target.value })}
            />
          </div>

          {/* Settings toggle */}
          <button
            onClick={() => setSettingsOpen(!settingsOpen)}
            className="w-full flex items-center justify-between text-xs text-text-muted hover:text-text-primary transition-colors px-1"
          >
            <span>Settings</span>
            {settingsOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          {settingsOpen && (
            <div className="space-y-2 pt-1">
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

        {/* Entry list */}
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

        {/* Add entry + export */}
        <div className="border-t border-border p-3 space-y-2">
          <button onClick={addEntry} className="btn-primary w-full justify-center py-2 text-sm">
            <Plus size={14} /> Add Entry
          </button>
          <button onClick={exportJson} className="btn-secondary w-full justify-center py-1.5 text-xs">
            <FileJson size={13} /> Export Lorebook JSON
          </button>
          {status && (
            <p className={`text-xs text-center ${status.ok ? "text-green-600" : "text-red-500"}`}>{status.msg}</p>
          )}
        </div>
      </div>

      {/* Entry editor */}
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
            <p className="text-xs mt-1">Add an entry or click one to edit it.</p>
          </div>
          <div className="mt-4 text-xs text-text-muted text-center max-w-sm space-y-1.5">
            <p>Lorebooks let you define world knowledge that triggers when keywords appear in conversation.</p>
            <p>Each entry has <strong className="text-text-secondary">trigger keys</strong> and <strong className="text-text-secondary">content</strong> that gets injected into context.</p>
          </div>
        </div>
      )}

      {/* Token summary bar */}
      {book.entries.length > 0 && (
        <div className="absolute bottom-0 left-64 right-0 border-t border-border bg-bg-secondary px-4 py-2 flex items-center gap-3 text-xs">
          <span className="text-text-muted">{book.entries.length} entries</span>
          <span className="text-text-muted">·</span>
          <span className={`font-medium ${TOKEN_BUDGET_COLORS[level]}`}>{totalTokens} tokens total</span>
          <div className="flex-1 h-1 bg-bg-tertiary rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${TOKEN_BUDGET_BAR_COLORS[level]}`}
              style={{ width: `${Math.min((totalTokens / book.token_budget) * 100, 100)}%` }}
            />
          </div>
          <span className="text-text-muted">budget: {book.token_budget}</span>
        </div>
      )}
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
    <div className="flex-1 overflow-y-auto px-6 py-5 pb-12 space-y-4">
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

      {/* Content */}
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
                <button type="button" onClick={paste} className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"><ClipboardPaste size={12} /></button>
                {hint && <div className="absolute right-0 top-6 z-10 whitespace-nowrap bg-gray-800 text-white text-xs px-2 py-1 rounded shadow-lg">Press Ctrl+V</div>}
              </div>
            </div>
          </div>
        </div>
        <textarea
          className="input-base resize-none"
          rows={8}
          placeholder="Dragons are ancient creatures of immense power. They are known for their ability to breathe fire..."
          value={entry.content}
          onChange={(e) => onChange({ content: e.target.value })}
        />
      </div>

      {/* Options row */}
      <div className="grid grid-cols-3 gap-3">
        <ToggleField label="Enabled" value={entry.enabled} onChange={(v) => onChange({ enabled: v })} />
        <ToggleField label="Constant" value={entry.constant} onChange={(v) => onChange({ constant: v })} description="Always inject" />
        <ToggleField label="Selective" value={entry.selective} onChange={(v) => onChange({ selective: v })} description="Require secondary key" />
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
