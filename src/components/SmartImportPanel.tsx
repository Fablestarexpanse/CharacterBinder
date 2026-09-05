import { useState, useId } from "react";
import {
  Wand2, ChevronDown, ChevronRight, ClipboardPaste, X, AlertTriangle, Check,
  Sparkles, Settings2, Loader2, Zap,
} from "lucide-react";
import {
  parsePersonaText,
  toCharacterFields,
  PERSONA_FIELD_LABELS,
  CHARACTER_FIELD_LABELS,
  PERSONA_FIELD_ORDER,
  CHARACTER_FIELD_ORDER,
  type ParsedPersona,
  type CardField,
} from "../lib/cardTextParser";
import { sortPersonaAuto, sortPersonaWithAi, isWebGpuAvailable, unloadModel, type LoadProgress, type SortTarget } from "../lib/cardTextSorter";
import { useEngineState } from "../hooks/useEngineState";
import { saveSorterSettings, type SorterSettings as Settings } from "../lib/cardTextSorter/settings";
import { useSorterSettings } from "../hooks/useSorterSettings";
import SorterSettings from "./SorterSettings";

interface SmartImportPanelProps {
  /** Which card shape this editor wants back. Defaults to persona. */
  target?: SortTarget;
  /** Current field contents, used to warn before overwriting. */
  current: Partial<Record<CardField, string>>;
  currentTags: string[];
  onApply: (fields: Partial<Record<CardField, string>>, tags: string[]) => void;
  defaultOpen?: boolean;
}

type ApplyMode = "replace" | "append";

const METHOD_BLURB: Record<ParsedPersona["method"], string> = {
  json: "JSON card export",
  wpp: "W++ / attribute list",
  labelled: "Labelled sections",
  prose: "Keyword sort",
  empty: "",
  ai: "AI sort",
};

/**
 * Paste-anything importer. Takes one blob of persona text in whatever shape it
 * arrived and proposes a field-by-field split the user confirms before it lands.
 *
 * Quick sort is instant and offline (keyword matching). AI sort reads the text
 * for meaning, which is what handles prose where one sentence covers three
 * fields — at the cost of a one-time model download.
 */
