import { describe, it, expect, beforeAll } from "vitest";
import { getCardTokenBreakdown, COUNTED_FIELDS, countTokens, whenTokenizerReady } from "./tokenizer";
import { createBlankTavernCard } from "../shared/tavernCard";

function cardWith(fields: Partial<Record<string, unknown>>) {
  const card = createBlankTavernCard();
  return { ...card, data: { ...card.data, ...fields } };
}

// The BPE table is fetched lazily, so counts are approximate until it lands.
beforeAll(() => whenTokenizerReady());

describe("getCardTokenBreakdown", () => {
  it("totals every counted field plus the alternate greetings", () => {
    const text = "The quick brown fox jumps over the lazy dog.";
    const per = countTokens(text);
    const filled: Record<string, unknown> = { alternate_greetings: [text, text] };
    for (const f of COUNTED_FIELDS) filled[f] = text;

    const b = getCardTokenBreakdown(cardWith(filled));
    for (const f of COUNTED_FIELDS) expect(b[f]).toBe(per);
    expect(b.alternate_greetings).toBe(per * 2);
    expect(b.total).toBe(per * (COUNTED_FIELDS.length + 2));
  });

  it("is zero for a blank card", () => {
    expect(getCardTokenBreakdown(createBlankTavernCard()).total).toBe(0);
  });

  it("treats a missing alternate_greetings array as none", () => {
    const card = createBlankTavernCard();
    // A card read from an older export can simply not have the field.
    const withoutGreetings = { ...card, data: { ...card.data, alternate_greetings: undefined } };
    expect(getCardTokenBreakdown(withoutGreetings as unknown as typeof card).alternate_greetings).toBe(0);
  });
});

describe("lazy loading", () => {
  it("counts exactly once the table has loaded", async () => {
    await whenTokenizerReady();
    // 16 is cl100k's count for this sentence; the character estimate is 18.
    expect(countTokens("The quick brown fox jumps over the lazy dog, again and again and again.")).toBe(16);
  });

  it("is still zero for empty text", () => {
    expect(countTokens("")).toBe(0);
  });
});
