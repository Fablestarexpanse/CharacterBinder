import { describe, it, expect } from "vitest";
import { parseLorebook, toExportedLorebook } from "./index";
import { coerceCardBody } from "../blankCards";

describe("parseLorebook", () => {
  it("reads entries given as an object keyed by numeric strings", () => {
    const book = parseLorebook({ name: "B", entries: { "0": { content: "a" }, "1": { content: "b" } } });
    expect(book.entries.map((e) => e.content)).toEqual(["a", "b"]);
  });

  it("gives every entry a distinct string id, whatever the source used", () => {
    const book = parseLorebook({ entries: [{ id: 0, content: "a" }, { id: 1, content: "b" }] });
    const ids = book.entries.map((e) => e.id);
    expect(ids.every((id) => typeof id === "string")).toBe(true);
    expect(new Set(ids).size).toBe(2);
  });

  it("survives a payload that is not a lorebook at all", () => {
    expect(parseLorebook(null).entries).toEqual([]);
    expect(parseLorebook({ entries: "nonsense" }).entries).toEqual([]);
  });

  it("keeps field values through an export and back", () => {
    const book = parseLorebook({
      name: "World", scan_depth: 7, token_budget: 900, recursive_scanning: true,
      entries: [{ name: "E", keys: ["k"], content: "c", position: "after_char", priority: 3 }],
    });
    const back = parseLorebook(toExportedLorebook(book));
    expect(back.name).toBe("World");
    expect(back.scan_depth).toBe(7);
    expect(back.token_budget).toBe(900);
    expect(back.recursive_scanning).toBe(true);
    expect(back.entries[0]).toMatchObject({ name: "E", keys: ["k"], content: "c", position: "after_char", priority: 3 });
  });

  it("numbers exported entries by position", () => {
    const book = parseLorebook({ entries: [{ content: "a" }, { content: "b" }, { content: "c" }] });
    expect(toExportedLorebook(book).entries.map((e) => e.id)).toEqual([0, 1, 2]);
  });
});

describe("coerceCardBody", () => {
  it("drops keys the card type does not have", () => {
    const card = coerceCardBody("script", { name: "S", content: "x", evil: "payload" });
    expect(card).not.toHaveProperty("evil");
    expect(card.name).toBe("S");
    expect(card.content).toBe("x");
  });

  it("drops values of the wrong type rather than storing them", () => {
    const card = coerceCardBody("persona", { name: 42, tags: ["a", 7], personality: "calm" });
    expect(card.name).toBe("");
    expect(card.tags).toEqual(["a"]);
    expect(card.personality).toBe("calm");
  });

  it("will not let a body rewrite the spec that identifies the kind", () => {
    const card = coerceCardBody("scenario", { spec: "persona_card_v1" });
    expect(card.spec).toBe("scenario_card_v1");
  });

  it("normalises a lorebook body through the lorebook parser", () => {
    const book = coerceCardBody("lorebook", { entries: [{ content: "a" }] });
    expect(book.entries).toHaveLength(1);
    expect(typeof book.entries[0].id).toBe("string");
  });
});
