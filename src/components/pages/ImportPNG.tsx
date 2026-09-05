import { useState, useCallback, useRef } from "react";
import type { TavernCardV2, MetadataInfo, LibraryCardType, OpenDataCard } from "../../types";
import type { PlatformId } from "../../shared/platforms/registry";
import { Upload, FileSearch, AlertCircle, CheckCircle, BookOpen, FileCode2, Map, UserCircle } from "lucide-react";
import { readCardPng } from "../../lib/readCardPng";
import { convertCardFrom } from "../../shared/platforms/converters";
import { detectPlatform, PLATFORMS } from "../../shared/platforms/registry";
import { errorMessage } from "../../shared/errorMessage";

type DetectedType = LibraryCardType | null;

interface ImportPNGProps {
  onLoad: (card: TavernCardV2, imageSrc?: string, meta?: MetadataInfo, sourcePlatform?: PlatformId) => void;
  /** Open a lorebook, script, scenario or persona in the editor for its kind. */
  onOpenDataCard: OpenDataCard;
}

/** ST writes lorebook entries as an array or as an object keyed by index. */
function countEntries(parsed: { entries?: unknown }): number {
  if (Array.isArray(parsed.entries)) return parsed.entries.length;
  if (parsed.entries && typeof parsed.entries === "object") return Object.keys(parsed.entries).length;
  return 0;
}

const TYPE_LABELS: Record<NonNullable<DetectedType>, string> = {
  character: "Character Card",
  lorebook: "Lorebook",
  script: "Script Card",
  scenario: "Scenario Card",
  persona: "Persona",
};

const TYPE_KEYS: Record<NonNullable<DetectedType>, string> = {
  character: "chara",
  lorebook: "lorebook",
  script: "script",
  scenario: "scenario",
  persona: "persona",
};

