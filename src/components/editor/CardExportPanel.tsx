import type { ReactNode } from "react";
import { Download, FileJson, Save } from "lucide-react";
import type { DataCardType } from "../../types";
import type { StatusMessage } from "../../hooks/useStatusMessage";
import ConfirmClearPanel from "../ui/ConfirmClearPanel";

/**
 * The export sidebar shared by the four non-character editors: output filename,
 * version, save-or-update, clear, the two export buttons and the status line.
 *
 * Everything here is the same for every kind but the labels, so a change to the
 * save flow or the export wording lands in one place instead of four.
 */

interface CardExportPanelProps {
  /** Also the metadata key the card is embedded under. */
  cardType: DataCardType;
  /** Noun used on the clear button, e.g. "Scenario Card". */
  label: string;
  outputFileName: string;
  onOutputFileNameChange: (name: string) => void;
  version: string;
  onVersionChange: (version: string) => void;
  saving: boolean;
  /** Set once the card is in the library; switches Save to Update. */
  libraryId: string | undefined;
  onSave: () => void;
  onExportJson: () => void;
  onExportPng: () => void;
  onClear: () => void;
  status: StatusMessage | null;
  /** What the two formats mean for this kind, shown at the foot of the panel. */
  footnotes: ReactNode;
  /** Anything the kind adds above Output Settings — a token count, say. */
  children?: ReactNode;
  /** Extra rows inside Output Settings, e.g. a lorebook's entry count. */
  outputExtras?: ReactNode;
  /** A block between Output Settings and Save, e.g. a lorebook's own settings. */
  belowOutput?: ReactNode;
}

export default function CardExportPanel({
  cardType,
  label,
  outputFileName,
  onOutputFileNameChange,
  version,
  onVersionChange,
  saving,
  libraryId,
  onSave,
  onExportJson,
  onExportPng,
  onClear,
  status,
  footnotes,
  children,
  outputExtras,
  belowOutput,
}: CardExportPanelProps) {
  return (
    <>
      {children}

      <div className="border-t border-border pt-3 space-y-2">
        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Output Settings</p>
        <div>
          <label className="label-base" htmlFor={`${cardType}-output-file`}>Output File</label>
          <input
            id={`${cardType}-output-file`}
            className="input-base text-xs"
            value={outputFileName}
            onChange={(e) => onOutputFileNameChange(e.target.value)}
          />
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-text-muted">Metadata key</span>
          <code className="text-accent-purple-light bg-bg-tertiary px-1.5 py-0.5 rounded font-mono">{cardType}</code>
        </div>
        <div className="flex items-center justify-between text-xs">
          <label className="text-text-muted" htmlFor={`${cardType}-version`}>Version</label>
          <input
            id={`${cardType}-version`}
            className="input-base py-0.5 text-xs w-20 text-right"
            value={version}
            onChange={(e) => onVersionChange(e.target.value)}
          />
        </div>
        {outputExtras}
      </div>

      {belowOutput}

      <div className="border-t border-border pt-3 space-y-2">
        <button onClick={onSave} disabled={saving} className="btn-primary w-full justify-center py-2.5">
          <Save size={14} /> {saving ? "Saving…" : libraryId ? "Update in Library" : "Save to Library"}
        </button>
        <ConfirmClearPanel label={label} onConfirm={onClear} />
      </div>

      <div className="space-y-2">
        <button onClick={onExportJson} className="btn-secondary w-full justify-center py-2">
          <FileJson size={14} /> Export JSON
        </button>
        <button onClick={onExportPng} className="btn-secondary w-full justify-center py-2">
          <Download size={14} /> Embed in PNG
        </button>
      </div>

      {status && (
        <p
          role="status"
          aria-live="polite"
          className={`text-xs text-center ${status.ok ? "text-status-ok" : "text-status-danger"}`}
        >
          {status.msg}
        </p>
      )}

      <div className="border-t border-border pt-3 mt-auto text-xs text-text-muted space-y-1.5">{footnotes}</div>
    </>
  );
}
