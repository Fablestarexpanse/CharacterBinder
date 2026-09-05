import { describe, it, expect } from "vitest";
import { encodeCharacterCardPng, metadataKeyFor } from "./characterCardPng";
import { decodeCharaFromPng, isPng } from "./pngMetadata";
import { createBlankTavernCard } from "../shared/tavernCard";

/**
 * Export and library-save both build the card PNG through this, so what it
 * writes is what ends up in the user's file and in their archive.
 */

const card = () => {
  const c = createBlankTavernCard("Rook");
  c.data.description = "A dockhand of few words.";
  c.data.system_prompt = "Stay in character.";
  return c;
};

describe("encodeCharacterCardPng", () => {
  it("writes a valid PNG carrying the card under the platform's key", async () => {
    const bytes = await encodeCharacterCardPng(card(), null, "sillytavern", {
      prettyPrintJson: true,
      preserveUnknownChunks: true,
    });

    expect(isPng(bytes)).toBe(true);
    const { json, key } = decodeCharaFromPng(bytes);
    expect(key).toBe(metadataKeyFor("sillytavern"));
    expect(JSON.parse(json!).data.name).toBe("Rook");
  });

  it("converts for the target platform before embedding", async () => {
    const bytes = await encodeCharacterCardPng(card(), null, "janitorai", {
      prettyPrintJson: false,
      preserveUnknownChunks: true,
    });

    const { json } = decodeCharaFromPng(bytes);
    const payload = JSON.parse(json!);
    // JanitorAI's own field names, not Tavern's.
    expect(payload.persona ?? payload.description).toBeDefined();
    expect(payload.spec).toBeUndefined();
  });

  it("still writes an importable card for a platform that cannot read PNGs", async () => {
    const bytes = await encodeCharacterCardPng(card(), null, "janitorai", {
      prettyPrintJson: false,
      preserveUnknownChunks: true,
    });

    // Falls back to `chara` rather than refusing to build the file.
    expect(metadataKeyFor("janitorai")).toBe("chara");
    expect(decodeCharaFromPng(bytes).key).toBe("chara");
  });
});
