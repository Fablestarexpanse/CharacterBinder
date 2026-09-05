import { useMemo } from "react";
import { Map } from "lucide-react";
import type { ScenarioCard } from "../../types";
import ResizableTextArea from "../ui/ResizableTextArea";
import { countTokens, getTokenBudgetLevel, tokenBudgetPercent, TOKEN_BUDGET_COLORS, TOKEN_BUDGET_BAR_COLORS } from "../../lib/tokenizer";
import { useTokenizer } from "../../hooks/useTokenizer";
import ImageDropzone from "../ui/ImageDropzone";
import CardExportPanel from "../editor/CardExportPanel";
import TagInput from "../ui/TagInput";
import TextAreaField from "../ui/TextAreaField";
import { blankScenarioCard } from "../../lib/blankCards";
import { useDataCardEditor } from "../../hooks/useDataCardEditor";


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
  const exact = useTokenizer();
  const scenarioTokens = useMemo(() => countTokens(card.scenario), [card.scenario, exact]);
  const firstMesTokens = useMemo(() => countTokens(card.first_mes), [card.first_mes, exact]);
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

        <CardExportPanel
          cardType="scenario"
          label="Scenario Card"
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
              <p><strong className="text-text-secondary">JSON</strong> — drop into SillyTavern or any compatible tool.</p>
              <p><strong className="text-text-secondary">PNG</strong> — embeds the scenario using the <code className="bg-bg-tertiary px-1 rounded">scenario</code> chunk.</p>
            </>
          }
        />
      </aside>
    </div>
  );
}
