import { describe, it, expect } from "vitest";
import { convertCardTo, convertCardFrom } from "./converters";
import { PLATFORMS, type PlatformId } from "./index";
import { createBlankTavernCard } from "../tavernCard";
import { validateTavernCardV2 } from "../validators";
import type { TavernCardV2 } from "../../types";

/**
 * These converters decide which of the user's fields survive an export, and the
 * same support table drives the "fields lost" count shown in the UI — so a
 * mismatch between the two doesn't just lose data, it lies about losing it.
 */

function fullCard(): TavernCardV2 {
  const card = createBlankTavernCard("Rook");
  card.data = {
    ...card.data,
    description: "A dockhand who notices too much.",
    personality: "Curt but not unkind.",
    scenario: "{{char}} waits on a rain-soaked rooftop.",
    first_mes: "{{char}} doesn't look up. \"You're late.\"",
    mes_example: "{{user}}: Why here?\n{{char}}: Nobody looks up.",
    system_prompt: "Stay terse.",
    post_history_instructions: "Never break character.",
    alternate_greetings: ["Still here, then.", "Took your time."],
    tags: ["dockhand", "noir"],
    creator: "Fablestar",
    creator_notes: "Pairs well with the Anvale lorebook.",
    character_version: "2.5",
  };
  return card;
}

const ALL: PlatformId[] = ["sillytavern", "janitorai", "chub", "agnai", "venus", "backyard", "risu", "generic"];

describe("export never throws", () => {
  it.each(ALL)("converts a full card to %s", (platform) => {
    expect(() => convertCardTo(fullCard(), platform)).not.toThrow();
  });

  it.each(ALL)("converts a *slim* v2 card to %s", (platform) => {
    // Regression: convertCardFrom's v2 fast path returned the object unchanged,
    // so a third-party card with a partial data block produced undefined string
    // fields and the next converter threw "Cannot read properties of undefined".
    const slim = convertCardFrom(
      { spec: "chara_card_v2", spec_version: "2.0", data: { name: "Rook", personality: "P" } },
      "sillytavern"
    );
    expect(() => convertCardTo(slim, platform)).not.toThrow();
  });
});

describe("convertCardFrom normalises", () => {
  it("fills every required field from a partial v2 card", () => {
    const card = convertCardFrom(
      { spec: "chara_card_v2", spec_version: "2.0", data: { name: "Rook" } },
      "sillytavern"
    );
    // Whatever comes back must be safe to hand to any converter or the UI.
    for (const key of ["description", "personality", "scenario", "first_mes", "mes_example"] as const) {
      expect(typeof card.data[key]).toBe("string");
    }
    expect(Array.isArray(card.data.tags)).toBe(true);
    expect(Array.isArray(card.data.alternate_greetings)).toBe(true);
  });
});

describe("the support table matches what is actually written", () => {
  // A field the table calls "full", "partial" or "renamed" must appear in the
  // exported payload somewhere. Only "none" may be absent.
  /**
   * Compare on content, not on exact bytes: JSON.stringify escapes newlines,
   * and some platforms deliberately rewrite {{char}} to their own placeholder.
   * Neither is data loss, so neither should fail this check.
   */
  const normalise = (s: string) =>
    s
      .replace(/\\n/g, " ")
      .replace(/\{\{(char|bot|user)\}\}/g, "")
      .replace(/[\\"]/g, "") // JSON escaping of embedded quotes
      .replace(/\s+/g, " ")
      .trim();

  it.each(ALL)("%s writes every field it claims to keep", (platformId) => {
    const platform = PLATFORMS[platformId];
    const out = normalise(JSON.stringify(convertCardTo(fullCard(), platformId)));

    const claimed = platform.fields.filter((f) => f.support !== "none");
    const missing = claimed.filter((f) => {
      const value = fullCard().data[f.field];
      if (typeof value === "string") {
        const needle = normalise(value).slice(0, 24);
        return needle.length > 3 && !out.includes(needle);
      }
      if (Array.isArray(value)) {
        return value.length > 0 && !out.includes(normalise(String(value[0])));
      }
      return false;
    });

    expect(missing.map((m) => m.label)).toEqual([]);
  });
});

describe("round trips", () => {
  it("JanitorAI leaves no stale placeholders in either direction", () => {
    // Regression: {{char}}→{{bot}} was applied to some fields and not others,
    // so a round trip left literal {{bot}} sitting in the description.
    const exported = JSON.stringify(convertCardTo(fullCard(), "janitorai"));
    expect(exported).not.toContain("{{char}}");

    const back = convertCardFrom(JSON.parse(exported), "janitorai");
    const reimported = JSON.stringify(back.data);
    expect(reimported).not.toContain("{{bot}}");
  });

  it("Generic preserves character_version", () => {
    // Regression: export wrote `version`, import read neither `version` nor
    // `character_version`, so 2.5 came back as the default.
    const exported = convertCardTo(fullCard(), "generic") as Record<string, unknown>;
    const back = convertCardFrom(exported, "generic");
    expect(back.data.character_version).toBe("2.5");
  });

  it("SillyTavern is lossless", () => {
    const original = fullCard();
    const back = convertCardFrom(convertCardTo(original, "sillytavern") as Record<string, unknown>, "sillytavern");
    expect(back.data).toEqual(original.data);
  });

  it("does not alias the live card", () => {
    const original = fullCard();
    const exported = convertCardTo(original, "sillytavern") as unknown as TavernCardV2;
    exported.data.name = "Mutated";
    expect(original.data.name).toBe("Rook");
  });
});

describe("validator", () => {
  it("accepts a well-formed card", () => {
    const r = validateTavernCardV2(fullCard());
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it("does not throw on a card with no data block", () => {
    // Regression: this used to throw reading .name of undefined.
    const r = validateTavernCardV2({ spec: "chara_card_v2", spec_version: "2.0" } as never);
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/data/i);
  });

  it("rejects wrong types that used to pass", () => {
    const card = fullCard();
    (card.data as unknown as Record<string, unknown>).tags = "not-an-array";
    (card.data as unknown as Record<string, unknown>).alternate_greetings = "nope";
    const r = validateTavernCardV2(card);
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toContain("'tags' must be an array");
    expect(r.errors.join(" ")).toContain("'alternate_greetings' must be an array");
  });

  it("rejects a non-string in a string field", () => {
    const card = fullCard();
    (card.data as unknown as Record<string, unknown>).personality = 42;
    expect(validateTavernCardV2(card).errors.join(" ")).toContain("'personality' must be a string");
  });

  it("checks an attached lorebook", () => {
    const card = fullCard();
    card.data.character_book = { entries: [{ keys: "wharf", content: "x" }] } as never;
    const r = validateTavernCardV2(card);
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/keys' must be an array/);
  });

  it("warns about an entry that can never fire", () => {
    const card = fullCard();
    card.data.character_book = { entries: [{ keys: [], content: "x" }] } as never;
    const r = validateTavernCardV2(card);
    expect(r.warnings.join(" ")).toMatch(/no trigger keys/);
  });
});
