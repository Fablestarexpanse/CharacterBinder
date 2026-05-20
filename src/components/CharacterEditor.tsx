import { useState, useRef, useCallback } from "react";
import type { TavernCardV2 } from "../types";
import { Plus, Minus, ChevronDown, ChevronUp, Image } from "lucide-react";

interface CharacterEditorProps {
  card: TavernCardV2;
  imageSrc?: string;
  onUpdate: (updates: Partial<TavernCardV2["data"]>) => void;
  onUpdateImage: (src: string) => void;
}

const SOURCES = [
  "Original Character",
  "Anime / Manga",
  "Game",
  "Movie / TV",
  "Novel / Book",
  "Other",
];

export default function CharacterEditor({
  card,
  imageSrc,
  onUpdate,
  onUpdateImage,
}: CharacterEditorProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const { data } = card;

  const handleImageFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) onUpdateImage(e.target.result as string);
    };
    reader.readAsDataURL(file);
  }, [onUpdateImage]);

  const handleImageDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith("image/")) handleImageFile(file);
  }, [handleImageFile]);

  const addAlternateGreeting = () => {
    onUpdate({ alternate_greetings: [...data.alternate_greetings, ""] });
  };
  const removeAlternateGreeting = (i: number) => {
    onUpdate({ alternate_greetings: data.alternate_greetings.filter((_, idx) => idx !== i) });
  };
  const updateAlternateGreeting = (i: number, val: string) => {
    const updated = [...data.alternate_greetings];
    updated[i] = val;
    onUpdate({ alternate_greetings: updated });
  };

  return (
    <div className="h-full overflow-y-auto px-6 py-4">
      {/* Basic Information */}
      <section className="mb-5">
        <h2 className="text-base font-semibold text-text-primary mb-4 pb-2 border-b border-border">
          Basic Information
        </h2>
        <div className="flex gap-4">
          {/* Left fields */}
          <div className="flex-1 space-y-4">
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="label-base">Name</label>
                <input
                  className="input-base"
                  placeholder="Character name..."
                  value={data.name}
                  onChange={(e) => onUpdate({ name: e.target.value })}
                />
              </div>
              <div className="flex-1">
                <label className="label-base">Source</label>
                <select
                  className="input-base"
                  value={data.extensions?.source as string ?? SOURCES[0]}
                  onChange={(e) =>
                    onUpdate({ extensions: { ...data.extensions, source: e.target.value } })
                  }
                >
                  {SOURCES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            <TextAreaField
              label="Description"
              value={data.description}
              maxLength={1000}
              rows={3}
              onChange={(v) => onUpdate({ description: v })}
              placeholder="Describe your character..."
            />

            <TextAreaField
              label="Personality"
              value={data.personality}
              maxLength={2000}
              rows={3}
              onChange={(v) => onUpdate({ personality: v })}
              placeholder="Character personality traits..."
            />

            <TextAreaField
              label="Scenario / First Message"
              value={data.first_mes}
              maxLength={2000}
              rows={3}
              onChange={(v) => onUpdate({ first_mes: v })}
              placeholder="Opening scenario or first message..."
            />
          </div>

          {/* Image upload */}
          <div className="shrink-0">
            <label className="label-base">Character Image</label>
            <div
              className="w-48 h-56 rounded-xl border-2 border-dashed border-border hover:border-accent-purple/50 transition-colors cursor-pointer overflow-hidden relative group bg-bg-tertiary"
              onClick={() => imageInputRef.current?.click()}
              onDrop={handleImageDrop}
              onDragOver={(e) => e.preventDefault()}
            >
              {imageSrc ? (
                <img
                  src={imageSrc}
                  alt="Character"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-text-muted">
                  <Image size={32} />
                  <span className="text-xs text-center px-2">Drop image here or click to browse</span>
                </div>
              )}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-3">
                <span className="text-xs text-white bg-black/60 px-2 py-1 rounded">Change Image</span>
              </div>
            </div>
            <button
              onClick={() => imageInputRef.current?.click()}
              className="mt-2 w-full btn-secondary justify-center text-xs py-1.5"
            >
              <Image size={13} />
              Change Image
            </button>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImageFile(file);
              }}
            />
          </div>
        </div>
      </section>

      {/* Example Dialogs */}
      <section className="mb-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-text-primary">Example Dialogs</h2>
          <button
            onClick={() => onUpdate({ mes_example: data.mes_example + "\n{{user}}: \n{{char}}: " })}
            className="btn-ghost py-1 text-xs"
          >
            <Plus size={13} /> Add
          </button>
        </div>
        <div className="space-y-2">
          {data.mes_example.split("\n").filter(Boolean).map((line, i) => (
            <div
              key={i}
              className="flex items-start gap-2 bg-bg-tertiary rounded-lg px-3 py-2 text-sm font-mono"
            >
              <span
                className={`text-xs px-1.5 py-0.5 rounded text-xs font-medium shrink-0 mt-0.5 ${
                  line.startsWith("{{user}}")
                    ? "bg-blue-900/40 text-blue-300"
                    : line.startsWith("{{char}}")
                    ? "bg-purple-900/40 text-purple-300"
                    : "bg-bg-hover text-text-muted"
                }`}
              >
                {line.startsWith("{{user}}") ? "U" : line.startsWith("{{char}}") ? "C" : "—"}
              </span>
              <span className="text-text-primary flex-1 break-words">{line}</span>
              <button
                onClick={() => {
                  const lines = data.mes_example.split("\n").filter(Boolean);
                  lines.splice(i, 1);
                  onUpdate({ mes_example: lines.join("\n") });
                }}
                className="text-text-muted hover:text-red-400 shrink-0"
              >
                <Minus size={13} />
              </button>
            </div>
          ))}
          {!data.mes_example && (
            <p className="text-sm text-text-muted italic">No example dialogs yet. Click Add to create some.</p>
          )}
        </div>
        <div className="mt-2">
          <TextAreaField
            label="Raw Dialog Block"
            value={data.mes_example}
            maxLength={10000}
            rows={4}
            onChange={(v) => onUpdate({ mes_example: v })}
            placeholder={`{{user}}: Hello!\n{{char}}: Hi there.`}
          />
        </div>
      </section>

      {/* Advanced Fields */}
      <section className="mb-5">
        <button
          className="w-full flex items-center justify-between text-base font-semibold text-text-primary py-2 border-b border-border mb-3"
          onClick={() => setAdvancedOpen(!advancedOpen)}
        >
          Advanced Fields (Optional)
          {advancedOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {advancedOpen && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-base">Creator / Author</label>
                <input
                  className="input-base"
                  placeholder="Your name..."
                  value={data.creator}
                  onChange={(e) => onUpdate({ creator: e.target.value })}
                />
              </div>
              <div>
                <label className="label-base">Character Version</label>
                <input
                  className="input-base"
                  placeholder="1.0"
                  value={data.character_version}
                  onChange={(e) => onUpdate({ character_version: e.target.value })}
                />
              </div>
            </div>

            <TextAreaField
              label="System Prompt"
              value={data.system_prompt}
              maxLength={5000}
              rows={3}
              onChange={(v) => onUpdate({ system_prompt: v })}
              placeholder="Optional system prompt injected at the start of every conversation..."
            />

            <TextAreaField
              label="Post-History Instructions"
              value={data.post_history_instructions}
              maxLength={2000}
              rows={2}
              onChange={(v) => onUpdate({ post_history_instructions: v })}
              placeholder="Instructions injected after chat history..."
            />

            <TextAreaField
              label="Creator Notes"
              value={data.creator_notes}
              maxLength={2000}
              rows={2}
              onChange={(v) => onUpdate({ creator_notes: v })}
              placeholder="Notes for users of this character card..."
            />

            <div>
              <label className="label-base">Tags (comma-separated)</label>
              <input
                className="input-base"
                placeholder="fantasy, male, OC, ..."
                value={data.tags.join(", ")}
                onChange={(e) =>
                  onUpdate({
                    tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean),
                  })
                }
              />
              {data.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {data.tags.map((tag) => (
                    <span key={tag} className="badge-purple">{tag}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Alternate Greetings */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label-base mb-0">Alternate Greetings</label>
                <button onClick={addAlternateGreeting} className="btn-ghost py-1 text-xs">
                  <Plus size={13} /> Add
                </button>
              </div>
              {data.alternate_greetings.map((greeting, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <textarea
                    className="input-base resize-none flex-1"
                    rows={2}
                    value={greeting}
                    onChange={(e) => updateAlternateGreeting(i, e.target.value)}
                    placeholder={`Alternate greeting ${i + 1}...`}
                  />
                  <button
                    onClick={() => removeAlternateGreeting(i)}
                    className="text-text-muted hover:text-red-400 shrink-0 self-start mt-2"
                  >
                    <Minus size={15} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

interface TextAreaFieldProps {
  label: string;
  value: string;
  maxLength: number;
  rows: number;
  onChange: (v: string) => void;
  placeholder?: string;
}

function TextAreaField({ label, value, maxLength, rows, onChange, placeholder }: TextAreaFieldProps) {
  return (
    <div>
      <label className="label-base">{label}</label>
      <div className="relative">
        <textarea
          className="input-base resize-none"
          rows={rows}
          maxLength={maxLength}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
        <span className="absolute bottom-2 right-2 text-xs text-text-muted">
          {value.length} / {maxLength}
        </span>
      </div>
    </div>
  );
}
