import type { ReactNode } from "react";
import { Download, FileJson, Save } from "lucide-react";
import type { DataCardType } from "../../types";
import type { DataCardEditor } from "../../hooks/useDataCardEditor";
import ImageDropzone from "../ui/ImageDropzone";
import ConfirmClearPanel from "../ui/ConfirmClearPanel";

/**
 * The whole right-hand column of the four non-character editors: cover image,
 * output settings, save, the two exports, and whatever the kind adds of its
 * own.
 *
 * Consolidating the editors stopped at the hook, so each of the four threaded
 * a dozen of the hook's own fields into this by hand. The editor is passed
 * whole instead — every field below comes from it, so nothing has to be
 * forwarded, renamed, or kept in step with the hook's surface.
 */

interface DataCardExportAsideProps<T extends DataCardType> {
  editor: DataCardEditor<T>;
  /** Also the metadata key the card is embedded under. */
  cardType: T;
  /** Noun used on the clear button, e.g. "Scenario Card". */
  label: string;
  /** What the image is called for this kind — "Avatar Image", "Scene Image". */
  imageLabel: string;
  /** What the two formats mean for this kind. */
  footnotes: ReactNode;
  /** Anything above Output Settings — a token meter, say. */
  children?: ReactNode;
  /** Extra rows inside Output Settings, e.g. a lorebook's entry count. */
  outputExtras?: ReactNode;
  /** A block between Output Settings and Save, e.g. a lorebook's own settings. */
  belowOutput?: ReactNode;
  /**
   * Replaces the hook's own clear, for a kind that keeps state beside the card
   * — the lorebook editor also has to drop the entry it has selected.
   */
  onClear?: () => void;
}

export default function DataCardExportAside<T extends DataCardType>({
  editor, cardType, label, imageLabel, footnotes, children, outputExtras, belowOutput, onClear,
}: DataCardExportAsideProps<T>) {
  const { card, update, status } = editor;

  return (
    <aside className="w-64 border-l border-border bg-bg-secondary flex flex-col shrink-0 p-4 gap-3">
      <p className="section-title">Export</p>

      <ImageDropzone label={imageLabel} imageSrc={editor.imageSrc} onFile={editor.setImageSrc} />

      {children}

      <div className="border-t border-border pt-3 space-y-2">
        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Output Settings</p>
        <div>
          <label className="label-base" htmlFor={`${cardType}-output-file`}>Output File</label>
          <input
            id={`${cardType}-output-file`}
            className="input-base text-xs"
            value={editor.outputFileName}
            onChange={(e) => editor.setOutputFileName(e.target.value)}
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
            value={card.version}
            onChange={(e) => update({ version: e.target.value } as Partial<typeof card>)}
          />
        </div>
        {outputExtras}
      </div>

      {belowOutput}

      <div className="border-t border-border pt-3 space-y-2">
        <button onClick={editor.save} disabled={editor.saving} className="btn-primary w-full justify-center py-2.5">
          <Save size={14} /> {editor.saving ? "Saving…" : editor.libraryId ? "Update in Library" : "Save to Library"}
        </button>
        <ConfirmClearPanel label={label} onConfirm={onClear ?? editor.clear} />
      </div>

      <div className="space-y-2">
        <button onClick={editor.exportJson} className="btn-secondary w-full justify-center py-2">
          <FileJson size={14} /> Export JSON
        </button>
        <button onClick={editor.exportPng} className="btn-secondary w-full justify-center py-2">
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
    </aside>
  );
}
