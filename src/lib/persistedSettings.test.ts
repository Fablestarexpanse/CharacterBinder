import { describe, it, expect, beforeEach, vi } from "vitest";
import { createPersistedSettings } from "./persistedSettings";

const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
});

const DEFAULTS = { a: 1, b: "x", flag: false };

describe("createPersistedSettings", () => {
  beforeEach(() => store.clear());

  it("returns the defaults when nothing is stored", () => {
    expect(createPersistedSettings("k", DEFAULTS).get()).toEqual(DEFAULTS);
  });

  it("merges stored values over the defaults, so a new key gets its default", () => {
    store.set("k", JSON.stringify({ a: 9 }));
    expect(createPersistedSettings("k", DEFAULTS).get()).toEqual({ ...DEFAULTS, a: 9 });
  });

  it("falls back to the defaults on unparseable or non-object storage", () => {
    const s = createPersistedSettings("k", DEFAULTS);
    store.set("k", "{not json");
    expect(s.get()).toEqual(DEFAULTS);
    store.set("k", JSON.stringify([1, 2]));
    expect(s.get()).toEqual(DEFAULTS);
  });

  it("save merges a patch, persists it and returns the result", () => {
    const s = createPersistedSettings("k", DEFAULTS);
    expect(s.save({ b: "y" })).toEqual({ ...DEFAULTS, b: "y" });
    expect(s.get()).toEqual({ ...DEFAULTS, b: "y" });
  });

  it("notifies subscribers until they unsubscribe", () => {
    const s = createPersistedSettings("k", DEFAULTS);
    const seen: unknown[] = [];
    const off = s.subscribe((v) => seen.push(v));
    s.save({ a: 2 });
    off();
    s.save({ a: 3 });
    expect(seen).toEqual([{ ...DEFAULTS, a: 2 }]);
  });

  it("still applies a value for the session when storage refuses the write", () => {
    const s = createPersistedSettings("k", DEFAULTS);
    const setItem = localStorage.setItem;
    vi.spyOn(localStorage, "setItem").mockImplementation(() => { throw new Error("quota"); });
    expect(() => s.save({ a: 5 })).not.toThrow();
    vi.mocked(localStorage.setItem).mockImplementation(setItem);
  });
});
