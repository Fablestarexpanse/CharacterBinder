import { useState, useCallback, useEffect, useMemo, useId } from "react";
import type { AppSettings, CardProject } from "../../types";
import { Download, Shield, FileJson, ChevronDown, ChevronUp, BookMarked, LayoutTemplate, FilePlus, AlertTriangle } from "lucide-react";
import { saveLibraryCard } from "../../lib/library";
import { saveCustomTemplate } from "../../lib/customTemplates";
import {
  getCardTokenBreakdown,
  getTokenBudgetLevel,
  tokenBudgetPercent,
  TOKEN_BUDGET_LABELS,
  TOKEN_BUDGET_COLORS,
  TOKEN_BUDGET_BAR_COLORS,
} from "../../lib/tokenizer";
import { validateTavernCardV2 } from "../../lib/validators";
import { encodeCharaToPng } from "../../lib/pngMetadata";
import { getCarrierPng } from "../../lib/carrierImage";
import { downloadJson, downloadPng } from "../../lib/download";
import { useStatusMessage } from "../../hooks/useStatusMessage";
import { PLATFORMS, type PlatformId } from "../../lib/platforms";
import { convertCardTo } from "../../lib/platforms/converters";
import PlatformSelector from "./PlatformSelector";
import FieldCompatibility from "./FieldCompatibility";
import { errorMessage } from "../../lib/errorMessage";

/**
 * Chunk key used when the target platform declares none of its own — i.e. the
 * platforms that can't read card PNGs at all. `chara` is what every PNG-capable
 * app looks for, so the exported file stays importable elsewhere.
 */
const FALLBACK_METADATA_KEY = "chara" as const;

interface CardPreviewPanelProps {
  project: CardProject;
  settings: AppSettings;
  targetPlatform: PlatformId;
  onPlatformChange: (id: PlatformId) => void;
  onUpdateOutputFileName: (name: string) => void;
  /** Adopt the id the library assigned, so the next save updates that record. */
  onSavedToLibrary?: (id: string) => void;
  onNewCard?: () => void;
}

