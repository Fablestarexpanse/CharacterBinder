import { useState, useRef, useCallback, useMemo } from "react";
import { FileCode2 } from "lucide-react";
import ResizableTextArea from "../ui/ResizableTextArea";
import type { ScriptCard } from "../../types";
import ImageDropzone from "../ui/ImageDropzone";
import CardExportPanel from "../editor/CardExportPanel";
import TagInput from "../ui/TagInput";
import { blankScriptCard } from "../../lib/blankCards";
import { useDataCardEditor } from "../../hooks/useDataCardEditor";


interface ScriptEditorProps {
  initialCard?: ScriptCard;
  initialImageSrc?: string | null;
  initialLibraryId?: string;
}

export default function ScriptEditor({ initialCard, initialImageSrc, initialLibraryId }: ScriptEditorProps) {
  const {
    card, update, imageSrc, setImageSrc, libraryId, saving,
    status, outputFileName, setOutputFileName,
    save: handleSaveToLibrary, exportJson, exportPng, clear: clearForNew,
  } = useDataCardEditor({
    cardType: "script",
    blank: blankScriptCard,
    initialCard,
    initialImageSrc,
    initialLibraryId,
  });

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

        <CardExportPanel
          cardType="script"
          label="Script Card"
          outputFileName={outputFileName}
          onOutputFileNameChange={setOutputFileName}
          version={card.version}
          onVersionChange={(version) => update({ version })}
          saving={saving}
          libraryId={libraryId}
          onSave={handleSaveToLibrary}
          onExportJson={exportJson}
          onExportPng={exportPng}
          onClear={clearForNew}
          status={status}
          footnotes={
            <>
              <p><strong className="text-text-secondary">JSON</strong> — portable card format.</p>
              <p><strong className="text-text-secondary">PNG</strong> — embeds the script using the <code className="bg-bg-tertiary px-1 rounded">script</code> chunk.</p>
            </>
          }
        />
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
    <div className="flex flex-col h-full rounded-lg overflow-hidden bg-code-bg border border-code-border">
      {/* Header bar */}
      <div className="flex items-center gap-2 px-4 py-2 shrink-0 border-b border-code-border-soft text-code-chrome text-[11px] tracking-[0.1em] uppercase font-mono">
        <span>Script Code</span>
        <span className="text-code-accent">◆</span>
        <span>JavaScript</span>
        <span className="ml-auto normal-case tracking-normal opacity-70">
          Tab indents · Esc then Tab to leave
        </span>
      </div>

      {/* Editor body: gutter + textarea side-by-side */}
      <div className="flex flex-1 overflow-hidden">

        {/* Line-number gutter */}
        <div
          ref={gutterRef}
          className="overflow-hidden shrink-0 select-none py-[14px] px-3 min-w-[3.5rem] text-right bg-code-bg text-code-gutter font-mono text-[13px] border-r border-code-border-faint"
          // Must match the textarea's line height exactly or the numbers drift
          // away from the lines they count.
          style={{ lineHeight: "1.65" }}
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
          className="flex-1 bg-transparent text-code-text caret-code-text font-mono text-[13px] py-[14px] px-4 outline-none resize-none border-none overflow-y-auto"
          style={{ lineHeight: "1.65" }}
        />
      </div>
    </div>
  );
}
