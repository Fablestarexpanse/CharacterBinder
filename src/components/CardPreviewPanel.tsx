import { useState, useCallback } from "react";
import type { AppSettings, CardProject } from "../types";
import { Download, Shield, FileJson, ChevronDown, ChevronUp } from "lucide-react";
import { validateTavernCardV2 } from "../lib/validators";
import { encodeCharaToPng, base64ToUint8Array } from "../lib/pngMetadata";
import { downloadPng } from "../lib/exporters";
import { PLATFORMS, type PlatformId } from "../lib/platforms";
import { convertCardTo } from "../lib/platforms/converters";
import PlatformSelector from "./PlatformSelector";
import FieldCompatibility from "./FieldCompatibility";

interface CardPreviewPanelProps {
  project: CardProject;
  settings: AppSettings;
  targetPlatform: PlatformId;
  onPlatformChange: (id: PlatformId) => void;
  onUpdateOutputFileName: (name: string) => void;
}

export default function CardPreviewPanel({
  project,
  settings,
  targetPlatform,
  onPlatformChange,
  onUpdateOutputFileName,
}: CardPreviewPanelProps) {
  const [exporting, setExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<{ msg: string; ok: boolean } | null>(null);
  const [compatOpen, setCompatOpen] = useState(false);

  const platform = PLATFORMS[targetPlatform];
  const validation = validateTavernCardV2(project.card);
  const lossCount = platform.fields.filter((f) => f.support === "none").length;
  const partialCount = platform.fields.filter((f) => f.support === "partial" || f.support === "renamed").length;

  const setStatus = (msg: string, ok: boolean) => {
    setExportStatus({ msg, ok });
    setTimeout(() => setExportStatus(null), 3000);
  };

  const getPlaceholderPng = useCallback(async (): Promise<Uint8Array> => {
    const MINIMAL_PNG = new Uint8Array([
      137,80,78,71,13,10,26,10,
      0,0,0,13,73,72,68,82,
      0,0,0,1,0,0,0,1,
      8,2,0,0,0,
      144,119,83,222,
      0,0,0,12,73,68,65,84,
      8,215,99,248,207,0,0,0,2,0,1,
      226,33,188,51,
      0,0,0,0,73,69,78,68,
      174,66,96,130,
    ]);
    return MINIMAL_PNG;
  }, []);

  const handleExportPng = useCallback(async () => {
    if (!platform.pngSupport) {
      setStatus(`${platform.name} doesn't support PNG embedding. Use JSON export instead.`, false);
      return;
    }
    if (settings.autoValidateBeforeExport && !validation.valid) {
      setStatus("Fix validation errors before exporting.", false);
      return;
    }
    setExporting(true);
    try {
      let pngBytes: Uint8Array;
      if (project.imageSrc) {
        if (project.imageSrc.startsWith("data:image/png")) {
          const b64 = project.imageSrc.split(",")[1];
          pngBytes = base64ToUint8Array(b64);
        } else if (project.imageSrc.startsWith("data:image/")) {
          pngBytes = await imageSrcToPngBytes(project.imageSrc);
        } else {
          pngBytes = await getPlaceholderPng();
        }
      } else {
        pngBytes = await getPlaceholderPng();
      }

      // Convert card to target platform format for embedding
      const converted = convertCardTo(project.card, targetPlatform);
      const jsonData = JSON.stringify(converted, null, settings.prettyPrintJson ? 2 : 0);
      const metaKey = platform.metadataKey ?? settings.defaultMetadataKey;
      const resultBytes = encodeCharaToPng(pngBytes, jsonData, metaKey as never, settings.preserveUnknownChunks);
      downloadPng(resultBytes, project.outputFileName);
      setStatus("PNG exported!", true);
    } catch (err) {
      setStatus(`Export failed: ${(err as Error).message}`, false);
    } finally {
      setExporting(false);
    }
  }, [project, settings, validation, platform, targetPlatform, getPlaceholderPng]);

  const handleExportJson = useCallback(() => {
    const converted = convertCardTo(project.card, targetPlatform);
    const json = JSON.stringify(converted, null, settings.prettyPrintJson ? 2 : 0);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = project.outputFileName.replace(/\.png$/, "") + `_${targetPlatform}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus("JSON exported!", true);
  }, [project, settings, targetPlatform]);

  const handleValidate = () => {
    if (validation.valid) {
      setStatus(`Valid! ${validation.warnings.length} warning(s).`, true);
    } else {
      setStatus(`${validation.errors.length} error(s): ${validation.errors[0]}`, false);
    }
  };

  const metaInfo = project.metadataInfo;

  return (
    <aside className="w-80 bg-bg-secondary border-l border-border flex flex-col shrink-0 overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        {/* Card Preview */}
        <div className="p-4 border-b border-border">
          <p className="section-title">Card Preview</p>
          <p className="text-xs text-text-muted mb-2">This is how your card will look</p>
          <div className="relative rounded-xl overflow-hidden bg-bg-tertiary border border-border aspect-[3/4]">
            {project.imageSrc ? (
              <img src={project.imageSrc} alt={project.card.data.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center text-text-muted">
                  <div className="text-4xl mb-2">🃏</div>
                  <p className="text-xs">No image</p>
                </div>
              </div>
            )}
            {project.card.data.name && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-3 py-3">
                <p className="text-white font-semibold text-sm truncate">{project.card.data.name}</p>
              </div>
            )}
          </div>
        </div>

        {/* Metadata Info */}
        <div className="p-4 border-b border-border">
          <p className="section-title">Metadata Info</p>
          <div className="space-y-2 text-xs">
            <MetaRow label="Format">
              <span className="badge-green">{metaInfo?.format ?? "Tavern Card v2 (chara)"}</span>
            </MetaRow>
            <MetaRow label="Encoding">
              <span className="text-text-primary font-mono">
                {metaInfo?.encoding ?? "Base64 + PNG tEXt chunk"}
              </span>
            </MetaRow>
            <MetaRow label="Data Size">
              <span className="text-text-primary">{formatDataSize(project.card)}</span>
            </MetaRow>
            <MetaRow label="Image Size">
              <span className="text-text-primary">
                {metaInfo ? `${metaInfo.imageWidth} × ${metaInfo.imageHeight}` : "—"}
              </span>
            </MetaRow>
            <MetaRow label="Chunks">
              <span className="text-text-primary">
                {metaInfo?.chunks.length ? metaInfo.chunks.map((c) => c.keyword).join(", ") : "chara, name"}
              </span>
            </MetaRow>
          </div>
        </div>

        {/* Target Platform */}
        <div className="p-4 border-b border-border">
          <p className="section-title">Target Platform</p>
          <PlatformSelector selected={targetPlatform} onChange={onPlatformChange} compact />

          {/* Compatibility summary */}
          <button
            onClick={() => setCompatOpen(!compatOpen)}
            className={`w-full mt-3 flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
              lossCount > 0
                ? "border-red-700/40 bg-red-900/10 text-red-400"
                : partialCount > 0
                ? "border-yellow-700/40 bg-yellow-900/10 text-yellow-400"
                : "border-green-700/40 bg-green-900/10 text-accent-green"
            }`}
          >
            <span>
              {lossCount > 0
                ? `⚠ ${lossCount} field(s) won't be exported`
                : partialCount > 0
                ? `↔ ${partialCount} field(s) will be renamed/mapped`
                : "✓ All fields fully supported"}
            </span>
            {compatOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          {compatOpen && (
            <div className="mt-2 px-1">
              <FieldCompatibility platformId={targetPlatform} compact />
            </div>
          )}
        </div>

        {/* Validation */}
        {(validation.errors.length > 0 || validation.warnings.length > 0) && (
          <div className="px-4 py-3 border-b border-border">
            <p className="section-title">Validation</p>
            {validation.errors.map((err, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-red-400 mb-1">
                <span className="shrink-0">✗</span><span>{err}</span>
              </div>
            ))}
            {validation.warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-yellow-400 mb-1">
                <span className="shrink-0">⚠</span><span>{w}</span>
              </div>
            ))}
          </div>
        )}

        {/* Output Settings */}
        <div className="p-4 border-b border-border">
          <p className="section-title">Output Settings</p>
          <div className="space-y-3">
            <div>
              <label className="label-base">Output File</label>
              <div className="flex gap-1.5">
                <input
                  className="input-base flex-1"
                  value={project.outputFileName}
                  onChange={(e) => onUpdateOutputFileName(e.target.value)}
                />
              </div>
            </div>
            {platform.metadataKey && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-muted">Metadata key</span>
                <code className="text-accent-purple-light bg-bg-tertiary px-1.5 py-0.5 rounded font-mono">
                  {platform.metadataKey}
                </code>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Export buttons */}
      <div className="p-4 border-t border-border space-y-2 shrink-0">
        <button
          onClick={handleExportPng}
          disabled={exporting || !platform.pngSupport}
          className={`w-full btn-primary justify-center py-3 text-sm font-semibold ${
            !platform.pngSupport ? "opacity-40 cursor-not-allowed" : ""
          }`}
        >
          <Download size={16} />
          {exporting ? "Exporting..." : `Export for ${platform.name}`}
        </button>

        {!platform.pngSupport && (
          <p className="text-xs text-center text-yellow-400">
            {platform.name} doesn't support PNG — use JSON export
          </p>
        )}

        {exportStatus && (
          <p className={`text-xs text-center ${exportStatus.ok ? "text-accent-green" : "text-red-400"}`}>
            {exportStatus.msg}
          </p>
        )}

        {/* Tools row */}
        <div className="border-t border-border pt-3 mt-1">
          <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">Tools</p>
          <div className="flex gap-2">
            <button onClick={handleValidate} className="btn-secondary flex-1 justify-center text-xs py-1.5">
              <Shield size={13} /> Validate
            </button>
            <button onClick={handleExportJson} className="btn-secondary flex-1 justify-center text-xs py-1.5">
              <FileJson size={13} /> Export JSON
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-text-muted shrink-0">{label}:</span>
      <div className="text-right">{children}</div>
    </div>
  );
}

function formatDataSize(card: unknown): string {
  const json = JSON.stringify(card);
  const kb = (new Blob([json]).size / 1024).toFixed(2);
  return `${kb} KB`;
}

async function imageSrcToPngBytes(dataUrl: string): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas not available"));
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        if (!blob) return reject(new Error("Failed to convert image"));
        blob.arrayBuffer().then((buf) => resolve(new Uint8Array(buf)));
      }, "image/png");
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}
