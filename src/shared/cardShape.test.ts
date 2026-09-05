import { describe, it, expect } from "vitest";
import { detectCardShape, shapeForKey, effectiveShape } from "./cardShape";

describe("shapeForKey", () => {
  it("maps every character keyword", () => {
    for (const k of ["chara", "character", "tavern", "tavern_card_v2"]) {
      expect(shapeForKey(k)).toBe("character");
    }
  });

  it("maps the dedicated keys", () => {
    expect(shapeForKey("lorebook")).toBe("lorebook");
    expect(shapeForKey("script")).toBe("script");
    expect(shapeForKey("scenario")).toBe("scenario");
    expect(shapeForKey("persona")).toBe("persona");
  });

  it("returns null for anything else", () => {
    expect(shapeForKey("comment")).toBeNull();
  });
});

describe("detectCardShape", () => {
  it("trusts an explicit spec", () => {
    expect(detectCardShape({ spec: "persona_card_v1", name: "M" })).toBe("persona");
    expect(detectCardShape({ spec: "script_card_v1", name: "S" })).toBe("script");
    expect(detectCardShape({ spec: "scenario_card_v1", name: "Sc" })).toBe("scenario");
    expect(detectCardShape({ spec: "chara_card_v2", data: { name: "C" } })).toBe("character");
  });

  it("recognises a lorebook by its entries, whatever the wrapper says", () => {
    // The case that mattered: a lorebook exported under the `chara` keyword.
    // Trusting the keyword rebuilt it as a blank character card and threw the
    // entries away, behind a green success message.
    const lorebook = { name: "Anvale", entries: [{ keys: ["docks"], content: "Built on stilts." }] };
    expect(detectCardShape(lorebook)).toBe("lorebook");
    expect(shapeForKey("chara")).toBe("character"); // …so the two disagree, and shape must win
  });

  it("handles the object-keyed lorebook variant", () => {
    expect(detectCardShape({ entries: { "0": { keys: ["a"], content: "b" } } })).toBe("lorebook");
  });

  it("recognises a character card by its data block or greeting", () => {
    expect(detectCardShape({ data: { name: "Rook" } })).toBe("character");
    expect(detectCardShape({ name: "Rook", first_mes: "Hi." })).toBe("character");
    expect(detectCardShape({ name: "Rook", persona: "A dockhand." })).toBe("character");
  });

  it("recognises a persona by its own fields", () => {
    expect(detectCardShape({ name: "Mira", appearance: "Freckled." })).toBe("persona");
  });

  it("returns null when nothing distinguishes it", () => {
    expect(detectCardShape({ name: "Ambiguous" })).toBeNull();
    expect(detectCardShape(null)).toBeNull();
    expect(detectCardShape([1, 2, 3])).toBeNull();
    expect(detectCardShape("a string")).toBeNull();
  });
});

describe("effectiveShape", () => {
  it("trusts the payload when the keyword disagrees", () => {
    const r = effectiveShape("chara", { entries: [{ keys: ["a"], content: "b" }] });
    expect(r.shape).toBe("lorebook");
    expect(r.claimed).toBe("character");
    expect(r.mismatch).toBe(true);
  });

  it("reports no mismatch when they agree", () => {
    const r = effectiveShape("persona", { spec: "persona_card_v1", name: "M" });
    expect(r.shape).toBe("persona");
    expect(r.mismatch).toBe(false);
  });

  it("falls back to the keyword when the payload says nothing", () => {
    const r = effectiveShape("script", { name: "S" });
    expect(r.shape).toBe("script");
    expect(r.actual).toBeNull();
    expect(r.mismatch).toBe(false);
  });

  it("is null for a keyword this app does not know", () => {
    expect(effectiveShape("comment", { hello: 1 }).shape).toBeNull();
  });
});
