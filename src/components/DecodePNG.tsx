import { useState, useCallback, useRef } from "react";
import type { TavernCardV2, MetadataInfo, LoreBook, ScriptCard, ScenarioCard, PersonaCard } from "../types";
import type { PlatformId } from "../lib/platforms";
import { FileSearch, Upload, Copy, Check, FileJson, BookOpen, FileCode2, Map, UserCircle } from "lucide-react";
import { decodeCharaFromPng, getPngDimensions, isPng } from "../lib/pngMetadata";
import { detectPlatform, PLATFORMS } from "../lib/platforms";
import { convertCardFrom } from "../lib/platforms/converters";
import FieldCompatibility from "./FieldCompatibility";

const CHARACTER_KEYS = new Set(["chara", "character", "tavern", "tavern_card_v2"]);

type NonCharType = "lorebook" | "script" | "scenario" | "persona";
const NON_CHAR_META: Record<NonCharType, { label: string; icon: React.ReactNode; color: string }> = {
  lorebook: { label: "Lorebook",     icon: <BookOpen    size={14} />, color: "text-blue-400" },
  script:   { label: "Script Card",  icon: <FileCode2   size={14} />, color: "text-orange-400" },
  scenario: { label: "Scenario Card",icon: <Map         size={14} />, color: "text-green-400" },
  persona:  { label: "Persona",      icon: <UserCircle  size={14} />, color: "text-pink-400" },
};

interface DecodePNGProps {
  onLoad: (card: TavernCardV2, imageSrc?: string, meta?: MetadataInfo, sourcePlatform?: PlatformId) => void;
  onLoadLorebook?: (book: LoreBook, imageSrc: string | null) => void;
  onLoadScript?: (card: ScriptCard, imageSrc: string | null) => void;
  onLoadScenario?: (card: ScenarioCard, imageSrc: string | null) => void;
  onLoadPersona?: (card: PersonaCard, imageSrc: string | null) => void;
}

