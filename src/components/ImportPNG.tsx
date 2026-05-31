import { useState, useCallback, useRef } from "react";
import type { TavernCardV2, MetadataInfo, LoreBook, ScriptCard, ScenarioCard } from "../types";
import type { PlatformId } from "../lib/platforms";
import { Upload, FileSearch, AlertCircle, CheckCircle, BookOpen, FileCode2, Map } from "lucide-react";
import { decodeCharaFromPng, getPngDimensions, isPng } from "../lib/pngMetadata";
import { convertCardFrom } from "../lib/platforms/converters";
import { detectPlatform, PLATFORMS } from "../lib/platforms";

const CHARACTER_KEYS = new Set(["chara", "character", "tavern", "tavern_card_v2"]);

type DetectedType = "character" | "lorebook" | "script" | "scenario" | null;

interface ImportPNGProps {
  onLoad: (card: TavernCardV2, imageSrc?: string, meta?: MetadataInfo, sourcePlatform?: PlatformId) => void;
  onLoadLorebook?: (book: LoreBook, imageSrc: string | null) => void;
  onLoadScript?: (card: ScriptCard, imageSrc: string | null) => void;
  onLoadScenario?: (card: ScenarioCard, imageSrc: string | null) => void;
}

const TYPE_LABELS: Record<NonNullable<DetectedType>, string> = {
  character: "Character Card",
  lorebook: "Lorebook",
  script: "Script Card",
  scenario: "Scenario Card",
};

const TYPE_KEYS: Record<NonNullable<DetectedType>, string> = {
  character: "chara",
  lorebook: "lorebook",
  script: "script",
  scenario: "scenario",
};

function uint8ToDataUrl(b: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
  return "data:image/png;base64," + btoa(bin);
}

export default function ImportPNG({ onLoad, onLoadLorebook, onLoadScript, onLoadScenario }: ImportPNGProps) {
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [detectedType, setDetectedType] = useState<DetectedType>(null);
  const [detectedPlatform, setDetectedPlatform] = useState<PlatformId | null>(null);
  const [detectedKey, setDetectedKey] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".png") && !file.type.includes("png")) {
      setStatus("error");
      setMessage("Please select a PNG file.");
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);

      if (!isPng(bytes)) {
        setStatus("error");
        setMessage("File is not a valid PNG.");
        return;
      }

      const dims = getPngDimensions(bytes);
      const { json, key, chunks } = decodeCharaFromPng(bytes);

      if (!json || !key) {
        setStatus("error");
        setMessage("No card metadata found in this PNG. Try Decode PNG to inspect raw chunks.");
        return;
      }

      const parsed = JSON.parse(json);
      const imageSrc = uint8ToDataUrl(bytes);
      setDetectedKey(key);

      // ── Character card ──────────────────────────────────────────────
      if (CHARACTER_KEYS.has(key)) {
        const sourcePlatformId = detectPlatform(parsed);
        const card = convertCardFrom(parsed, sourcePlatformId);
        const platform = PLATFORMS[sourcePlatformId];

        const meta: MetadataInfo = {
          format: platform.name,
          encoding: "Base64 + PNG tEXt chunk",
          dataSize: json.length,
          imageWidth: dims?.width ?? 0,
          imageHeight: dims?.height ?? 0,
          chunks,
          rawKey: key,
        };

        setDetectedType("character");
        setDetectedPlatform(sourcePlatformId);
        setStatus("success");
        setMessage(`Loaded character "${card.data.name}" — detected as ${platform.name}. Opening in editor…`);
        onLoad(card, imageSrc, meta, sourcePlatformId);
        return;
      }

      // ── Lorebook ────────────────────────────────────────────────────
      if (key === "lorebook") {
        setDetectedType("lorebook");
        setStatus("success");
        const entryCount = Array.isArray(parsed.entries)
          ? parsed.entries.length
          : typeof parsed.entries === "object" && parsed.entries
          ? Object.keys(parsed.entries).length
          : 0;
        setMessage(`Loaded lorebook "${parsed.name || "Unnamed"}" — ${entryCount} entries. Opening in editor…`);
        onLoadLorebook?.(parsed as LoreBook, imageSrc);
        return;
      }

      // ── Script card ─────────────────────────────────────────────────
      if (key === "script") {
        setDetectedType("script");
        setStatus("success");
        setMessage(`Loaded script "${parsed.name || "Unnamed"}". Opening in editor…`);
        onLoadScript?.(parsed as ScriptCard, imageSrc);
        return;
      }

      // ── Scenario card ───────────────────────────────────────────────
      if (key === "scenario") {
        setDetectedType("scenario");
        setStatus("success");
        setMessage(`Loaded scenario "${parsed.name || "Unnamed"}". Opening in editor…`);
        onLoadScenario?.(parsed as ScenarioCard, imageSrc);
        return;
      }

      setStatus("error");
      setMessage(`Unrecognised metadata key "${key}". Cannot load this card.`);
    } catch (err) {
      setStatus("error");
      setMessage(`Error: ${(err as Error).message}`);
    }
  }, [onLoad, onLoadLorebook, onLoadScript, onLoadScenario]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  return (
    <div className="h-full flex flex-col items-center justify-center p-8">
      <div className="max-w-lg w-full space-y-6">
        <div>
          <h1 className="text-xl font-bold text-text-primary mb-1">Import PNG Card</h1>
          <p className="text-sm text-text-secondary">
            Load any card PNG to edit it — character cards, lorebooks, scripts, and scenario cards
            are all auto-detected from the embedded metadata key.
          </p>
        </div>

        {/* Drop zone */}
        <div
          className={`relative border-2 border-dashed rounded-2xl p-12 flex flex-col items-center gap-4 transition-colors cursor-pointer ${
            dragging
              ? "border-accent-purple bg-accent-purple/10"
              : "border-border hover:border-accent-purple/50 hover:bg-bg-hover"
          }`}
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
            onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); }}
          />
        </div>

        {/* Status */}
        {status !== "idle" && (
          <div className={`flex items-start gap-3 p-4 rounded-xl border ${
            status === "success"
              ? "bg-green-900/20 border-green-700/40 text-accent-green"
              : "bg-red-900/20 border-red-700/40 text-red-400"
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
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-green shrink-0" />
                  {p.name}
                </div>
              ))}
            </div>
          </div>

          {/* Other card types */}
          <div>
            <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">Other Card Types</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { icon: <BookOpen size={11} />, label: "Lorebook", key: "lorebook" },
                { icon: <FileCode2 size={11} />, label: "Script", key: "script" },
                { icon: <Map size={11} />, label: "Scenario", key: "scenario" },
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
