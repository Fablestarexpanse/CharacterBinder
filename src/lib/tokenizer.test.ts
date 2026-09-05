import { describe, it, expect } from "vitest";
import { getCardTokenBreakdown, COUNTED_FIELDS, countTokens } from "./tokenizer";
import { createBlankTavernCard } from "./tavernCard";

function cardWith(fields: Partial<Record<string, unknown>>) {
  const card = createBlankTavernCard();
  return { ...card, data: { ...card.data, ...fields } };
}

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
