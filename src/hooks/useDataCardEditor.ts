import { useCallback, useEffect, useMemo, useState } from "react";
import type { DataCardType, RawCardFor } from "../types";
import { saveCardInput, saveLibraryCard } from "../lib/library";
import { encodeCharaToPng } from "../lib/pngMetadata";
import { getCarrierPng } from "../lib/carrierImage";
import { downloadJson, downloadPng } from "../lib/download";
import { useStatusMessage } from "./useStatusMessage";
import { useUnsavedWarning } from "./useUnsavedWarning";
import { errorMessage } from "../shared/errorMessage";

/**
 * The shell every non-character editor needs: the card being edited, its cover
 * image, its library identity, the filename derived from its name, and the
 * save/export/clear actions.
 *
 * The four editors each carried their own copy of this — six useStates, the
 * same filename effect, and three handlers differing only in the card kind and
 * the word in the status message. A fix to one (an export that reports its
 * error, a save that keeps the original createdAt) had to be made four times,
 * and in practice was not.
 */

export interface DataCardEditor<T extends DataCardType> {
  card: RawCardFor<T>;
  /** Merge a patch into the card. */
  update: (patch: Partial<RawCardFor<T>>) => void;
  /** Replace the card wholesale — importing a file, or a smart-import result. */
  setCard: (card: RawCardFor<T>) => void;
  imageSrc: string | null;
  setImageSrc: (src: string | null) => void;
  /** Set once the card is in the library; drives "Save" vs "Update". */
  libraryId: string | undefined;
  saving: boolean;
  status: ReturnType<typeof useStatusMessage>["status"];
  setMsg: ReturnType<typeof useStatusMessage>["setMsg"];
  outputFileName: string;
  setOutputFileName: (name: string) => void;
  save: () => Promise<void>;
  exportJson: () => void;
  exportPng: () => Promise<void>;
  clear: () => void;
}

interface Options<T extends DataCardType> {
  cardType: T;
  /** A fresh empty card, used for a new card and for "clear". */
  blank: () => RawCardFor<T>;
  initialCard?: RawCardFor<T>;
  initialImageSrc?: string | null;
  initialLibraryId?: string;
  /**
   * What gets written to a .json or PNG file, when that differs from what the
   * editor holds — lorebooks export in SillyTavern's positional format.
   */
  toExport?: (card: RawCardFor<T>) => unknown;
  /** Library tags for this card, when they aren't the card's own `tags`. */
  tagsOf?: (card: RawCardFor<T>) => string[];
}

/** "Mira's Lab" → "Mira's_Lab_scenario.png"; empty → "scenario.png". */
function fileNameFor(name: string, cardType: string): string {
  const trimmed = name.trim();
  return trimmed ? `${trimmed.replace(/\s+/g, "_")}_${cardType}.png` : `${cardType}.png`;
}

export function useDataCardEditor<T extends DataCardType>(opts: Options<T>): DataCardEditor<T> {
  const { cardType, blank, toExport, tagsOf } = opts;
  const [card, setCard] = useState<RawCardFor<T>>(opts.initialCard ?? blank);
  const [imageSrc, setImageSrc] = useState<string | null>(opts.initialImageSrc ?? null);
  const [libraryId, setLibraryId] = useState<string | undefined>(opts.initialLibraryId);
  const [saving, setSaving] = useState(false);
  const [savedVersion, setSavedVersion] = useState(opts.initialCard?.version ?? "1.0");
  const [outputFileName, setFileName] = useState(() =>
    fileNameFor(opts.initialCard?.name ?? "", cardType)
  );
  // Once the user names the file themselves, stop deriving it from the card
  // name — otherwise the next keystroke in the Name field throws their filename
  // away. The character editor has guarded this since it was reported there.
  const [fileNameTouched, setFileNameTouched] = useState(false);
  const { status, setMsg } = useStatusMessage();

  // Keep the filename in step with the card's name, until the user edits it.
  useEffect(() => {
    if (fileNameTouched) return;
    setFileName(fileNameFor(card.name, cardType));
  }, [card.name, cardType, fileNameTouched]);

  const setOutputFileName = useCallback((name: string) => {
    setFileNameTouched(true);
    setFileName(name);
  }, []);

  // Whatever is in an editor is plain React state until it is saved or
  // exported. The character editor warned before the tab closed on unsaved
  // work; these four held exactly the same kind of state and did not.
  const dirty = useMemo(() => {
    if (libraryId) return false; // already in the library
    const empty = blank() as unknown as Record<string, unknown>;
    return Object.entries(card as unknown as Record<string, unknown>).some(([key, value]) => {
      const initial = empty[key];
      if (typeof value === "string") return value.trim() !== String(initial ?? "").trim();
      if (Array.isArray(value)) return value.length !== (Array.isArray(initial) ? initial.length : 0);
      return false;
    });
  }, [card, libraryId, blank]);
  useUnsavedWarning(dirty);

  const update = useCallback((patch: Partial<RawCardFor<T>>) => {
    setCard((c) => ({ ...c, ...patch }));
  }, []);

  const clear = useCallback(() => {
    setCard(blank());
    setImageSrc(null);
    setLibraryId(undefined);
    setSavedVersion("1.0");
    setFileName(fileNameFor("", cardType));
    setFileNameTouched(false);
  }, [blank, cardType]);

  const payload = useCallback(() => (toExport ? toExport(card) : card), [card, toExport]);

  const exportJson = useCallback(() => {
    downloadJson(payload(), outputFileName);
    setMsg("JSON exported!", true);
  }, [payload, outputFileName, setMsg]);

  const exportPng = useCallback(async () => {
    try {
      const pngBytes = await getCarrierPng(imageSrc);
      downloadPng(encodeCharaToPng(pngBytes, JSON.stringify(payload()), cardType, false), outputFileName);
      setMsg("PNG exported!", true);
    } catch (err) {
      setMsg(`PNG export failed: ${errorMessage(err)}`, false);
    }
  }, [imageSrc, payload, cardType, outputFileName, setMsg]);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      // A changed version means "keep the old one too": save without the id so
      // the library gains a second record rather than overwriting the first.
      const versionChanged = !!libraryId && card.version.trim() !== savedVersion;
      const common = {
        imageSrc,
        tags: tagsOf ? tagsOf(card) : (card as { tags?: string[] }).tags ?? [],
        existingId: versionChanged ? undefined : libraryId,
      };

      // saveCardInput proves the kind and the body match; a mismatch here is a
      // compile error rather than a card stored under the wrong type.
      const saved = await saveLibraryCard(saveCardInput(cardType, card, common));
      setLibraryId(saved.id);
      setSavedVersion(card.version);
      setMsg(versionChanged ? "Saved as new version!" : libraryId ? "Library updated!" : "Saved to library!", true);
    } catch (err) {
      // The message matters: a save fails on quota, a blocked upgrade, or
      // private-mode storage, and "Failed to save" tells the user none of it.
      setMsg(`Failed to save to library: ${errorMessage(err)}`, false);
    }
    setSaving(false);
  }, [card, cardType, imageSrc, libraryId, savedVersion, tagsOf, setMsg]);

  return {
    card, update, setCard, imageSrc, setImageSrc, libraryId, saving,
    status, setMsg, outputFileName, setOutputFileName,
    save, exportJson, exportPng, clear,
  };
}
