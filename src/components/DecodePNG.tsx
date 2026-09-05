import { useState, useCallback, useRef } from "react";
import type { TavernCardV2, MetadataInfo, OpenDataCard, LibraryCardType } from "../types";
import type { PlatformId } from "../lib/platforms";
import { FileSearch, Upload, Copy, Check, FileJson, BookOpen, FileCode2, Map, UserCircle } from "lucide-react";
import { decodeCharaFromPng, getPngDimensions, isPng } from "../lib/pngMetadata";
import { detectPlatform, PLATFORMS } from "../lib/platforms";
import { convertCardFrom } from "../lib/platforms/converters";
import FieldCompatibility from "./FieldCompatibility";
import { useTimedFlag } from "../hooks/useTimedFlag";
import { effectiveShape } from "../lib/cardShape";
import { pngBytesToDataUrl } from "../lib/carrierImage";
import { errorMessage } from "../lib/errorMessage";

type NonCharType = "lorebook" | "script" | "scenario" | "persona";
const NON_CHAR_META: Record<NonCharType, { label: string; icon: React.ReactNode; color: string }> = {
  lorebook: { label: "Lorebook",     icon: <BookOpen    size={14} />, color: "text-status-info" },
  script:   { label: "Script Card",  icon: <FileCode2   size={14} />, color: "text-status-warn" },
  scenario: { label: "Scenario Card",icon: <Map         size={14} />, color: "text-status-ok" },
  persona:  { label: "Persona",      icon: <UserCircle  size={14} />, color: "text-accent-purple-light" },
};

interface DecodePNGProps {
  onLoad: (card: TavernCardV2, imageSrc?: string, meta?: MetadataInfo, sourcePlatform?: PlatformId) => void;
  /** Open a lorebook, script, scenario or persona in the editor for its kind. */
  onOpenDataCard: OpenDataCard;
}

export default function DecodePNG({ onLoad, onOpenDataCard }: DecodePNGProps) {
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState<{
    json: string;
    key: string;
    /** What the payload actually is, which need not match the keyword. */
    shape: LibraryCardType | null;
    /** Set when the keyword and the payload disagree; shown to the user. */
    mismatch: boolean;
    sourcePlatform: PlatformId | null;
    meta: MetadataInfo;
    imageSrc: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, flashCopied] = useTimedFlag();
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
      const { json, key, chunks, corruptKey } = decodeCharaFromPng(bytes);

      const imageSrc = pngBytesToDataUrl(bytes);

      if (!json || !key) {
        setError(
          corruptKey
            ? `Found a '${corruptKey}' chunk, but its payload is damaged and couldn't be decoded. The chunk list below shows what is actually in the file.`
            : "No card metadata found in this PNG."
        );
        return;
      }

      const parsed = JSON.parse(json);

      // The keyword says what the file claims to be; the payload shape says
      // what it is. Import PNG has trusted the shape since a lorebook stored
      // under `chara` was rebuilt as a blank character card; this panel loaded
      // by keyword alone, so the same file opened as an empty card here.
      const { shape, mismatch } = effectiveShape(key, parsed);

      let sourcePlatform: PlatformId | null = null;
      let formatLabel = "Unknown";

      if (shape === "character") {
        sourcePlatform = detectPlatform(parsed);
        formatLabel = PLATFORMS[sourcePlatform].name;
      } else if (shape && shape in NON_CHAR_META) {
        formatLabel = NON_CHAR_META[shape as NonCharType].label;
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

      setResult({ json, key, shape, mismatch, sourcePlatform, meta, imageSrc });
    } catch (err) {
      setError(errorMessage(err));
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

    if (result.shape === "character" && result.sourcePlatform) {
      const card = convertCardFrom(parsed, result.sourcePlatform);
      onLoad(card, result.imageSrc, result.meta, result.sourcePlatform);
      return;
    }

    if (result.shape && result.shape !== "character") {
      onOpenDataCard(result.shape, parsed, result.imageSrc);
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(JSON.stringify(JSON.parse(result.json), null, 2));
    flashCopied();
  };

  const isCharCard = result && result.sourcePlatform !== null && result.shape === "character";
  const platform = isCharCard && result.sourcePlatform ? PLATFORMS[result.sourcePlatform] : null;

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto space-y-5">
        <div>
          <h1 className="text-xl font-bold text-text-primary mb-1">Decode PNG</h1>
          <p className="text-sm text-text-secondary">
            Inspect any card PNG's embedded metadata. All card types are detected —
            character cards, lorebooks, scripts, scenario cards, and personas.
          </p>
        </div>

        {/* Drop zone */}
        <div
          className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 transition-colors cursor-pointer ${
            dragging ? "border-accent-purple bg-accent-purple/10" : "border-border hover:border-accent-purple/50"
          }`}
          role="button"
          tabIndex={0}
          aria-label="Choose a card PNG to inspect, or drop one here"
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInputRef.current?.click(); }
          }}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <FileSearch size={28} className="text-text-muted" />
          <p className="text-sm text-text-secondary">Drop any card PNG here to inspect its metadata</p>
          <input ref={fileInputRef} type="file" accept=".png,image/png" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); e.currentTarget.value = ""; }} />
        </div>

        {error && (
          <div role="alert" className="bg-status-danger-soft border border-status-danger-border text-status-danger text-sm rounded-xl p-3">{error}</div>
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
                    <div className="w-2 h-2 rounded-full bg-status-ok" />
                    <span className={`text-sm font-semibold ${platform.textColor}`}>{platform.name}</span>
                    <span className="text-xs text-text-muted ml-auto">detected</span>
                  </div>
                ) : result.shape && result.shape in NON_CHAR_META ? (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-accent-purple/30 bg-accent-purple/5">
                    <span className={NON_CHAR_META[result.shape as NonCharType].color}>
                      {NON_CHAR_META[result.shape as NonCharType].icon}
                    </span>
                    <span className="text-sm font-semibold text-text-primary">
                      {NON_CHAR_META[result.shape as NonCharType].label}
                    </span>
                    <span className="text-xs text-text-muted ml-auto">detected</span>
                  </div>
                ) : null}

                {result.mismatch && (
                  <p className="text-xs text-status-warn bg-status-warn-soft border border-status-warn-border rounded-lg px-3 py-2">
                    This file is labelled <code className="font-mono">{result.key}</code>, but its contents are a{" "}
                    {result.shape} card. It will open as a {result.shape}.
                  </p>
                )}

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
                      aria-expanded={showFullCompat}
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
