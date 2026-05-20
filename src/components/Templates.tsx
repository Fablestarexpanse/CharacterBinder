import { useState, useEffect } from "react";
import type { TavernCardV2, MetadataInfo } from "../types";
import type { PlatformId } from "../lib/platforms";
import { templates } from "../data/templates/ronalVoss";
import { getCustomTemplates, deleteCustomTemplate, type CustomTemplate } from "../lib/customTemplates";
import { FileText, Plus, Trash2 } from "lucide-react";

interface TemplatesProps {
  onLoad: (card: TavernCardV2, imageSrc?: string, meta?: MetadataInfo, sourcePlatform?: PlatformId) => void;
}

export default function Templates({ onLoad }: TemplatesProps) {
  const [custom, setCustom] = useState<CustomTemplate[]>([]);

  useEffect(() => {
    setCustom(getCustomTemplates());
  }, []);

  function handleDelete(id: string) {
    deleteCustomTemplate(id);
    setCustom(getCustomTemplates());
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-xl font-bold text-text-primary mb-1">Templates</h1>
        <p className="text-sm text-text-secondary mb-6">
          Start from a template or load a pre-built character to get started quickly.
        </p>

        {/* Built-in templates */}
        <div className="grid grid-cols-2 gap-4">
          {templates.map((tpl) => (
            <TemplateCard
              key={tpl.id}
              name={tpl.name}
              description={tpl.description}
              tags={(tpl.card.data.tags ?? []).slice(0, 4)}
              onUse={() => onLoad(tpl.card)}
            />
          ))}
        </div>

        {/* Custom templates */}
        {custom.length > 0 && (
          <>
            <div className="flex items-center gap-3 mt-8 mb-4">
              <h2 className="text-sm font-semibold text-text-primary">Your Templates</h2>
              <span className="text-xs text-text-muted">{custom.length} saved</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {custom.map((tpl) => (
                <TemplateCard
                  key={tpl.id}
                  name={tpl.name}
                  description={tpl.description}
                  tags={(tpl.card.data.tags ?? []).slice(0, 4)}
                  onUse={() => onLoad(tpl.card)}
                  onDelete={() => handleDelete(tpl.id)}
                />
              ))}
            </div>
          </>
        )}

        {/* Info */}
        <div className="mt-8 card-panel">
          <p className="section-title">About Templates</p>
          <div className="space-y-2 text-xs text-text-secondary">
            <p>Templates are pre-filled character cards you can use as starting points.</p>
            <p>Save any card as a template using the <strong className="text-text-primary">Save as Template</strong> button in the editor's export panel.</p>
            <p>All templates use Tavern Card v2 format and are fully compatible with SillyTavern.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function TemplateCard({
  name, description, tags, onUse, onDelete,
}: {
  name: string;
  description: string;
  tags: string[];
  onUse: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="card-panel hover:border-accent-purple/50 transition-colors group relative">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-bg-tertiary border border-border flex items-center justify-center shrink-0">
          <FileText size={18} className="text-text-muted group-hover:text-accent-purple-light transition-colors" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-text-primary">{name}</p>
          <p className="text-xs text-text-muted mt-0.5 line-clamp-2">{description}</p>
        </div>
        {onDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="shrink-0 p-1 rounded text-text-muted hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
            title="Delete template"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {tags.map((tag) => (
            <span key={tag} className="badge-purple">{tag}</span>
          ))}
        </div>
      )}
      <button
        onClick={onUse}
        className="btn-primary w-full justify-center mt-3 text-xs py-2 group-hover:bg-accent-purple-hover"
      >
        <Plus size={13} /> Use Template
      </button>
    </div>
  );
}
