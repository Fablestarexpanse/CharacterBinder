import { UserCircle } from "lucide-react";
import type { PersonaCard } from "../../types";
import DataCardExportAside from "../editor/DataCardExportAside";
import TagInput from "../ui/TagInput";
import TextAreaField from "../ui/TextAreaField";
import QuickImportPanel from "../editor/QuickImportPanel";
import type { CardField } from "../../shared/cardTextParser";
import { blankPersonaCard } from "../../shared/blankCards";
import { useDataCardEditor } from "../../hooks/useDataCardEditor";


interface PersonaEditorProps {
  initialCard?: PersonaCard;
  initialImageSrc?: string | null;
  initialLibraryId?: string;
}

export default function PersonaEditor({ initialCard, initialImageSrc, initialLibraryId }: PersonaEditorProps) {
  const editor = useDataCardEditor({
    cardType: "persona",
    blank: blankPersonaCard,
    initialCard,
    initialImageSrc,
    initialLibraryId,
  });
  const { card, update, setMsg } = editor;

  function applySmartImport(fields: Partial<Record<CardField, string>>, tags: string[]) {
    update({ ...fields, tags });
    const count = Object.keys(fields).length;
    setMsg(`Sorted into ${count} field${count === 1 ? "" : "s"}.`, true);
  }

  // A fresh, untouched card opens with the importer expanded; an existing one doesn't.
  const isBlank = !card.name && !card.description && !card.personality && !card.appearance && !card.background;

  return (
    <div className="h-full flex overflow-hidden">
      {/* ── Main editor ── */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        <div>
          <h1 className="text-lg font-bold text-text-primary flex items-center gap-2">
            <UserCircle size={20} className="text-accent-purple" /> Persona Card
          </h1>
          <p className="text-sm text-text-secondary mt-0.5">
            Define a user persona — who <em>you</em> are in the conversation. Used as the <code className="text-accent-purple-light bg-bg-tertiary px-1 rounded text-xs">{"{{user}}"}</code> identity.
          </p>
        </div>

        <QuickImportPanel
          current={{
            name: card.name,
            description: card.description,
            personality: card.personality,
            appearance: card.appearance,
            background: card.background,
            creator: card.creator,
            creator_notes: card.creator_notes,
          }}
          currentTags={card.tags}
          onApply={applySmartImport}
          defaultOpen={isBlank}
        />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label-base">Persona Name</label>
            <input className="input-base" placeholder="Your character name..." value={card.name} onChange={(e) => update({ name: e.target.value })} />
          </div>
          <div>
            <label className="label-base">Creator</label>
            <input className="input-base" placeholder="Your name..." value={card.creator} onChange={(e) => update({ creator: e.target.value })} />
          </div>
        </div>

        <TextAreaField label="Description" value={card.description} rows={3} onChange={(v) => update({ description: v })} placeholder="A brief overview of who this persona is..." />
        <TextAreaField label="Personality" value={card.personality} rows={3} onChange={(v) => update({ personality: v })} placeholder="Personality traits, mannerisms, how this person acts..." />
        <TextAreaField label="Appearance" value={card.appearance} rows={3} onChange={(v) => update({ appearance: v })} placeholder="Physical description — height, build, hair, distinctive features..." />
        <TextAreaField label="Background" value={card.background} rows={4} onChange={(v) => update({ background: v })} placeholder="Backstory, occupation, history, relationships..." />
        <TextAreaField label="Creator Notes" value={card.creator_notes} rows={3} onChange={(v) => update({ creator_notes: v })} placeholder="Notes for users of this persona — usage tips, compatibility, changelog..." />

        <TagInput
          label="Tags (comma-separated)"
          placeholder="human, mage, noble..."
          tags={card.tags}
          onChange={(tags) => update({ tags })}
        />
      </div>

      <DataCardExportAside
        editor={editor}
        cardType="persona"
        label="Persona"
        imageLabel="Avatar Image"
        footnotes={
          <>
            <p><strong className="text-text-secondary">JSON</strong> — portable persona format.</p>
            <p><strong className="text-text-secondary">PNG</strong> — embeds persona using the <code className="bg-bg-tertiary px-1 rounded">persona</code> chunk.</p>
          </>
        }
      />
    </div>
  );
}