export default function CardPreviewPanel({
  project,
  settings,
  targetPlatform,
  onPlatformChange,
  onUpdateOutputFileName,
  onSavedToLibrary,
  onNewCard,
}: CardPreviewPanelProps) {
  const outputFileId = useId();
  const [exporting, setExporting] = useState(false);
  const [compatOpen, setCompatOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedCharVersion, setSavedCharVersion] = useState<string>(project.card.data.character_version ?? "1.0");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [tokenOpen, setTokenOpen] = useState(false);
  const { status: exportStatus, setMsg: setStatus } = useStatusMessage();

  // Loading a different card from the library swaps `project` without remounting
  // this panel, so the "has the version been bumped?" baseline has to follow it —
  // otherwise it keeps comparing against the previously-open card's version.
  useEffect(() => {
    setSavedCharVersion(project.card.data.character_version ?? "1.0");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  const platform = PLATFORMS[targetPlatform];

  // Tokenizing is a full BPE encode over nine fields; without memoizing it runs
  // on every render, i.e. on every keystroke anywhere in the editor.
  const validation = useMemo(() => validateTavernCardV2(project.card), [project.card]);
  const tokenBreakdown = useMemo(() => getCardTokenBreakdown(project.card), [project.card]);
  const dataSize = useMemo(() => formatDataSize(project.card), [project.card]);

  const budgetLevel = getTokenBudgetLevel(tokenBreakdown.total);
  const barPct = tokenBudgetPercent(tokenBreakdown.total);

  // Only warn about fields the card actually uses — otherwise every card reports
  // the platform's full theoretical loss list, including empty fields.
  const usedFields = useMemo(
    () => platform.fields.filter((f) => {
      const v = project.card.data[f.field];
      if (Array.isArray(v)) return v.length > 0;
      if (typeof v === "string") return v.trim().length > 0;
      return v != null;
    }),
    [platform, project.card]
  );
  const lossCount = usedFields.filter((f) => f.support === "none").length;
  const partialCount = usedFields.filter((f) => f.support === "partial" || f.support === "renamed").length;

  const handleExportPng = useCallback(async () => {
    // PNG export is never blocked. Platforms that can't read card PNGs still
    // produce a perfectly valid file — it just has to be imported somewhere
    // else, so the UI warns rather than refusing.
    if (settings.autoValidateBeforeExport && !validation.valid) {
      setStatus("Fix validation errors before exporting.", false);
      return;
    }
    setExporting(true);
    try {
      const pngBytes = await getCarrierPng(project.imageSrc);
      // Convert card to target platform format for embedding
      const converted = convertCardTo(project.card, targetPlatform);
      const jsonData = JSON.stringify(converted, null, settings.prettyPrintJson ? 2 : 0);
      // Platforms that can't read PNG cards carry no key of their own; fall back
      // to the configured default so the file is still a valid, importable card
      // rather than refusing to export.
      const metaKey = platform.metadataKey ?? FALLBACK_METADATA_KEY;
      const resultBytes = encodeCharaToPng(
        pngBytes,
        jsonData,
        metaKey,
        settings.preserveUnknownChunks
      );
      downloadPng(resultBytes, project.outputFileName);
      setStatus(
        platform.pngSupport
          ? "PNG exported!"
          : `PNG exported — remember ${platform.name} needs the JSON instead.`,
        true
      );
    } catch (err) {
      setStatus(`Export failed: ${errorMessage(err)}`, false);
    } finally {
      setExporting(false);
    }
  }, [project, settings, validation, platform, targetPlatform, setStatus]);

  const handleExportJson = useCallback(() => {
    const converted = convertCardTo(project.card, targetPlatform);
    const name = project.outputFileName.replace(/\.png$/i, "") + `_${targetPlatform}`;
    downloadJson(converted, name, settings.prettyPrintJson);
    setStatus("JSON exported!", true);
  }, [project, settings, targetPlatform, setStatus]);

  const handleValidate = () => {
    if (validation.valid) {
      setStatus(`Valid! ${validation.warnings.length} warning(s).`, true);
    } else {
      setStatus(`${validation.errors.length} error(s): ${validation.errors[0]}`, false);
    }
  };

  const handleSaveToLibrary = useCallback(async () => {
    setSaving(true);
    const currentVersion = project.card.data.character_version ?? "";
    const hasExistingId = project.id !== "default";
    const versionChanged = hasExistingId && currentVersion.trim() !== savedCharVersion;
    try {
      // Store a real card PNG, not the bare cover art. This is what Archive
      // writes into the ZIP, and it used to be the un-encoded image — so a
      // backup of any card that had cover art contained no card data at all.
      const carrier = await getCarrierPng(project.imageSrc);
      const converted = convertCardTo(project.card, targetPlatform);
      const json = JSON.stringify(converted, null, settings.prettyPrintJson ? 2 : 0);
      const pngData = encodeCharaToPng(
        carrier,
        json,
        platform.metadataKey ?? FALLBACK_METADATA_KEY,
        settings.preserveUnknownChunks
      );

      const existingId = hasExistingId && !versionChanged ? project.id : undefined;
      const saved = await saveLibraryCard({
        cardType: "character",
        body: project.card,
        pngData,
        imageSrc: project.imageSrc ?? null,
        platform: targetPlatform,
        existingId,
      });
      // Adopt the new id. Without this every save created another record, and a
      // version bump left the editor still pointing at the previous row — so the
      // next save overwrote the version the user had just preserved.
      onSavedToLibrary?.(saved.id);
      setSavedCharVersion(currentVersion);
      setStatus(versionChanged ? "Saved as new version!" : hasExistingId ? "Library updated!" : "Saved to library!", true);
    } catch {
      setStatus("Failed to save to library.", false);
    } finally {
      setSaving(false);
    }
  }, [project, targetPlatform, savedCharVersion, setStatus, settings, platform, onSavedToLibrary]);

  const handleSaveAsTemplate = useCallback(() => {
    setSavingTemplate(true);
    try {
      saveCustomTemplate(project.card);
      setStatus("Saved as template!", true);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to save template.", false);
    } finally {
      setSavingTemplate(false);
    }
  }, [project.card, setStatus]);

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
              <span className="text-text-primary">{dataSize}</span>
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

        {/* Token Budget */}
        <div className="p-4 border-b border-border">
          <button
            onClick={() => setTokenOpen(!tokenOpen)}
            aria-expanded={tokenOpen}
            className="w-full flex items-center justify-between mb-2"
          >
            <p className="section-title mb-0">Token Count</p>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-bold ${TOKEN_BUDGET_COLORS[budgetLevel]}`}>
                {tokenBreakdown.total.toLocaleString()}
              </span>
              <span className={`text-xs ${TOKEN_BUDGET_COLORS[budgetLevel]}`}>
                {TOKEN_BUDGET_LABELS[budgetLevel]}
              </span>
              {tokenOpen ? <ChevronUp size={12} className="text-text-muted" /> : <ChevronDown size={12} className="text-text-muted" />}
            </div>
          </button>

          {/* Budget bar */}
          <div className="w-full h-1.5 bg-bg-tertiary rounded-full overflow-hidden mb-1">
            <div
              className={`h-full rounded-full transition-all duration-300 ${TOKEN_BUDGET_BAR_COLORS[budgetLevel]}`}
              style={{ width: `${barPct}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-text-muted mb-2">
            <span>0</span>
            <span>1k</span>
            <span>2k</span>
            <span>3k+ limit</span>
          </div>

          {tokenOpen && (
            <div className="space-y-1 mt-3">
              {(
                [
                  ["Description", tokenBreakdown.description],
                  ["Personality", tokenBreakdown.personality],
                  ["Scenario", tokenBreakdown.scenario],
                  ["First Message", tokenBreakdown.first_mes],
                  ["Example Dialogs", tokenBreakdown.mes_example],
                  ["System Prompt", tokenBreakdown.system_prompt],
                  ["Post-History", tokenBreakdown.post_history_instructions],
                  ["Alt. Greetings", tokenBreakdown.alternate_greetings],
                  ["Creator Notes", tokenBreakdown.creator_notes],
                ] as [string, number][]
              )
                .filter(([, v]) => v > 0)
                .map(([label, count]) => (
                  <div key={label} className="flex items-center gap-2 text-xs">
                    <span className="text-text-muted w-28 shrink-0">{label}</span>
                    <div className="flex-1 h-1 bg-bg-tertiary rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${TOKEN_BUDGET_BAR_COLORS[getTokenBudgetLevel(count)]}`}
                        style={{ width: `${Math.min((count / tokenBreakdown.total) * 100, 100)}%` }}
                      />
                    </div>
                    <span className="text-text-primary font-medium w-10 text-right">{count}</span>
                  </div>
                ))}
              {tokenBreakdown.total === 0 && (
                <p className="text-xs text-text-muted italic">No content yet.</p>
              )}
            </div>
          )}

          {budgetLevel === "over" && (
            <p className="text-xs text-status-danger mt-2">
              Over 3,000 tokens — some platforms may truncate or ignore part of this card.
            </p>
          )}
        </div>

        {/* Target Platform */}
        <div className="p-4 border-b border-border">
          <p className="section-title">Target Platform</p>
          <PlatformSelector selected={targetPlatform} onChange={onPlatformChange} compact />

          {/* Compatibility summary */}
          <button
            onClick={() => setCompatOpen(!compatOpen)}
            aria-expanded={compatOpen}
            className={`w-full mt-3 flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
              lossCount > 0
                ? "border-status-danger-border bg-status-danger-soft text-status-danger"
                : partialCount > 0
                ? "border-status-warn-border bg-status-warn-soft text-status-warn"
                : "border-status-ok-border bg-status-ok-soft text-status-ok"
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
              <div key={i} className="flex items-start gap-2 text-xs text-status-danger mb-1">
                <span className="shrink-0">✗</span><span>{err}</span>
              </div>
            ))}
            {validation.warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-status-warn mb-1">
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
              <label htmlFor={outputFileId} className="label-base">Output File</label>
              <div className="flex gap-1.5">
                <input
                  id={outputFileId}
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
          disabled={exporting}
          className="w-full btn-primary justify-center py-3 text-sm font-semibold"
        >
          <Download size={16} />
          {exporting ? "Exporting..." : platform.pngSupport ? `Export for ${platform.name}` : "Export PNG anyway"}
        </button>

        {!platform.pngSupport && (
          <div className="flex gap-2 p-2 rounded-md bg-status-warn-soft border border-status-warn-border">
            <AlertTriangle size={13} className="text-status-warn shrink-0 mt-0.5" />
            <p className="text-xs text-status-warn leading-relaxed">
              <strong>{platform.name} can't import PNG cards</strong> — it reads JSON only, so use Export JSON below for
              that site. The PNG still gets built correctly with your full card in a{" "}
              <code className="bg-white/60 px-1 rounded">{platform.metadataKey ?? FALLBACK_METADATA_KEY}</code>{" "}
              chunk, so it works anywhere that does read PNG cards, and it's a fine way to keep or share the card as a
              single image.
            </p>
          </div>
        )}

        {exportStatus && (
          <p
            role="status"
            aria-live="polite"
            className={`text-xs text-center ${exportStatus.ok ? "text-status-ok" : "text-status-danger"}`}
          >
            {exportStatus.msg}
          </p>
        )}

        {/* Save to Library / Update in Library */}
        <button
          onClick={handleSaveToLibrary}
          disabled={saving}
          className="w-full btn-secondary justify-center py-2 text-sm"
        >
          <BookMarked size={14} />
          {saving ? "Saving…" : project.id !== "default" ? "Update in Library" : "Save to Library"}
        </button>

        <button
          onClick={handleSaveAsTemplate}
          disabled={savingTemplate}
          className="w-full btn-secondary justify-center py-2 text-sm"
        >
          <LayoutTemplate size={14} />
          {savingTemplate ? "Saving…" : "Save as Template"}
        </button>

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

        {/* New Character */}
        {onNewCard && (
          <div className="border-t border-border pt-3 mt-1">
            <button
              onClick={onNewCard}
              className="w-full flex items-center justify-center gap-2 text-xs py-2 rounded-lg border border-dashed border-border text-text-muted hover:border-status-danger-border hover:text-status-danger transition-colors"
            >
              <FilePlus size={13} /> New Character
            </button>
          </div>
        )}
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

