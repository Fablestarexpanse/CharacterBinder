import { useMemo, useState } from "react";
import type { TavernCardV2, AppSettings, CardProject } from "../../types";
import type { PlatformId } from "../../shared/platforms/registry";
import { validateTavernCardV2 } from "../../shared/validators";
import { useCharacterCardActions } from "../../hooks/useCharacterCardActions";
import CharacterEditor from "./CharacterEditor";
import JSONView from "../ui/JSONView";
import RawPreview from "../ui/RawPreview";
import CardPreviewPanel from "../editor/CardPreviewPanel";

interface CreateCardProps {
  project: CardProject;
  settings: AppSettings;
  targetPlatform: PlatformId;
  onUpdateCard: (updates: Partial<TavernCardV2["data"]>) => void;
  onUpdateImage: (src: string) => void;
  onUpdateOutputFileName: (name: string) => void;
  onPlatformChange: (id: PlatformId) => void;
  onSavedToLibrary?: (id: string) => void;
  onNewCard?: () => void;
}

type Tab = "editor" | "json" | "raw";

export default function CreateCard({
  project,
  settings,
  targetPlatform,
  onUpdateCard,
  onUpdateImage,
  onUpdateOutputFileName,
  onPlatformChange,
  onSavedToLibrary,
  onNewCard,
}: CreateCardProps) {
  const [activeTab, setActiveTab] = useState<Tab>("editor");
  // Validation feeds both the panel's error list and the export gate, so the
  // page computes it once and hands it to both.
  const validation = useMemo(() => validateTavernCardV2(project.card), [project.card]);
  const actions = useCharacterCardActions({
    project, settings, targetPlatform, valid: validation.valid, onSavedToLibrary,
  });

  const tabs: { id: Tab; label: string }[] = [
    { id: "editor", label: "Character Editor" },
    { id: "json", label: "JSON View" },
    { id: "raw", label: "Raw Preview" },
  ];

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main editor */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-border bg-bg-secondary shrink-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`tab-button ${activeTab === tab.id ? "tab-active" : "tab-inactive"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-hidden">
          {activeTab === "editor" && (
            <CharacterEditor
              card={project.card}
              imageSrc={project.imageSrc}
              onUpdate={onUpdateCard}
              onUpdateImage={onUpdateImage}
            />
          )}
          {activeTab === "json" && (
            <JSONView card={project.card} onUpdate={onUpdateCard} />
          )}
          {activeTab === "raw" && (
            <RawPreview card={project.card} />
          )}
        </div>

        <HowItWorks />
      </div>

      {/* Right panel */}
      <CardPreviewPanel
        project={project}
        validation={validation}
        targetPlatform={targetPlatform}
        onPlatformChange={onPlatformChange}
        onUpdateOutputFileName={onUpdateOutputFileName}
        actions={actions}
        onNewCard={onNewCard}
      />
    </div>
  );
}

function HowItWorks() {
  const steps = [
    { n: "1.", title: "Create / Edit", desc: "Enter your character details in the editor" },
    { n: "2.", title: "Encode", desc: "Your data is encoded to Base64" },
    { n: "3.", title: "Embed", desc: "Encoded data is added to PNG metadata" },
    { n: "4.", title: "Export", desc: "Share your Tavern Card PNG!" },
  ];

  return (
    <div className="border-t border-border bg-bg-secondary px-6 py-3 shrink-0">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">How It Works</span>
      </div>
      <div className="flex items-start gap-3">
        {steps.map((step, i) => (
          <div key={i} className="flex items-start gap-2 flex-1 min-w-0">
            <div className="w-6 h-6 rounded bg-bg-tertiary border border-border flex items-center justify-center text-xs text-text-muted shrink-0 mt-0.5">
              ✎
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-text-primary leading-tight">{step.n} {step.title}</p>
              <p className="text-xs text-text-muted leading-tight mt-0.5 line-clamp-2">{step.desc}</p>
            </div>
            {i < steps.length - 1 && (
              <span className="text-text-muted text-sm mt-1 shrink-0">→</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
