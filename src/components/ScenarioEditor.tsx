import { useMemo } from "react";
import { Download, FileJson, Map, Save } from "lucide-react";
import type { ScenarioCard } from "../types";
import ResizableTextArea from "./ResizableTextArea";
import { countTokens, getTokenBudgetLevel, tokenBudgetPercent, TOKEN_BUDGET_COLORS, TOKEN_BUDGET_BAR_COLORS } from "../lib/tokenizer";
import ImageDropzone from "./ImageDropzone";
import ConfirmClearPanel from "./ConfirmClearPanel";
import TagInput from "./TagInput";
import TextAreaField from "./TextAreaField";
import { blankScenarioCard } from "../lib/blankCards";
import { useDataCardEditor } from "../hooks/useDataCardEditor";


interface ScenarioEditorProps {
  initialCard?: ScenarioCard;
  initialImageSrc?: string | null;
  initialLibraryId?: string;
}

export default function ScenarioEditor({ initialCard, initialImageSrc, initialLibraryId }: ScenarioEditorProps) {
  const {
    card, update, imageSrc, setImageSrc, libraryId, saving,
    status, outputFileName, setOutputFileName,
    save: handleSaveToLibrary, exportJson, exportPng, clear: clearForNew,
  } = useDataCardEditor({
    cardType: "scenario",
    blank: blankScenarioCard,
    initialCard,
    initialImageSrc,
    initialLibraryId,
  });

  // Tokenizing is a full BPE encode. Unmemoized these ran on every render, so
  // every keystroke in the Name field re-tokenized the whole scenario.
  const scenarioTokens = useMemo(() => countTokens(card.scenario), [card.scenario]);
  const firstMesTokens = useMemo(() => countTokens(card.first_mes), [card.first_mes]);
  const totalTokens = scenarioTokens + firstMesTokens;
  const level = getTokenBudgetLevel(totalTokens);

  return (
    <div className="h-full flex overflow-hidden">
      {/* Editor */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        <div>
          <h1 className="text-lg font-bold text-text-primary flex items-center gap-2">
            <Map size={20} className="text-accent-purple" /> Scenario Card
          </h1>
          <p className="text-sm text-text-secondary mt-0.5">A standalone situation or setting card that can be dropped into any conversation.</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label-base">Scenario Name</label>
            <input className="input-base" placeholder="The Abandoned Lab..." value={card.name} onChange={(e) => update({ name: e.target.value })} />
          </div>
          <div>
            <label className="label-base">Creator</label>
            <input className="input-base" placeholder="Your name..." value={card.creator} onChange={(e) => update({ creator: e.target.value })} />
          </div>
        </div>

        <div>
          <label className="label-base">Description</label>
          <ResizableTextArea rows={2} placeholder="Brief overview of this scenario..." value={card.description} onChange={(e) => update({ description: e.target.value })} />
        </div>

        <TextAreaField label="Scenario" value={card.scenario} placeholder={"You find yourself in a dimly lit laboratory. The air smells of ozone and old chemicals..."} onChange={(v) => update({ scenario: v })} rows={6} />
        <TextAreaField label="Opening Message (optional)" value={card.first_mes} placeholder={"The door creaks open as you step inside. Something shifts in the shadows ahead..."} onChange={(v) => update({ first_mes: v })} rows={5} />
        <TextAreaField label="Creator Notes" value={card.creator_notes} placeholder={"Notes for users — recommended characters, content warnings, usage tips..."} onChange={(v) => update({ creator_notes: v })} rows={3} />

        <TagInput
          label="Tags (comma-separated)"
          placeholder="horror, sci-fi, mystery..."
          tags={card.tags}
          onChange={(tags) => update({ tags })}
        />
      </div>

      {/* Export panel */}
      <aside className="w-64 border-l border-border bg-bg-secondary flex flex-col shrink-0 p-4 gap-3">
        <p className="section-title">Export</p>

        <ImageDropzone label="Scene Image" imageSrc={imageSrc} onFile={setImageSrc} />

        <div className="space-y-1 text-xs">
          <div className="flex justify-between"><span className="text-text-muted">Scenario</span><span className="font-medium text-text-primary">{scenarioTokens} tk</span></div>
          <div className="flex justify-between"><span className="text-text-muted">Opening</span><span className="font-medium text-text-primary">{firstMesTokens} tk</span></div>
          <div className="flex justify-between border-t border-border pt-1 mt-1">
            <span className="text-text-muted">Total</span>
            <span className={`font-bold ${TOKEN_BUDGET_COLORS[level]}`}>{totalTokens} tk</span>
          </div>
          <div className="w-full h-1 bg-bg-tertiary rounded-full overflow-hidden mt-1">
            <div className={`h-full rounded-full ${TOKEN_BUDGET_BAR_COLORS[level]}`} style={{ width: `${tokenBudgetPercent(totalTokens)}%` }} />
          </div>
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
            <code className="text-accent-purple-light bg-bg-tertiary px-1.5 py-0.5 rounded font-mono">scenario</code>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-muted">Version</span>
            <input
              className="input-base py-0.5 text-xs w-20 text-right"
              value={card.version}
              onChange={(e) => update({ version: e.target.value })}
            />
          </div>
        </div>

        {/* Save to Library */}
        <div className="border-t border-border pt-3 space-y-2">
          <button onClick={handleSaveToLibrary} disabled={saving} className="btn-primary w-full justify-center py-2.5">
            <Save size={14} /> {saving ? "Saving…" : libraryId ? "Update in Library" : "Save to Library"}
          </button>
          <ConfirmClearPanel label="Scenario Card" onConfirm={clearForNew} />
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
          <p><strong className="text-text-secondary">JSON</strong> — drop into SillyTavern or any compatible tool.</p>
          <p><strong className="text-text-secondary">PNG</strong> — embeds the scenario using the <code className="bg-bg-tertiary px-1 rounded">scenario</code> chunk.</p>
        </div>
      </aside>
    </div>
  );
}
