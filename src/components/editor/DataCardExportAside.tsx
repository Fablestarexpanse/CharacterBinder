import type { ReactNode } from "react";
import type { DataCardType } from "../../types";
import type { DataCardEditor } from "../../hooks/useDataCardEditor";
import ImageDropzone from "../ui/ImageDropzone";
import CardExportPanel from "./CardExportPanel";

/**
 * The whole right-hand column of the four non-character editors: cover image,
 * whatever the kind adds of its own, and the export panel.
 *
 * Consolidating the editors stopped at the hook, so each of the four still
 * threaded twelve of the hook's own fields into CardExportPanel by hand — the
 * same twelve lines, four times, all of which had to change together whenever
 * the hook's surface did. The editor is passed whole instead.
 */

interface DataCardExportAsideProps<T extends DataCardType> {
  editor: DataCardEditor<T>;
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
  return (
    <aside className="w-64 border-l border-border bg-bg-secondary flex flex-col shrink-0 p-4 gap-3">
      <p className="section-title">Export</p>

      <ImageDropzone label={imageLabel} imageSrc={editor.imageSrc} onFile={editor.setImageSrc} />

      {children}

      <CardExportPanel
        cardType={cardType}
        label={label}
        outputFileName={editor.outputFileName}
        onOutputFileNameChange={editor.setOutputFileName}
        version={editor.card.version}
        onVersionChange={(version) => editor.update({ version } as Partial<typeof editor.card>)}
        saving={editor.saving}
        libraryId={editor.libraryId}
        onSave={editor.save}
        onExportJson={editor.exportJson}
        onExportPng={editor.exportPng}
        onClear={onClear ?? editor.clear}
        status={editor.status}
        footnotes={footnotes}
        outputExtras={outputExtras}
        belowOutput={belowOutput}
      />
    </aside>
  );
}
