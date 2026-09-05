/**
 * The bridge's token store: it carries the two legacy localStorage keys into
 * the settings store, and it does so without making an import a storage write.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const store = new Map<string, string>();
const writes: string[] = [];
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { writes.push(k); store.set(k, v); },
  removeItem: (k: string) => { writes.push(`remove:${k}`); store.delete(k); },
});

let bridgeState: typeof import("./bridgeState");

beforeEach(async () => {
  store.clear();
  writes.length = 0;
  vi.resetModules();
});

describe("bridge token store", () => {
  it("writes nothing to storage merely because it was imported", async () => {
    store.set("cb_bridge_token", "a-legacy-token");
    bridgeState = await import("./bridgeState");
    expect(writes).toEqual([]);
  });

  it("carries the legacy token and flag into the store on first read", async () => {
    store.set("cb_bridge_token", "a-legacy-token");
    store.set("cb_bridge_enabled", "1");
    bridgeState = await import("./bridgeState");

    expect(bridgeState.getBridgeToken()).toBe("a-legacy-token");
    expect(bridgeState.isBridgeEnabled()).toBe(true);
    // The old keys are cleared, so a later downgrade can't resurrect a token
    // the user has since replaced.
    expect(store.has("cb_bridge_token")).toBe(false);
    expect(store.has("cb_bridge_enabled")).toBe(false);
  });

  it("leaves a fresh install alone", async () => {
    bridgeState = await import("./bridgeState");
    expect(bridgeState.getBridgeToken()).toBe("");
    expect(bridgeState.isBridgeEnabled()).toBe(false);
  });

  it("trims a pasted token, which is how one arrives from a terminal", async () => {
    bridgeState = await import("./bridgeState");
    bridgeState.setBridgeToken("  abc123  ");
    expect(bridgeState.getBridgeToken()).toBe("abc123");
  });
});
