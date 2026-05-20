import type { TavernCardV2, MetadataInfo } from "../types";
import type { PlatformId } from "../lib/platforms";
import { templates } from "../data/templates/ronalVoss";
import { FileText, Plus } from "lucide-react";

interface TemplatesProps {
  onLoad: (card: TavernCardV2, imageSrc?: string, meta?: MetadataInfo, sourcePlatform?: PlatformId) => void;
}

export default function Templates({ onLoad }: TemplatesProps) {
  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-xl font-bold text-text-primary mb-1">Templates</h1>
        <p className="text-sm text-text-secondary mb-6">
          Start from a template or load a pre-built character to get started quickly.
        </p>

        <div className="grid grid-cols-2 gap-4">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="card-panel hover:border-accent-purple/50 transition-colors cursor-pointer group"
              onClick={() => onLoad(tpl.card)}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-bg-tertiary border border-border flex items-center justify-center shrink-0">
                  <FileText size={18} className="text-text-muted group-hover:text-accent-purple-light transition-colors" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-text-primary">{tpl.name}</p>
                  <p className="text-xs text-text-muted mt-0.5">{tpl.description}</p>
                </div>
              </div>
              {tpl.card.data.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {tpl.card.data.tags.slice(0, 4).map((tag) => (
                    <span key={tag} className="badge-purple">{tag}</span>
                  ))}
                </div>
              )}
              <button className="btn-primary w-full justify-center mt-3 text-xs py-2 group-hover:bg-accent-purple-hover">
                <Plus size={13} /> Use Template
              </button>
            </div>
          ))}

          {/* Custom template card */}
          <div className="card-panel border-dashed flex flex-col items-center justify-center py-8 gap-3 text-text-muted cursor-pointer hover:border-accent-purple/50 hover:text-accent-purple-light transition-colors">
            <div className="w-10 h-10 rounded-lg bg-bg-tertiary border border-border border-dashed flex items-center justify-center">
              <Plus size={18} />
            </div>
            <p className="text-sm font-medium">Create Blank</p>
            <p className="text-xs text-center px-4">Start from an empty character card</p>
          </div>
        </div>

        {/* Info section */}
        <div className="mt-8 card-panel">
          <p className="section-title">About Templates</p>
          <div className="space-y-2 text-xs text-text-secondary">
            <p>Templates are pre-filled character cards that you can use as starting points.</p>
            <p>
              <strong className="text-text-primary">Ronan Voss</strong> — A sample character demonstrating all fields including
              alternate greetings, system prompts, and example dialogs.
            </p>
            <p>All templates use Tavern Card v2 format and are fully compatible with SillyTavern.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
