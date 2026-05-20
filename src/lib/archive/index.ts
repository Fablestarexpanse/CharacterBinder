import JSZip from "jszip";
import type { LibraryCard } from "../../types";

export async function exportCardsAsZip(cards: LibraryCard[]): Promise<void> {
  const zip = new JSZip();
  const manifest: object[] = [];

  for (const card of cards) {
    const safeName = card.name.replace(/[^a-zA-Z0-9_\-\s]/g, "").trim() || card.id;

    if (card.pngData) {
      zip.file(`cards/${safeName}.png`, card.pngData);
    } else {
      const json = JSON.stringify(card.cardData, null, 2);
      zip.file(`cards/${safeName}.json`, json);
    }

    manifest.push({
      id: card.id,
      name: card.name,
      platform: card.platform,
      tags: card.tags,
      createdAt: new Date(card.createdAt).toISOString(),
      updatedAt: new Date(card.updatedAt).toISOString(),
      file: card.pngData ? `cards/${safeName}.png` : `cards/${safeName}.json`,
    });
  }

  zip.file("manifest.json", JSON.stringify(manifest, null, 2));

  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `CharacterBinder_Archive_${new Date().toISOString().slice(0, 10)}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}
