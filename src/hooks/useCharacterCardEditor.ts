import { useCallback, useEffect, useState } from "react";
import type { TavernCardV2, MetadataInfo, CardProject } from "../types";
import type { PlatformId } from "../shared/platforms/registry";
import { blankTemplate } from "../data/builtinTemplates";
import { useUnsavedWarning } from "./useUnsavedWarning";

/**
 * The character card's editor shell — the counterpart to useDataCardEditor for
 * the one kind that doesn't fit it. Character cards carry a nested v2 body, a
 * target platform and decode metadata, and their save/export lives in the
 * preview panel, so they keep their own hook rather than bending the other one.
 *
 * What the two do share is the shape of a shell: the card, its cover image, its
 * library identity, a filename derived from the name until the user types their
 * own, and a clear action. Holding this here keeps App to navigation and the
 * bridge.
 */

/** Output filename derived from the character name, e.g. "Mira Vale" → "Mira_Vale_Tavern_Card.png". */
export function defaultFileName(name: string): string {
  const trimmed = name.trim();
  return trimmed ? `${trimmed.replace(/\s+/g, "_")}_Tavern_Card.png` : "New_Character_Tavern_Card.png";
}

function freshProject(): CardProject {
  return {
    id: "default",
    card: blankTemplate,
    imageSrc: undefined,
    outputFileName: defaultFileName(""),
    lastModified: new Date().toISOString(),
    metadataInfo: undefined,
  };
}

export interface CharacterCardEditor {
  project: CardProject;
  targetPlatform: PlatformId;
  setTargetPlatform: (id: PlatformId) => void;
  /** Merge a patch into the card body. */
  updateCard: (updates: Partial<TavernCardV2["data"]>) => void;
  updateImage: (imageSrc: string) => void;
  updateOutputFileName: (name: string) => void;
  /** Replace the card from an import, a template or a decode. */
  loadCard: (card: TavernCardV2, imageSrc?: string, meta?: MetadataInfo, sourcePlatform?: PlatformId) => void;
  /** Replace the card from a library record, adopting its identity. */
  loadFromLibrary: (card: TavernCardV2, imageSrc: string | null, libraryId: string) => void;
  /** Take on a library id after the preview panel saves a new card. */
  adoptLibraryId: (id: string) => void;
  clear: () => void;
}

/**
 * @param onOpened called whenever a card is loaded, so the caller can navigate
 *   to the editor. The hook owns the card; it does not own the router.
 */
export function useCharacterCardEditor(onOpened: () => void): CharacterCardEditor {
  const [project, setProject] = useState<CardProject>(freshProject);
  const [targetPlatform, setTargetPlatform] = useState<PlatformId>("sillytavern");

  // Once the user edits the output filename themselves, stop deriving it from
  // the character name — otherwise the next keystroke in the Name field would
  // silently throw their filename away.
  const [fileNameTouched, setFileNameTouched] = useState(false);

  useEffect(() => {
    if (fileNameTouched) return;
    setProject((p) => ({ ...p, outputFileName: defaultFileName(p.card.data.name) }));
  }, [project.card.data.name, fileNameTouched]);

  // The editor holds plain React state until it is saved or exported, so closing
  // the tab mid-edit used to discard it silently. Only guard once there is
  // something worth losing.
  const hasUnsavedWork =
    project.id === "default" &&
    (!!project.card.data.name.trim() ||
      !!project.card.data.description.trim() ||
      !!project.card.data.personality.trim() ||
      !!project.card.data.first_mes.trim());
  useUnsavedWarning(hasUnsavedWork);

  const updateCard = useCallback((updates: Partial<TavernCardV2["data"]>) => {
    setProject((p) => ({
      ...p,
      card: { ...p.card, data: { ...p.card.data, ...updates } },
      lastModified: new Date().toISOString(),
    }));
  }, []);

  const loadCard = useCallback((
    card: TavernCardV2,
    imageSrc?: string,
    meta?: MetadataInfo,
    sourcePlatform?: PlatformId
  ) => {
    setProject((p) => ({
      ...p,
      card,
      imageSrc,
      outputFileName: defaultFileName(card.data.name),
      lastModified: new Date().toISOString(),
      metadataInfo: meta,
    }));
    setFileNameTouched(false);
    if (sourcePlatform) setTargetPlatform(sourcePlatform);
    onOpened();
  }, [onOpened]);

  const loadFromLibrary = useCallback((
    card: TavernCardV2,
    imageSrc: string | null,
    libraryId: string
  ) => {
    setProject((p) => ({
      ...p,
      id: libraryId,
      card,
      imageSrc: imageSrc ?? undefined,
      outputFileName: defaultFileName(card.data.name),
      lastModified: new Date().toISOString(),
      metadataInfo: undefined,
    }));
    setFileNameTouched(false);
    onOpened();
  }, [onOpened]);

  const adoptLibraryId = useCallback((id: string) => {
    setProject((p) => (p.id === id ? p : { ...p, id }));
  }, []);

  const updateImage = useCallback((imageSrc: string) => {
    setProject((p) => ({ ...p, imageSrc }));
  }, []);

  const updateOutputFileName = useCallback((name: string) => {
    setFileNameTouched(true);
    setProject((p) => ({ ...p, outputFileName: name }));
  }, []);

  const clear = useCallback(() => {
    setProject(freshProject());
    setFileNameTouched(false);
    setTargetPlatform("sillytavern");
    onOpened();
  }, [onOpened]);

  return {
    project, targetPlatform, setTargetPlatform,
    updateCard, updateImage, updateOutputFileName,
    loadCard, loadFromLibrary, adoptLibraryId, clear,
  };
}