export default function DecodePNG({ onLoad, onLoadLorebook, onLoadScript, onLoadScenario, onLoadPersona }: DecodePNGProps) {
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState<{
    json: string;
    key: string;
    sourcePlatform: PlatformId | null;
    meta: MetadataInfo;
    imageSrc: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showFullCompat, setShowFullCompat] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    setError(null);
    setResult(null);
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      if (!isPng(bytes)) { setError("Not a valid PNG file."); return; }

      const dims = getPngDimensions(bytes);
      const { json, key, chunks } = decodeCharaFromPng(bytes);

      const uint8ToDataUrl = (b: Uint8Array) => {
        let bin = "";
        for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
        return "data:image/png;base64," + btoa(bin);
      };
      const imageSrc = uint8ToDataUrl(bytes);

      if (!json || !key) {
        setError("No card metadata found in this PNG.");
        return;
      }

      const parsed = JSON.parse(json);

      // Determine detected type
      let sourcePlatform: PlatformId | null = null;
      let formatLabel = "Unknown";

      if (CHARACTER_KEYS.has(key)) {
        sourcePlatform = detectPlatform(parsed);
        formatLabel = PLATFORMS[sourcePlatform].name;
      } else if (key in NON_CHAR_META) {
        formatLabel = NON_CHAR_META[key as NonCharType].label;
      }

      const meta: MetadataInfo = {
        format: formatLabel,
        encoding: "Base64 + PNG tEXt chunk",
        dataSize: json.length,
        imageWidth: dims?.width ?? 0,
        imageHeight: dims?.height ?? 0,
        chunks,
        rawKey: key,
      };

      setResult({ json, key, sourcePlatform, meta, imageSrc });
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleLoadToEditor = () => {
    if (!result) return;
    const parsed = JSON.parse(result.json);

    if (CHARACTER_KEYS.has(result.key) && result.sourcePlatform) {
      const card = convertCardFrom(parsed, result.sourcePlatform);
      onLoad(card, result.imageSrc, result.meta, result.sourcePlatform);
      return;
    }

    if (result.key === "lorebook") { onLoadLorebook?.(parsed as LoreBook, result.imageSrc); return; }
    if (result.key === "script")   { onLoadScript?.(parsed as ScriptCard, result.imageSrc); return; }
    if (result.key === "scenario") { onLoadScenario?.(parsed as ScenarioCard, result.imageSrc); return; }
    if (result.key === "persona")  { onLoadPersona?.(parsed as PersonaCard, result.imageSrc); return; }
  };

  const handleCopy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(JSON.stringify(JSON.parse(result.json), null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const isCharCard = result && result.sourcePlatform !== null && CHARACTER_KEYS.has(result.key);
  const platform = isCharCard && result.sourcePlatform ? PLATFORMS[result.sourcePlatform] : null;

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto space-y-5">
        <div>
          <h1 className="text-xl font-bold text-text-primary mb-1">Decode PNG</h1>
          <p className="text-sm text-text-secondary">
            Inspect any card PNG's embedded metadata. All card types are detected —
            character cards, lorebooks, scripts, and scenario cards.
          </p>
        </div>

        {/* Drop zone */}
        <div
          className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 transition-colors cursor-pointer ${
            dragging ? "border-accent-purple bg-accent-purple/10" : "border-border hover:border-accent-purple/50"
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <FileSearch size={28} className="text-text-muted" />
          <p className="text-sm text-text-secondary">Drop any card PNG here to inspect its metadata</p>
          <input ref={fileInputRef} type="file" accept=".png,image/png" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); }} />
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-700/40 text-red-400 text-sm rounded-xl p-3">{error}</div>
        )}

        {result && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Image */}
              <div className="card-panel">
                <p className="section-title">Image Preview</p>
                <img src={result.imageSrc} alt="Decoded PNG" className="w-full rounded-lg object-contain max-h-48" />
              </div>

              {/* Detection summary */}
              <div className="card-panel space-y-3">
                <p className="section-title">Detection Result</p>

                {/* Type badge */}
                {platform ? (
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${platform.color} ${platform.borderColor}`}>
                    <div className="w-2 h-2 rounded-full bg-accent-green" />
                    <span className={`text-sm font-semibold ${platform.textColor}`}>{platform.name}</span>
                    <span className="text-xs text-text-muted ml-auto">detected</span>
                  </div>
                ) : result.key in NON_CHAR_META ? (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-accent-purple/30 bg-accent-purple/5">
                    <span className={NON_CHAR_META[result.key as NonCharType].color}>
                      {NON_CHAR_META[result.key as NonCharType].icon}
                    </span>
                    <span className="text-sm font-semibold text-text-primary">
                      {NON_CHAR_META[result.key as NonCharType].label}
                    </span>
                    <span className="text-xs text-text-muted ml-auto">detected</span>
                  </div>
                ) : null}

                <table className="w-full text-xs">
                  <tbody>
                    <tr><td className="py-1 text-text-muted">Key</td><td className="py-1 font-mono text-accent-purple-light">{result.meta.rawKey ?? "none"}</td></tr>
                    <tr><td className="py-1 text-text-muted">Image</td><td className="py-1 text-text-primary">{result.meta.imageWidth} × {result.meta.imageHeight} px</td></tr>
                    <tr><td className="py-1 text-text-muted">Data</td><td className="py-1 text-text-primary">{(result.meta.dataSize / 1024).toFixed(2)} KB</td></tr>
                    <tr><td className="py-1 text-text-muted">Chunks</td><td className="py-1 text-text-primary">{result.meta.chunks.length} text chunk(s)</td></tr>
                  </tbody>
                </table>

                {/* Field compatibility only for character cards */}
                {isCharCard && result.sourcePlatform && (
                  <div>
                    <button
                      onClick={() => setShowFullCompat(!showFullCompat)}
                      className="text-xs text-accent-purple-light hover:underline mb-1"
                    >
                      {showFullCompat ? "Hide" : "Show"} field compatibility
                    </button>
                    {showFullCompat
                      ? <FieldCompatibility platformId={result.sourcePlatform} />
                      : <FieldCompatibility platformId={result.sourcePlatform} compact />
                    }
                  </div>
                )}

                <button onClick={handleLoadToEditor} className="btn-primary w-full justify-center text-xs py-2">
                  <Upload size={13} /> Load into Editor
                </button>
              </div>
            </div>

            {/* Chunk list */}
            {result.meta.chunks.length > 0 && (
              <div className="card-panel">
                <p className="section-title">tEXt / iTXt Chunks</p>
                <div className="space-y-1">
                  {result.meta.chunks.map((c, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs py-1 border-b border-border/40 last:border-0">
                      <span className="badge-purple">{c.chunkType}</span>
                      <span className="font-mono text-text-primary">{c.keyword}</span>
                      <span className="text-text-muted ml-auto">{c.dataLength} bytes</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Decoded JSON */}
            <div className="card-panel">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FileJson size={14} className="text-text-muted" />
                  <p className="section-title mb-0">Decoded JSON</p>
                </div>
                <button onClick={handleCopy} className="btn-ghost py-1 text-xs">
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <pre className="bg-bg-primary rounded-lg p-3 text-xs text-text-secondary font-mono whitespace-pre-wrap overflow-x-auto border border-border max-h-72 overflow-y-auto">
                {JSON.stringify(JSON.parse(result.json), null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
