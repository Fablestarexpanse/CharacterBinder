import { useState } from "react";
import type { TavernCardV2, AppSettings, CardProject } from "../types";
import type { PlatformId } from "../lib/platforms";
import CharacterEditor from "./CharacterEditor";
import JSONView from "./JSONView";
import RawPreview from "./RawPreview";
import CardPreviewPanel from "./CardPreviewPanel";

interface CreateCardProps {
  project: CardProject;
  settings: AppSettings;
  targetPlatform: PlatformId;
  onUpdateCard: (updates: Partial<TavernCardV2["data"]>) => void;
  onUpdateImage: (src: string) => void;
  onUpdateOutputFileName: (name: string) => void;
  onPlatformChange: (id: PlatformId) => void;
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
  onNewCard,
}: CreateCardProps) {
  const [activeTab, setActiveTab] = useState<Tab>("editor");

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
        settings={settings}
        targetPlatform={targetPlatform}
        onPlatformChange={onPlatformChange}
        onUpdateOutputFileName={onUpdateOutputFileName}
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
