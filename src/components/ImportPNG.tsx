import { useState, useCallback, useRef } from "react";
import type { TavernCardV2, MetadataInfo } from "../types";
import type { PlatformId } from "../lib/platforms";
import { Upload, FileSearch, AlertCircle, CheckCircle } from "lucide-react";
import { decodeCharaFromPng, getPngDimensions, isPng } from "../lib/pngMetadata";
import { convertCardFrom } from "../lib/platforms/converters";
import { detectPlatform, PLATFORMS } from "../lib/platforms";

interface ImportPNGProps {
  onLoad: (card: TavernCardV2, imageSrc?: string, meta?: MetadataInfo, sourcePlatform?: PlatformId) => void;
}

export default function ImportPNG({ onLoad }: ImportPNGProps) {
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [detectedPlatform, setDetectedPlatform] = useState<PlatformId | null>(null);
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

      if (!json) {
        setStatus("error");
        setMessage("No Tavern Card metadata found in this PNG. Try Decode PNG to inspect raw chunks.");
        return;
      }

      const parsed = JSON.parse(json);
      const sourcePlatformId = detectPlatform(parsed);
      const card = convertCardFrom(parsed, sourcePlatformId);
      const platform = PLATFORMS[sourcePlatformId];

      const uint8ToDataUrl = (b: Uint8Array) => {
        let bin = "";
        for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
        return "data:image/png;base64," + btoa(bin);
      };
      const imageSrc = uint8ToDataUrl(bytes);

      const meta: MetadataInfo = {
        format: platform.name,
        encoding: "Base64 + PNG tEXt chunk",
        dataSize: json.length,
        imageWidth: dims?.width ?? 0,
        imageHeight: dims?.height ?? 0,
        chunks,
        rawKey: key ?? undefined,
      };

      setDetectedPlatform(sourcePlatformId);
      setStatus("success");
      setMessage(`Loaded "${card.data.name}" — detected as ${platform.name}. Opening in editor…`);
      onLoad(card, imageSrc, meta, sourcePlatformId);
    } catch (err) {
      setStatus("error");
      setMessage(`Error: ${(err as Error).message}`);
    }
  }, [onLoad]);

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
            Load an existing Tavern Card PNG to edit it. The source platform is auto-detected
            and the target platform will be set to match.
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
              {dragging ? "Drop PNG here..." : "Drag & drop a Tavern Card PNG"}
            </p>
            <p className="text-sm text-text-muted mt-1">or click to browse files</p>
          </div>
          <p className="text-xs text-text-muted">Platform auto-detected on import</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".png,image/png"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); }}
          />
        </div>

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
              {detectedPlatform && status === "success" && (
                <p className="text-xs mt-1 opacity-75">
                  Target platform set to <strong>{PLATFORMS[detectedPlatform].name}</strong>.
                  Change it in the right panel after editing.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Platform support grid */}
        <div className="card-panel space-y-2">
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
            <FileSearch size={13} />
            Auto-detected platforms
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {Object.values(PLATFORMS).filter(p => p.pngSupport).map((p) => (
              <div key={p.id} className="flex items-center gap-2 text-xs text-text-secondary">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-green shrink-0" />
                {p.name}
              </div>
            ))}
          </div>
          <p className="text-xs text-text-muted pt-1 border-t border-border">
            JSON-only platforms (JanitorAI, Agnai, Backyard) can be imported via Decode PNG → Load into Editor.
          </p>
        </div>
      </div>
    </div>
  );
}
