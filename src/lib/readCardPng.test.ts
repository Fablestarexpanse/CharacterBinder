import { describe, it, expect } from "vitest";
import { readCardPng } from "./readCardPng";
import { encodeCharaToPng } from "./pngMetadata";
import { MINIMAL_PNG } from "./minimalPng";
import { createBlankTavernCard } from "../shared/tavernCard";

const png = (key: Parameters<typeof encodeCharaToPng>[2], payload: unknown) =>
  encodeCharaToPng(MINIMAL_PNG, JSON.stringify(payload), key, false);

describe("readCardPng", () => {
  it("reports a file that is not a PNG at all", () => {
    expect(readCardPng(new Uint8Array([1, 2, 3, 4])).kind).toBe("not-png");
  });

  it("reports a PNG carrying no card", () => {
    const result = readCardPng(MINIMAL_PNG);
    expect(result.kind).toBe("no-card");
  });

  it("tells a damaged card apart from a missing one", () => {
    // A card chunk whose payload is not JSON: present, but unreadable.
    const bytes = encodeCharaToPng(MINIMAL_PNG, "{ truncated", "chara", false);
    const result = readCardPng(bytes);
    expect(result.kind).toBe("damaged");
    if (result.kind === "damaged") expect(result.corruptKey).toBe("chara");
  });

  it("returns the card, its shape and its cover image", () => {
    const card = createBlankTavernCard("Rook");
    const result = readCardPng(png("chara", card));

    expect(result.kind).toBe("card");
    if (result.kind !== "card") return;
    expect(result.cardType).toBe("character");
    expect(result.mismatch).toBe(false);
    expect((result.parsed as typeof card).data.name).toBe("Rook");
    expect(result.imageSrc.startsWith("data:image/png;base64,")).toBe(true);
    expect(result.chunks.length).toBeGreaterThan(0);
  });

  it("flags a payload whose shape contradicts its keyword", () => {
    const result = readCardPng(png("chara", { entries: [{ keys: ["dock"], content: "x" }] }));

    expect(result.kind).toBe("card");
    if (result.kind !== "card") return;
    // The payload wins: this is the case that used to import as a blank card.
    expect(result.cardType).toBe("lorebook");
    expect(result.mismatch).toBe(true);
    expect(result.key).toBe("chara");
  });
});