export default function ImportPNG({ onLoad, onOpenDataCard }: ImportPNGProps) {
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [detectedType, setDetectedType] = useState<DetectedType>(null);
  const [detectedPlatform, setDetectedPlatform] = useState<PlatformId | null>(null);
  const [detectedKey, setDetectedKey] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const importPngFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".png") && !file.type.includes("png")) {
      setStatus("error");
      setMessage("Please select a PNG file.");
      return;
    }

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const result = readCardPng(bytes);

      if (result.kind === "not-png") {
        setStatus("error");
        setMessage("File is not a valid PNG.");
        return;
      }
      if (result.kind !== "card") {
        setStatus("error");
        // "No card" and "damaged card" call for opposite responses, so say which.
        setMessage(
          result.kind === "damaged"
            ? `This PNG carries a '${result.corruptKey}' card chunk, but its contents are damaged and couldn't be read. The file was probably truncated or re-saved by an image editor. Try Decode PNG to inspect the raw chunks.`
            : "No card metadata found in this PNG. Try Decode PNG to inspect raw chunks."
        );
        return;
      }

      const { key, json, parsed, imageSrc, chunks, dimensions, shape: effective, mismatch } = result;
      setDetectedKey(key);
      const mismatchNote = mismatch
        ? ` (the file is labelled '${key}' but its contents are a ${effective} card, so it was opened as one)`
        : "";

      // ── Character card ──────────────────────────────────────────────
      if (effective === "character") {
        const sourcePlatformId = detectPlatform(parsed);
        const card = convertCardFrom(parsed, sourcePlatformId);
        const platform = PLATFORMS[sourcePlatformId];

        const meta: MetadataInfo = {
          format: platform.name,
          encoding: "Base64 + PNG tEXt chunk",
          dataSize: json.length,
          imageWidth: dimensions?.width ?? 0,
          imageHeight: dimensions?.height ?? 0,
          chunks,
          rawKey: key,
        };

        setDetectedType("character");
        setDetectedPlatform(sourcePlatformId);
        setStatus("success");
        setMessage(`Loaded character "${card.data.name}" — detected as ${platform.name}${mismatchNote}. Opening in editor…`);
        onLoad(card, imageSrc, meta, sourcePlatformId);
        return;
      }

      // ── Everything else ─────────────────────────────────────────────
      if (effective) {
        setDetectedType(effective);
        setStatus("success");
        // Entry count is the one detail worth spelling out per kind: a lorebook
        // that imports with none is the failure this panel exists to surface.
        const detail = effective === "lorebook" ? ` — ${countEntries(parsed)} entries` : "";
        const label = TYPE_LABELS[effective].toLowerCase();
        setMessage(`Loaded ${label} "${parsed.name || "Unnamed"}"${detail}${mismatchNote}. Opening in editor…`);
        onOpenDataCard(effective, parsed, imageSrc);
        return;
      }

      setStatus("error");
      setMessage(`Unrecognised metadata key "${key}". Cannot load this card.`);
    } catch (err) {
      setStatus("error");
      setMessage(`Error: ${errorMessage(err)}`);
    }
  }, [onLoad, onOpenDataCard]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) importPngFile(file);
  }, [importPngFile]);

  return (
    <div className="h-full flex flex-col items-center justify-center p-8">
      <div className="max-w-lg w-full space-y-6">
        <div>
          <h1 className="text-xl font-bold text-text-primary mb-1">Import PNG Card</h1>
          <p className="text-sm text-text-secondary">
            Load any card PNG to edit it — character cards, lorebooks, scripts, scenario cards,
            and personas are all auto-detected from the embedded metadata key.
          </p>
        </div>

        {/* Drop zone */}
        <div
          className={`relative border-2 border-dashed rounded-2xl p-12 flex flex-col items-center gap-4 transition-colors cursor-pointer ${
            dragging
              ? "border-accent-purple bg-accent-purple/10"
              : "border-border hover:border-accent-purple/50 hover:bg-bg-hover"
          }`}
          role="button"
          tabIndex={0}
          aria-label="Choose a card PNG to import, or drop one here"
          onKeyDown={(e) => {
            // The visible target is a div and the real input is display:none, so
            // without this there was no keyboard path to import a card at all.
            if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInputRef.current?.click(); }
          }}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${dragging ? "bg-accent-purple/30" : "bg-bg-tertiary"}`}>
            <Upload size={32} className={dragging ? "text-accent-purple-light" : "text-text-muted"} />
          </div>
          <div className="text-center">
            <p className="text-text-primary font-medium">
              {dragging ? "Drop PNG here..." : "Drag & drop a card PNG"}
            </p>
            <p className="text-sm text-text-muted mt-1">or click to browse files</p>
          </div>
          <p className="text-xs text-text-muted">Card type &amp; platform auto-detected on import</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".png,image/png"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) importPngFile(f); }}
          />
        </div>

        {/* Status */}
        {status !== "idle" && (
          <div className={`flex items-start gap-3 p-4 rounded-xl border ${
            status === "success"
              ? "bg-status-ok-soft border-status-ok-border text-status-ok"
              : "bg-status-danger-soft border-status-danger-border text-status-danger"
          }`}>
            {status === "success"
              ? <CheckCircle size={18} className="shrink-0 mt-0.5" />
              : <AlertCircle size={18} className="shrink-0 mt-0.5" />}
            <div>
              <p className="text-sm">{message}</p>
              {status === "success" && detectedType && (
                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                  <span className="text-xs opacity-75">
                    Type: <strong>{TYPE_LABELS[detectedType]}</strong>
                  </span>
                  <code className="text-xs bg-black/20 px-1.5 py-0.5 rounded font-mono">
                    key: {detectedKey ?? TYPE_KEYS[detectedType]}
                  </code>
                  {detectedType === "character" && detectedPlatform && (
                    <span className="text-xs opacity-75">
                      Platform: <strong>{PLATFORMS[detectedPlatform].name}</strong>
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Supported card types grid */}
        <div className="card-panel space-y-3">
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
            <FileSearch size={13} />
            Supported card types
          </p>

          {/* Character cards */}
          <div>
            <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">Character Cards</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {Object.values(PLATFORMS).filter(p => p.pngSupport).map((p) => (
                <div key={p.id} className="flex items-center gap-2 text-xs text-text-secondary">
                  <span className="w-1.5 h-1.5 rounded-full bg-status-ok shrink-0" />
                  {p.name}
                </div>
              ))}
            </div>
          </div>

          {/* Other card types */}
          <div>
            <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">Other Card Types</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: <BookOpen size={11} />, label: "Lorebook", key: "lorebook" },
                { icon: <FileCode2 size={11} />, label: "Script", key: "script" },
                { icon: <Map size={11} />, label: "Scenario", key: "scenario" },
                { icon: <UserCircle size={11} />, label: "Persona", key: "persona" },
              ].map(({ icon, label, key }) => (
                <div key={key} className="flex items-center gap-1.5 text-xs text-text-secondary">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-purple shrink-0" />
                  {icon}
                  <span>{label}</span>
                  <code className="text-[10px] text-text-muted font-mono ml-auto">{key}</code>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-text-muted pt-1 border-t border-border">
            JSON-only platforms (JanitorAI, Agnai, Backyard) can be imported via Decode PNG → Load into Editor.
          </p>
        </div>
      </div>
    </div>
  );
}
