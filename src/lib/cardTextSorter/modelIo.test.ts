import { describe, it, expect } from "vitest";
import { budgetInput, coerceJson } from "./modelIo";

describe("coerceJson", () => {
  it("reads a bare JSON object", () => {
    expect(coerceJson('{"name":"Kael"}')).toEqual({ name: "Kael" });
  });

  it("reads JSON out of a code fence", () => {
    expect(coerceJson('```json\n{"name":"Kael"}\n```')).toEqual({ name: "Kael" });
    expect(coerceJson('```\n{"name":"Kael"}\n```')).toEqual({ name: "Kael" });
  });

  it("reads JSON with prose on either side", () => {
    expect(coerceJson('Sure! Here you go:\n{"name":"Kael"}\nHope that helps.')).toEqual({ name: "Kael" });
  });

  it("salvages the object from an array wrapper, but not from an array of scalars", () => {
    // A model that wraps its answer in a list still meant the object inside it.
    expect(coerceJson('[{"name":"Kael"}]')).toEqual({ name: "Kael" });
    expect(coerceJson('["Kael","Mercer"]')).toBeNull();
  });

  it("returns null for a reply with no JSON in it at all", () => {
    expect(coerceJson("I'm sorry, I can't help with that.")).toBeNull();
    expect(coerceJson("")).toBeNull();
    expect(coerceJson("   ")).toBeNull();
  });

  it("returns null rather than a partial object when the JSON is truncated", () => {
    expect(coerceJson('{"name":"Kael", "descrip')).toBeNull();
  });
});

describe("budgetInput", () => {
  it("leaves text that fits untouched", () => {
    const text = "Kael is a physicist.\n\nHe drinks too much coffee.";
    expect(budgetInput(text)).toEqual({ text, truncated: false });
  });

  it("truncates text past the window and says so", () => {
    // Well past 4692 tokens (the 8192 window less the reserved output).
    const paragraph = "Kael studies resonance fields in the Anvale district. ".repeat(40);
    const long = Array.from({ length: 40 }, () => paragraph).join("\n\n");
    const result = budgetInput(long);
    expect(result.truncated).toBe(true);
    expect(result.text.length).toBeLessThan(long.length);
  });

  it("cuts at a paragraph edge rather than mid-sentence", () => {
    const paragraph = "Kael studies resonance fields in the Anvale district. ".repeat(40);
    const long = Array.from({ length: 40 }, () => paragraph).join("\n\n");
    const { text } = budgetInput(long);
    // The kept text ends where a paragraph ended, not part-way through one.
    expect(long.startsWith(text)).toBe(true);
    expect(text.endsWith(paragraph.trim())).toBe(true);
  });
});
