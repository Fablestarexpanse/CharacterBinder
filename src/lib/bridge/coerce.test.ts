import { describe, it, expect } from "vitest";
import { coerceCharacterData, coerceCardBody } from "../blankCards";

describe("coerceCharacterData", () => {
  it("keeps only v2 fields, dropping anything the peer invented", () => {
    const data = coerceCharacterData({ name: "Mira", description: "d", evil_payload: "x" });
    expect(data.name).toBe("Mira");
    expect(data.description).toBe("d");
    expect(data).not.toHaveProperty("evil_payload");
  });

  it("drops values of the wrong type instead of storing them", () => {
    const data = coerceCharacterData({ personality: 7, tags: ["a", 2, "b"], alternate_greetings: "no" });
    expect(data.personality).toBe("");
    expect(data.tags).toEqual(["a", "b"]);
    expect(data.alternate_greetings).toEqual([]);
  });

  it("keeps extensions only when it is an object", () => {
    expect(coerceCharacterData({ extensions: { risuai: {} } }).extensions).toEqual({ risuai: {} });
    expect(coerceCharacterData({ extensions: "nope" }).extensions).toEqual({});
    expect(coerceCharacterData({ extensions: [1] }).extensions).toEqual({});
  });

  it("fills every required field even from an empty body", () => {
    const data = coerceCharacterData({});
    expect(data.name).toBe("");
    expect(data.first_mes).toBe("");
    expect(data.tags).toEqual([]);
  });
});

describe("coerceCardBody keeps the spec of the kind it was asked for", () => {
  it("ignores a spec supplied by the caller", () => {
    expect(coerceCardBody("script", { spec: "persona_card_v1", content: "x" }).spec).toBe("script_card_v1");
  });
});
