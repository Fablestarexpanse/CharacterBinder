import { useState, useCallback } from "react";
import type { MetadataInfo, OpenDataCard, LibraryCardType, DataCardType, LoadCharacterCard } from "../../types";
import type { PlatformId } from "../../shared/platforms/registry";
import { FileSearch, Upload, Copy, Check, FileJson, BookOpen, FileCode2, Map, UserCircle } from "lucide-react";
import { readCardPng } from "../../lib/png/readCardPng";
import PngDropzone from "../ui/PngDropzone";
import { detectPlatform, PLATFORMS } from "../../shared/platforms/registry";
import { convertCardFrom } from "../../shared/platforms/converters";
import FieldCompatibility from "../editor/FieldCompatibility";
import { useTimedFlag } from "../../hooks/useTimedFlag";
import { errorMessage } from "../../shared/errorMessage";

const NON_CHAR_META: Record<DataCardType, { label: string; icon: React.ReactNode; color: string }> = {
  lorebook: { label: "Lorebook",     icon: <BookOpen    size={14} />, color: "text-status-info" },
  script:   { label: "Script Card",  icon: <FileCode2   size={14} />, color: "text-status-warn" },
  scenario: { label: "Scenario Card",icon: <Map         size={14} />, color: "text-status-ok" },
  persona:  { label: "Persona",      icon: <UserCircle  size={14} />, color: "text-accent-purple-light" },
};

interface DecodePNGProps {
  onOpenCharacterCard: LoadCharacterCard;
  /** Open a lorebook, script, scenario or persona in the editor for its kind. */
  onOpenDataCard: OpenDataCard;
}

export default function DecodePNG({ onOpenCharacterCard, onOpenDataCard }: DecodePNGProps) {
  const [result, setResult] = useState<{
    json: string;
    key: string;
    /** What the payload actually is, which need not match the keyword. */
    cardType: LibraryCardType | null;
    /** Set when the keyword and the payload disagree; shown to the user. */
    mismatch: boolean;
    sourcePlatform: PlatformId | null;
    meta: MetadataInfo;
    imageSrc: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, flashCopied] = useTimedFlag();
  const [showFullCompat, setShowFullCompat] = useState(false);

  const inspectPngFile = useCallback(async (file: File) => {
    setError(null);
    setResult(null);
    try {
      const decoded = readCardPng(new Uint8Array(await file.arrayBuffer()));
      if (decoded.kind === "not-png") { setError("Not a valid PNG file."); return; }
      if (decoded.kind !== "card") {
        setError(
          decoded.kind === "damaged"
            ? `Found a '${decoded.corruptKey}' chunk, but its payload is damaged and couldn't be decoded. The chunk list below shows what is actually in the file.`
            : "No card metadata found in this PNG."
        );
        return;
      }

      const { key, json, parsed, imageSrc, chunks, dimensions, cardType, mismatch } = decoded;

      let sourcePlatform: PlatformId | null = null;
      let formatLabel = "Unknown";

      if (cardType === "character") {
        sourcePlatform = detectPlatform(parsed);
        formatLabel = PLATFORMS[sourcePlatform].name;
      } else if (cardType) {
        formatLabel = NON_CHAR_META[cardType].label;
      }

      const meta: MetadataInfo = {
        format: formatLabel,
        encoding: "Base64 + PNG tEXt chunk",
        dataSize: json.length,
        imageWidth: dimensions?.width ?? 0,
        imageHeight: dimensions?.height ?? 0,
        chunks,
        rawKey: key,
      };

      setResult({ json, key, cardType, mismatch, sourcePlatform, meta, imageSrc });
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  const handleLoadToEditor = () => {
    if (!result) return;
    const parsed = JSON.parse(result.json);

    if (result.cardType === "character" && result.sourcePlatform) {
      const card = convertCardFrom(parsed, result.sourcePlatform);
      onOpenCharacterCard(card, result.imageSrc, result.meta, result.sourcePlatform);
      return;
    }

    if (result.cardType && result.cardType !== "character") {
      onOpenDataCard(result.cardType, parsed, result.imageSrc);
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(JSON.parse(result.json), null, 2));
      flashCopied();
    } catch (err) {
      // Clipboard writes are refused without focus or permission; saying so
      // beats a Copy button that quietly does nothing.
      setError(`Couldn't copy to the clipboard: ${errorMessage(err)}`);
    }
  };

  // The narrowed value rather than a flag beside it: the flag had to be
  // re-tested against the same field at every use site to convince the compiler.
  const charPlatform = result && result.cardType === "character" ? result.sourcePlatform : null;
  const platform = charPlatform ? PLATFORMS[charPlatform] : null;

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

        <PngDropzone onFile={inspectPngFile} label="Choose a card PNG to inspect">
          {() => (
            <>
              <FileSearch size={28} className="text-text-muted" />
              <p className="text-sm text-text-secondary">Drop any card PNG here to inspect its metadata</p>
            </>
          )}
        </PngDropzone>

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
                ) : result.cardType && result.cardType !== "character" ? (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-accent-purple/30 bg-accent-purple/5">
                    <span className={NON_CHAR_META[result.cardType].color}>
                      {NON_CHAR_META[result.cardType].icon}
                    </span>
                    <span className="text-sm font-semibold text-text-primary">
                      {NON_CHAR_META[result.cardType].label}
                    </span>
                    <span className="text-xs text-text-muted ml-auto">detected</span>
                  </div>
                ) : null}

                {result.mismatch && (
                  <p className="text-xs text-status-warn bg-status-warn-soft border border-status-warn-border rounded-lg px-3 py-2">
                    This file is labelled <code className="font-mono">{result.key}</code>, but its contents are a{" "}
                    {result.cardType} card. It will open as a {result.cardType}.
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
                {charPlatform && (
                  <div>
                    <button
                      onClick={() => setShowFullCompat(!showFullCompat)}
                      aria-expanded={showFullCompat}
                      className="text-xs text-accent-purple-light hover:underline mb-1"
                    >
                      {showFullCompat ? "Hide" : "Show"} field compatibility
                    </button>
                    {showFullCompat
                      ? <FieldCompatibility platformId={charPlatform} />
                      : <FieldCompatibility platformId={charPlatform} compact />
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
