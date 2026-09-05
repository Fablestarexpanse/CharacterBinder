import type { LibraryCard } from "../types";
import { downloadBlob } from "./download";

/**
 * A filename for this card that no earlier card in the archive has taken.
 *
 * Card names are not unique, and JSZip silently overwrites on collision — so
 * two characters called "Rook" produced an archive containing one of them,
 * while the manifest listed both. A name made entirely of characters the filter
 * strips falls back to the card id, which is unique by construction.
 */
export function uniqueArchiveName(name: string, id: string, used: Set<string>): string {
  const base = name.replace(/[^a-zA-Z0-9_\-\s]/g, "").trim() || id;
  let safeName = base;
  for (let n = 2; used.has(safeName); n++) safeName = `${base} (${n})`;
  used.add(safeName);
  return safeName;
}

export async function exportCardsAsZip(cards: LibraryCard[]): Promise<void> {
  // Loaded here rather than at module scope: JSZip is a large dependency that
  // one button uses, and importing it at the top put it in the entry chunk
  // every visitor downloads.
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const manifest: object[] = [];

  const usedNames = new Set<string>();

  for (const card of cards) {
    const safeName = uniqueArchiveName(card.name, card.id, usedNames);

    if (card.pngData) {
      zip.file(`cards/${safeName}.png`, card.pngData);
    } else {
      // Use rawData for non-character cards; cardData for character cards
      const data = card.cardData ?? card.rawData;
      const json = JSON.stringify(data, null, 2);
      zip.file(`cards/${safeName}.json`, json);
    }

    manifest.push({
      id: card.id,
      name: card.name,
      cardType: card.cardType,
      platform: card.platform,
      tags: card.tags,
      createdAt: new Date(card.createdAt).toISOString(),
      updatedAt: new Date(card.updatedAt).toISOString(),
      file: card.pngData ? `cards/${safeName}.png` : `cards/${safeName}.json`,
    });
  }

  zip.file("manifest.json", JSON.stringify(manifest, null, 2));

  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  // Use the shared helper rather than a local copy: this used to click a
  // detached anchor (a no-op in Firefox) and revoke the object URL synchronously,
  // which can cancel a large archive mid-write.
  downloadBlob(blob, `CharacterBinder_Archive_${new Date().toISOString().slice(0, 10)}.zip`);
}
