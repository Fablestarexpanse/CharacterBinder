// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import JSZip from "jszip";
import { exportCardsAsZip } from "./archive";
import { createBlankTavernCard } from "../shared/tavernCard";
import { blankPersonaCard } from "./blankCards";
import type { LibraryCard } from "../types";

/** The archive is the app's only backup route, so what it contains matters. */

let written: { blob: Blob; filename: string } | null = null;
vi.mock("./download", () => ({
  downloadBlob: (blob: Blob, filename: string) => void (written = { blob, filename }),
}));

const base = { imageSrc: null, createdAt: Date.UTC(2026, 0, 2), updatedAt: Date.UTC(2026, 0, 3), platform: "sillytavern" };
const character = (id: string, name: string, pngData: Uint8Array | null = null): LibraryCard => ({
  ...base, id, name, cardType: "character", cardData: createBlankTavernCard(name), pngData, tags: ["harbour"],
});
const persona = (id: string, name: string): LibraryCard => ({
  ...base, id, name, cardType: "persona", rawData: { ...blankPersonaCard(), name }, pngData: null, platform: "persona", tags: [],
});

async function entries(): Promise<{ names: string[]; manifest: Record<string, unknown>[] }> {
  const zip = await JSZip.loadAsync(await written!.blob.arrayBuffer());
  const names = Object.keys(zip.files).sort();
  const manifest = JSON.parse(await zip.file("manifest.json")!.async("string"));
  return { names, manifest };
}

beforeEach(() => {
  written = null;
  vi.clearAllMocks();
});

describe("exportCardsAsZip", () => {
  it("writes a PNG for a card that has one and JSON for a card that does not", async () => {
    await exportCardsAsZip([character("c1", "Rook", new Uint8Array([1, 2, 3])), persona("p1", "Kael")]);

    const { names } = await entries();
    expect(names).toContain("cards/Rook.png");
    expect(names).toContain("cards/Kael.json");
  });

  it("keeps both cards when two share a name, instead of one overwriting the other", async () => {
    await exportCardsAsZip([character("c1", "Rook"), character("c2", "Rook")]);

    const { names, manifest } = await entries();
    expect(names).toContain("cards/Rook.json");
    expect(names).toContain("cards/Rook (2).json");
    // The manifest has to point at the files that were actually written.
    expect(manifest.map((m) => m.file).sort()).toEqual(["cards/Rook (2).json", "cards/Rook.json"]);
  });

  it("describes every card in the manifest", async () => {
    await exportCardsAsZip([character("c1", "Rook")]);

    const { manifest } = await entries();
    expect(manifest[0]).toMatchObject({
      id: "c1",
      name: "Rook",
      cardType: "character",
      platform: "sillytavern",
      tags: ["harbour"],
      file: "cards/Rook.json",
    });
    // Timestamps are stored as epoch millis and written as ISO strings.
    expect(manifest[0].createdAt).toBe(new Date(base.createdAt).toISOString());
  });

  it("names the archive after the day it was made", async () => {
    await exportCardsAsZip([character("c1", "Rook")]);
    expect(written!.filename).toMatch(/^CharacterBinder_Archive_\d{4}-\d{2}-\d{2}\.zip$/);
  });

  it("writes an empty archive rather than failing when there is nothing to export", async () => {
    await exportCardsAsZip([]);
    const { names, manifest } = await entries();
    expect(manifest).toEqual([]);
    expect(names).toEqual(["manifest.json"]);
  });
});