export default function SmartImportPanel({
  target = "persona",
  current,
  currentTags,
  onApply,
  defaultOpen = false,
}: SmartImportPanelProps) {
  const FIELD_ORDER = target === "character" ? CHARACTER_FIELD_ORDER : PERSONA_FIELD_ORDER;
  const FIELD_LABELS = target === "character" ? CHARACTER_FIELD_LABELS : PERSONA_FIELD_LABELS;

  const pasteId = useId();
  const [open, setOpen] = useState(defaultOpen);
  const [raw, setRaw] = useState("");
  const [result, setResult] = useState<ParsedPersona | null>(null);
  const [selected, setSelected] = useState<Set<CardField>>(new Set());
  const [takeTags, setTakeTags] = useState(true);
  const [mode, setMode] = useState<ApplyMode>("replace");

  const settings = useSorterSettings();
  const [showSettings, setShowSettings] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<LoadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const engine = useEngineState();

  const parsedFields = result
    ? FIELD_ORDER.filter((f) => (result.fields[f] ?? "").trim().length > 0)
    : [];

  /** Fields that would clobber something the user already typed. */
  const collisions = parsedFields.filter((f) => selected.has(f) && (current[f] ?? "").trim().length > 0);

  function acceptResult(parsed: ParsedPersona) {
    // The parser always reports appearance/background when it finds them. A
    // character card has no such fields, so fold them into description rather
    // than silently discarding a section the author wrote.
    const shaped: ParsedPersona =
      target === "character" ? { ...parsed, fields: toCharacterFields(parsed) } : parsed;

    setResult(shaped);
    setSelected(new Set(FIELD_ORDER.filter((f) => (shaped.fields[f] ?? "").trim().length > 0)));
    setTakeTags(shaped.tags.length > 0);
  }

  function handleQuickSort() {
    setError(null);
    acceptResult(parsePersonaText(raw));
  }

  async function runSort(sorter: typeof sortPersonaAuto) {
    setError(null);
    setBusy(true);
    setProgress(null);
    try {
      acceptResult(await sorter(raw, { settings, target, onProgress: (p) => setProgress(p) }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "The sort failed.");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  function updateSettings(patch: Partial<Settings>) {
    saveSorterSettings(patch);
  }

  async function handleUnload() {
    await unloadModel();
  }

  async function handlePasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setRaw(text);
    } catch {
      /* Clipboard blocked — the user can still paste with Ctrl+V. */
    }
  }

  function toggle(field: CardField) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  }

  function handleApply() {
    if (!result) return;

    const out: Partial<Record<CardField, string>> = {};
    for (const field of parsedFields) {
      if (!selected.has(field)) continue;
      const incoming = (result.fields[field] ?? "").trim();
      const existing = (current[field] ?? "").trim();
      out[field] = mode === "append" && existing ? existing + "\n\n" + incoming : incoming;
    }

    const tags = takeTags && result.tags.length
      ? Array.from(new Set([...currentTags, ...result.tags]))
      : currentTags;

    onApply(out, tags);
    reset();
  }

  function reset() {
    setRaw("");
    setResult(null);
    setSelected(new Set());
    setMode("replace");
    setError(null);
  }

  const selectedCount = parsedFields.filter((f) => selected.has(f)).length + (takeTags && result?.tags.length ? 1 : 0);
  const pct = progress ? Math.round(progress.progress * 100) : 0;

  return (
    <div className="border border-accent-purple/30 rounded-lg overflow-hidden" style={{ background: "rgba(124,58,237,0.04)" }}>
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-accent-purple/5 transition-colors"
      >
        {open ? <ChevronDown size={14} className="text-accent-purple shrink-0" /> : <ChevronRight size={14} className="text-accent-purple shrink-0" />}
        <Wand2 size={15} className="text-accent-purple shrink-0" />
        <span className="text-sm font-semibold text-text-primary">Quick Import</span>
        <span className="text-xs text-text-secondary truncate">
          Paste one block of text — it gets sorted into the fields below
        </span>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-3">
          {/* Paste area */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor={pasteId} className="label-base mb-0">Paste anything</label>
              <button
                type="button"
                onClick={handlePasteFromClipboard}
                title="Paste from clipboard"
                className="flex items-center gap-1 text-xs text-text-muted hover:text-text-primary transition-colors"
              >
                <ClipboardPaste size={12} /> Paste
              </button>
            </div>
            <textarea
              id={pasteId}
              className="input-base font-mono text-xs"
              rows={8}
              value={raw}
              onChange={(e) => {
                setRaw(e.target.value);
                if (result) setResult(null);
              }}
              placeholder={
                "Drop the whole persona in here in whatever shape you have it — a JanitorAI paragraph dump, Name:/Appearance:/Personality: sections, W++, or a JSON export.\n\nNothing is applied until you review the split."
              }
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => runSort(sortPersonaAuto)}
              disabled={!raw.trim() || busy}
              className="btn-primary py-2 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Uses your text's own structure when it has any, and the AI model when it doesn't"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
              {busy ? "Sorting…" : "Sort Into Fields"}
            </button>
            <button
              type="button"
              onClick={handleQuickSort}
              disabled={!raw.trim() || busy}
              className="btn-secondary py-2 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Instant keyword sort — never downloads a model, always keeps your wording"
            >
              <Zap size={14} /> Keywords only
            </button>
            <button
              type="button"
              onClick={() => runSort(sortPersonaWithAi)}
              disabled={!raw.trim() || busy}
              className="btn-secondary py-2 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Force the AI model even if your text already has section headings"
            >
              <Sparkles size={14} /> Force AI
            </button>
            {(raw || result) && !busy && (
              <button type="button" onClick={reset} className="btn-secondary py-2">
                <X size={14} /> Clear
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowSettings((s) => !s)}
              aria-expanded={showSettings}
              aria-label="Sorter settings"
              className="ml-auto p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
              title="Sorter settings"
            >
              <Settings2 size={14} />
            </button>
          </div>

          <p className="text-xs text-text-muted leading-relaxed">
            <strong className="text-text-secondary">Sort Into Fields</strong> figures out which approach your text
            needs. If it already has headings like <code className="bg-bg-tertiary px-1 rounded">Appearance</code>, it
            splits on those and keeps your wording exactly. If it's shapeless prose, the AI model reads it for meaning
            and can split a single sentence across three fields — that first run downloads the model.
          </p>

          {/* Model load / generation progress */}
          {busy && (
            <div className="space-y-1.5">
              <div className="h-1.5 rounded-full bg-bg-tertiary overflow-hidden">
                <div
                  className="h-full bg-accent-purple transition-all duration-300"
                  style={{ width: progress ? `${pct}%` : "100%", opacity: progress ? 1 : 0.4 }}
                />
              </div>
              <p className="text-xs text-text-secondary">
                {progress?.text ?? "Reading your persona…"}
              </p>
              {progress && pct < 100 && (
                <p className="text-xs text-text-muted">
                  First run only — the model is cached in your browser afterwards.
                </p>
              )}
            </div>
          )}

          {/* Errors */}
          {error && (
            <div role="alert" className="flex gap-2 p-2 rounded-md bg-status-danger-soft border border-status-danger-border">
              <AlertTriangle size={13} className="text-status-danger shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-xs text-status-danger leading-relaxed">{error}</p>
                <button type="button" onClick={handleQuickSort} className="text-xs text-status-danger underline font-medium">
                  Use Quick Sort instead
                </button>
              </div>
            </div>
          )}

          {showSettings && (
            <SorterSettings
              settings={settings}
              onChange={updateSettings}
              webGpuAvailable={isWebGpuAvailable()}
              loadedModelId={engine.status === "ready" ? engine.modelId : null}
              onUnload={handleUnload}
            />
          )}

          {/* Preview */}
          {result && (
            <div className="border-t border-accent-purple/20 pt-3 space-y-2.5">
              {result.method === "empty" || parsedFields.length === 0 ? (
                <p className="text-xs text-text-secondary">
                  Couldn't pull anything usable out of that. Try AI Sort, or add a few labels like{" "}
                  <code className="bg-bg-tertiary px-1 rounded">Appearance:</code> and sort again.
                </p>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                      Proposed split
                    </p>
                    <span className="text-xs text-accent-purple bg-accent-purple/10 px-1.5 py-0.5 rounded font-medium">
                      {METHOD_BLURB[result.method]}
                    </span>
                  </div>

                  {result.notes.map((note, i) => (
                    <p key={i} className="text-xs text-text-secondary leading-relaxed">{note}</p>
                  ))}

                  {/* Field rows */}
                  <div className="space-y-1.5">
                    {parsedFields.map((field) => {
                      const on = selected.has(field);
                      const existing = (current[field] ?? "").trim();
                      return (
                        <label
                          key={field}
                          className={`flex gap-2.5 p-2 rounded-md border cursor-pointer transition-colors ${
                            on ? "border-accent-purple/40 bg-bg-secondary" : "border-border-light bg-transparent opacity-60"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={() => toggle(field)}
                            className="mt-0.5 accent-accent-purple shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-semibold text-text-primary">
                                {FIELD_LABELS[field]}
                              </span>
                              {on && existing && (
                                <span className="flex items-center gap-1 text-xs text-status-warn">
                                  <AlertTriangle size={10} />
                                  {mode === "replace" ? "replaces existing text" : "appends to existing text"}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-text-secondary mt-0.5 whitespace-pre-wrap break-words max-h-24 overflow-y-auto">
                              {result.fields[field]}
                            </p>
                          </div>
                        </label>
                      );
                    })}

                    {result.tags.length > 0 && (
                      <label className={`flex gap-2.5 p-2 rounded-md border cursor-pointer transition-colors ${
                        takeTags ? "border-accent-purple/40 bg-bg-secondary" : "border-border-light bg-transparent opacity-60"
                      }`}>
                        <input
                          type="checkbox"
                          checked={takeTags}
                          onChange={() => setTakeTags((t) => !t)}
                          className="mt-0.5 accent-accent-purple shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <span className="text-xs font-semibold text-text-primary">Tags</span>
                          <p className="text-xs text-text-secondary mt-0.5 break-words">
                            {result.tags.join(", ")}
                            <span className="text-text-muted"> — added to any tags you already have</span>
                          </p>
                        </div>
                      </label>
                    )}
                  </div>

                  {/* Replace vs append — only meaningful when something would be overwritten */}
                  {collisions.length > 0 && (
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-text-secondary">Existing text:</span>
                      {(["replace", "append"] as ApplyMode[]).map((m) => (
                        <label key={m} className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="smart-import-mode"
                            checked={mode === m}
                            onChange={() => setMode(m)}
                            className="accent-accent-purple"
                          />
                          <span className={mode === m ? "text-text-primary font-medium" : "text-text-secondary"}>
                            {m === "replace" ? "Replace" : "Keep and append"}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleApply}
                    disabled={selectedCount === 0}
                    className="btn-primary w-full justify-center py-2.5 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Check size={14} /> Apply to {selectedCount} field{selectedCount === 1 ? "" : "s"}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
