import { useState, useRef, useEffect } from "react";
import { Download, FileJson, Copy, Check, ClipboardPaste, UserCircle, Save, Plus } from "lucide-react";
import type { PersonaCard } from "../types";
import { encodeCharaToPng } from "../lib/pngMetadata";
import { saveAnyCard } from "../lib/library";

const DEFAULT: PersonaCard = {
  spec: "persona_card_v1",
  name: "",
  description: "",
  personality: "",
  appearance: "",
  background: "",
  tags: [],
  creator: "",
  version: "1.0",
  creator_notes: "",
};

const MINIMAL_PNG = new Uint8Array([
  137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,
  0,0,0,1,0,0,0,1,8,2,0,0,0,144,119,83,222,
  0,0,0,12,73,68,65,84,8,215,99,248,207,0,0,0,2,0,1,
  226,33,188,51,0,0,0,0,73,69,78,68,174,66,96,130,
]);

interface PersonaEditorProps {
  initialCard?: PersonaCard;
  initialImageSrc?: string | null;
  initialLibraryId?: string;
}

export default function PersonaEditor({ initialCard, initialImageSrc, initialLibraryId }: PersonaEditorProps) {
  const [card, setCard] = useState<PersonaCard>(initialCard ?? DEFAULT);
  const [imageSrc, setImageSrc] = useState<string | null>(initialImageSrc ?? null);
  const [status, setStatus] = useState<{ msg: string; ok: boolean } | null>(null);
  const [libraryId, setLibraryId] = useState<string | undefined>(initialLibraryId);
  const [saving, setSaving] = useState(false);
  const [savedVersion, setSavedVersion] = useState<string>(initialCard?.version ?? "1.0");
  const [confirmClear, setConfirmClear] = useState(false);
  const [outputFileName, setOutputFileName] = useState(
    ((initialCard?.name || "persona").replace(/\s+/g, "_")) + "_persona.png"
  );
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Auto-sync filename to persona name
  useEffect(() => {
    const name = card.name.trim();
    setOutputFileName(name ? name.replace(/\s+/g, "_") + "_persona.png" : "persona.png");
  }, [card.name]);

  function update(patch: Partial<PersonaCard>) {
    setCard((c) => ({ ...c, ...patch }));
  }

  function setMsg(msg: string, ok: boolean) {
    setStatus({ msg, ok });
    setTimeout(() => setStatus(null), 3000);
  }

  function clearForNew() {
    setCard(DEFAULT);
    setImageSrc(null);
    setLibraryId(undefined);
    setSavedVersion("1.0");
    setOutputFileName("persona.png");
    setConfirmClear(false);
    setStatus(null);
  }

  function handleImageFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => { if (e.target?.result) setImageSrc(e.target.result as string); };
    reader.readAsDataURL(file);
  }

  function exportJson() {
    const json = JSON.stringify(card, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = outputFileName.replace(/\.png$/, ".json");
    a.click();
    URL.revokeObjectURL(url);
    setMsg("JSON exported!", true);
  }

  async function exportPng() {
    try {
      let pngBytes: Uint8Array;
      if (imageSrc?.startsWith("data:image/")) {
        const b64 = imageSrc.split(",")[1];
        pngBytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      } else {
        pngBytes = MINIMAL_PNG;
      }
      const json = JSON.stringify(card);
      const result = encodeCharaToPng(pngBytes, json, "persona", false);
      const blob = new Blob([result.buffer as ArrayBuffer], { type: "image/png" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = outputFileName;
      a.click();
      URL.revokeObjectURL(url);
      setMsg("PNG exported!", true);
    } catch {
      setMsg("PNG export failed.", false);
    }
  }

  async function handleSaveToLibrary() {
    setSaving(true);
    try {
      const versionChanged = !!libraryId && card.version.trim() !== savedVersion;
      const saved = await saveAnyCard("persona", card.name || "Unnamed Persona", card, imageSrc, card.tags, versionChanged ? undefined : libraryId);
      setLibraryId(saved.id);
      setSavedVersion(card.version);
      setMsg(versionChanged ? "Saved as new version!" : libraryId ? "Library updated!" : "Saved to library!", true);
    } catch {
      setMsg("Failed to save to library.", false);
    }
    setSaving(false);
  }

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

        <TextAreaField
          label="Description"
          value={card.description}
          rows={3}
          onChange={(v) => update({ description: v })}
          placeholder="A brief overview of who this persona is..."
        />

        <TextAreaField
          label="Personality"
          value={card.personality}
          rows={3}
          onChange={(v) => update({ personality: v })}
          placeholder="Personality traits, mannerisms, how this person acts..."
        />

        <TextAreaField
          label="Appearance"
          value={card.appearance}
          rows={3}
          onChange={(v) => update({ appearance: v })}
          placeholder="Physical description — height, build, hair, distinctive features..."
        />

        <TextAreaField
          label="Background"
          value={card.background}
          rows={4}
          onChange={(v) => update({ background: v })}
          placeholder="Backstory, occupation, history, relationships..."
        />

        <TextAreaField
          label="Creator Notes"
          value={card.creator_notes}
          rows={3}
          onChange={(v) => update({ creator_notes: v })}
          placeholder="Notes for users of this persona — usage tips, compatibility, changelog..."
        />

        <div>
          <label className="label-base">Tags</label>
          <input
            className="input-base"
            placeholder="human, mage, noble..."
            value={card.tags.join(", ")}
            onChange={(e) => update({ tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })}
          />
          {card.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {card.tags.map((t) => <span key={t} className="badge-purple">{t}</span>)}
            </div>
          )}
        </div>
      </div>

      {/* ── Export panel ── */}
      <aside className="w-64 border-l border-border bg-bg-secondary flex flex-col shrink-0 p-4 gap-3">
        <p className="section-title">Export</p>

        {/* Avatar image */}
        <div>
          <label className="label-base">Avatar Image</label>
          <div
            className="w-full h-28 rounded-xl border-2 border-dashed border-border hover:border-accent-purple/50 transition-colors cursor-pointer overflow-hidden relative group bg-bg-tertiary flex items-center justify-center"
            onClick={() => imageInputRef.current?.click()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.type.startsWith("image/")) handleImageFile(f); }}
            onDragOver={(e) => e.preventDefault()}
          >
            {imageSrc
              ? <img src={imageSrc} alt="avatar" className="w-full h-full object-cover" />
              : <span className="text-xs text-text-muted text-center px-2">Drop image or click<br /><span className="text-[10px]">(optional)</span></span>
            }
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <span className="text-xs text-white">Change</span>
            </div>
          </div>
          <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageFile(f); }} />
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
            <code className="text-accent-purple-light bg-bg-tertiary px-1.5 py-0.5 rounded font-mono">persona</code>
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

        {/* Save / New */}
        <div className="border-t border-border pt-3 space-y-2">
          <button onClick={handleSaveToLibrary} disabled={saving} className="btn-primary w-full justify-center py-2.5">
            <Save size={14} /> {saving ? "Saving…" : libraryId ? "Update in Library" : "Save to Library"}
          </button>
          {!confirmClear ? (
            <button
              onClick={() => setConfirmClear(true)}
              className="w-full flex items-center justify-center gap-2 text-xs py-2 rounded-lg border border-dashed border-border text-text-secondary hover:border-red-400/60 hover:text-red-500 hover:bg-red-950/20 transition-colors"
            >
              <Plus size={12} /> New Persona
            </button>
          ) : (
            <div className="rounded-lg border border-red-500/30 bg-red-950/30 px-3 py-2.5 space-y-2">
              <p className="text-xs font-medium text-red-400">Clear this persona and start fresh?</p>
              <p className="text-[11px] text-red-400/70">Library saves are not affected.</p>
              <div className="flex gap-2">
                <button onClick={clearForNew} className="flex-1 text-xs py-1.5 rounded-md bg-red-500 text-white hover:bg-red-600 transition-colors">Yes, clear it</button>
                <button onClick={() => setConfirmClear(false)} className="flex-1 text-xs py-1.5 rounded-md border border-red-500/40 text-red-400 hover:bg-red-950/50 transition-colors">Cancel</button>
              </div>
            </div>
          )}
        </div>

        {/* Export buttons */}
        <div className="space-y-2">
          <button onClick={exportJson} className="btn-secondary w-full justify-center py-2">
            <FileJson size={14} /> Export JSON
          </button>
          <button onClick={exportPng} className="btn-secondary w-full justify-center py-2">
            <Download size={14} /> Embed in PNG
          </button>
        </div>

        {status && (
          <p className={`text-xs text-center ${status.ok ? "text-green-600" : "text-red-500"}`}>{status.msg}</p>
        )}

        <div className="border-t border-border pt-3 mt-auto text-xs text-text-muted space-y-1.5">
          <p><strong className="text-text-secondary">JSON</strong> — portable persona format.</p>
          <p><strong className="text-text-secondary">PNG</strong> — embeds persona using the <code className="bg-bg-tertiary px-1 rounded">persona</code> chunk.</p>
        </div>
      </aside>
    </div>
  );
}

function TextAreaField({ label, value, rows, onChange, placeholder }: {
  label: string; value: string; rows: number; onChange: (v: string) => void; placeholder?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [hint, setHint] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function copy() { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }
  async function paste() {
    try {
      const t = await navigator.clipboard.readText();
      if (!t) return;
      const el = textareaRef.current;
      const start = el?.selectionStart ?? value.length;
      const end = el?.selectionEnd ?? value.length;
      const next = value.slice(0, start) + t + value.slice(end);
      onChange(next);
      requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(start + t.length, start + t.length); });
    } catch { setHint(true); setTimeout(() => setHint(false), 2500); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="label-base mb-0">{label}</label>
        <div className="flex items-center gap-1">
          <button type="button" onClick={copy} className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors">
            {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
          </button>
          <div className="relative">
            <button type="button" onClick={paste} className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"><ClipboardPaste size={12} /></button>
            {hint && <div className="absolute right-0 top-6 z-10 whitespace-nowrap bg-gray-800 text-white text-xs px-2 py-1 rounded shadow-lg">Press Ctrl+V</div>}
          </div>
        </div>
      </div>
      <textarea ref={textareaRef} className="input-base resize-none" rows={rows} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}
