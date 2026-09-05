import { useCallback, useEffect, useState } from "react";
import type { AppSettings, CardProject } from "../types";
import type { PlatformId } from "../shared/platforms/registry";
import { PLATFORMS } from "../shared/platforms/registry";
import { convertCardTo } from "../shared/platforms/converters";
import { saveLibraryCard } from "../lib/library";
import { saveCustomTemplate } from "../lib/customTemplates";
import { encodeCharacterCardPng } from "../lib/characterCardPng";
import { downloadJson, downloadPng } from "../lib/download";
import { resolveSaveTarget } from "../lib/librarySave";
import { useStatusMessage } from "./useStatusMessage";
import { errorMessage } from "../shared/errorMessage";

/**
 * What a character card can be *done to*: exported, saved to the library, saved
 * as a template. The counterpart to the same actions on useDataCardEditor.
 *
 * These lived in CardPreviewPanel, which meant the panel that renders the card
 * also owned every write path for it — a component named for presentation
 * deciding when the library gains a record.
 */

export interface CharacterCardActions {
  exportPng: () => Promise<void>;
  exportJson: () => void;
  save: () => Promise<void>;
  saveAsTemplate: () => void;
  exporting: boolean;
  saving: boolean;
  status: ReturnType<typeof useStatusMessage>["status"];
  setStatus: ReturnType<typeof useStatusMessage>["setMsg"];
}

interface Options {
  project: CardProject;
  settings: AppSettings;
  targetPlatform: PlatformId;
  /** Whether the card passes validation, for the export gate. */
  valid: boolean;
  /** Adopt the id the library assigned, so the next save updates that record. */
  onSavedToLibrary?: (id: string) => void;
}

export function useCharacterCardActions({
  project, settings, targetPlatform, valid, onSavedToLibrary,
}: Options): CharacterCardActions {
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedVersion, setSavedVersion] = useState(project.card.data.character_version ?? "1.0");
  const { status, setMsg: setStatus } = useStatusMessage();
  const platform = PLATFORMS[targetPlatform];

  // Loading a different card from the library swaps `project` without
  // remounting, so the "has the version been bumped?" baseline has to follow it
  // — otherwise it keeps comparing against the previously-open card's version.
  const projectId = project.id;
  const openedVersion = project.card.data.character_version ?? "1.0";
  useEffect(() => {
    setSavedVersion(openedVersion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const exportPng = useCallback(async () => {
    // PNG export is never blocked. Platforms that can't read card PNGs still
    // produce a perfectly valid file — it just has to be imported somewhere
    // else, so the UI warns rather than refusing.
    if (settings.autoValidateBeforeExport && !valid) {
      setStatus("Fix validation errors before exporting.", false);
      return;
    }
    setExporting(true);
    try {
      const bytes = await encodeCharacterCardPng(project.card, project.imageSrc, targetPlatform, settings);
      downloadPng(bytes, project.outputFileName);
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
  }, [project, settings, valid, platform, targetPlatform, setStatus]);

  const exportJson = useCallback(() => {
    const converted = convertCardTo(project.card, targetPlatform);
    const name = project.outputFileName.replace(/\.png$/i, "") + `_${targetPlatform}`;
    downloadJson(converted, name, settings.prettyPrintJson);
    setStatus("JSON exported!", true);
  }, [project, settings, targetPlatform, setStatus]);

  const save = useCallback(async () => {
    setSaving(true);
    const currentVersion = project.card.data.character_version ?? "";
    const libraryId = project.id === "default" ? undefined : project.id;
    const target = resolveSaveTarget(libraryId, currentVersion, savedVersion);
    try {
      const pngData = await encodeCharacterCardPng(project.card, project.imageSrc, targetPlatform, settings);
      const saved = await saveLibraryCard({
        cardType: "character",
        body: project.card,
        pngData,
        imageSrc: project.imageSrc ?? null,
        platform: targetPlatform,
        existingId: target.existingId,
      });
      // Adopt the new id. Without this every save created another record, and a
      // version bump left the editor still pointing at the previous row — so the
      // next save overwrote the version the user had just preserved.
      onSavedToLibrary?.(saved.id);
      setSavedVersion(currentVersion);
      setStatus(target.message, true);
    } catch (err) {
      // The reason matters: a save fails on quota, a blocked upgrade, or
      // private-mode storage, and "Failed to save" tells the user none of it.
      setStatus(`Failed to save to library: ${errorMessage(err)}`, false);
    } finally {
      setSaving(false);
    }
  }, [project, targetPlatform, savedVersion, settings, onSavedToLibrary, setStatus]);

  // Synchronous: writing a template is one localStorage put, so there is no
  // in-flight state to show. Failure arrives through the status line.
  const saveAsTemplate = useCallback(() => {
    try {
      saveCustomTemplate(project.card);
      setStatus("Saved as template!", true);
    } catch (err) {
      setStatus(`Failed to save template: ${errorMessage(err)}`, false);
    }
  }, [project.card, setStatus]);

  return { exportPng, exportJson, save, saveAsTemplate, exporting, saving, status, setStatus };
}
