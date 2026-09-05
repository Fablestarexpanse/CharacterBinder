import { describe, it, expect } from "vitest";
import { uniqueArchiveName } from "./archive";

describe("uniqueArchiveName", () => {
  it("disambiguates two cards with the same name", () => {
    const used = new Set<string>();
    expect(uniqueArchiveName("Rook", "id-1", used)).toBe("Rook");
    expect(uniqueArchiveName("Rook", "id-2", used)).toBe("Rook (2)");
    expect(uniqueArchiveName("Rook", "id-3", used)).toBe("Rook (3)");
  });

  it("falls back to the card id when the name survives no filtering", () => {
    expect(uniqueArchiveName("///", "id-9", new Set())).toBe("id-9");
    expect(uniqueArchiveName("", "id-9", new Set())).toBe("id-9");
  });

  it("strips path separators and punctuation, so a name cannot escape cards/", () => {
    expect(uniqueArchiveName("Rook/../etc passwd", "id-1", new Set())).toBe("Rooketc passwd");
  });

  it("cannot be made to collide with its own disambiguation suffix", () => {
    // Parentheses are stripped from card names, so a user typing "Rook (2)"
    // lands on "Rook 2" and never occupies the name the loop would generate.
    const used = new Set<string>();
    expect(uniqueArchiveName("Rook (2)", "id-1", used)).toBe("Rook 2");
    expect(uniqueArchiveName("Rook", "id-2", used)).toBe("Rook");
    expect(uniqueArchiveName("Rook", "id-3", used)).toBe("Rook (2)");
  });
});
