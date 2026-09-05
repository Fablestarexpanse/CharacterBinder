import { describe, it, expect } from "vitest";
import { SORTER_MODELS, DEFAULT_MODEL_ID } from "./models";

describe("SORTER_MODELS", () => {
  it("offers the default model as one of its choices", () => {
    // Storing a default that is not in the list leaves the settings panel with
    // nothing selected and the light describing a model the user cannot pick.
    expect(SORTER_MODELS.map((m) => m.id)).toContain(DEFAULT_MODEL_ID);
  });

  it("describes each model with a label and a download size", () => {
    for (const model of SORTER_MODELS) {
      expect(model.id).toBeTruthy();
      expect(model.label).toBeTruthy();
      // The size is what stops a user starting a multi-gigabyte download blind.
      expect(model.label).toMatch(/\d/);
    }
  });

  it("lists no model twice", () => {
    const ids = SORTER_MODELS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
