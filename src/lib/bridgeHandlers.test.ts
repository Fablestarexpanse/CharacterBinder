// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import type { LibraryCard } from "../types";

/**
 * The app side of the bridge: what an agent's calls do to the library.
 *
 * The socket itself is covered from the server side (mcp/src/bridge.test.ts);
 * here the handlers are driven directly through the same dispatch a live
 * connection would use.
 */

const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
});

let handlers: typeof import("./bridgeHandlers");
let bridgeState: typeof import("./bridgeState");
let library: typeof import("./library");
const opened: LibraryCard[] = [];
const confirmDestructive = vi.fn(async () => true);

beforeEach(async () => {
  vi.clearAllMocks();
  store.clear();
  indexedDB = new IDBFactory();
  vi.resetModules();
  opened.length = 0;

  library = await import("./library");
  handlers = await import("./bridgeHandlers");
  bridgeState = await import("./bridgeState");
  bridgeState.setHost({
    openCard: (card) => {
      opened.push(card);
      return null;
    },
    confirmDestructive: () => confirmDestructive(),
  });
});

/** Drives one RPC the way an authenticated peer would. */
async function call(method: string, params: unknown) {
  return handlers.handleBridgeRequest({ id: "1", method, params } as never);
}

const characterParams = {
  cardType: "character",
  data: { name: "Rook", description: "A dockhand." },
};

describe("cards.create", () => {
  it("stores a card and reports its id, name and type", async () => {
    const result = (await call("cards.create", characterParams)) as { id: string; name: string; cardType: string };
    expect(result.name).toBe("Rook");
    expect(result.cardType).toBe("character");

    const stored = await library.getCard(result.id);
    expect(stored?.name).toBe("Rook");
  });

  it("refuses a card type it does not have", async () => {
    await expect(call("cards.create", { cardType: "spaceship", data: {} })).rejects.toThrow(/unknown cardtype/i);
  });

  it("refuses cover art that is not inline data", async () => {
    await expect(
      call("cards.create", { ...characterParams, imageSrc: "https://example.com/art.png" })
    ).rejects.toThrow(/inline data/i);
  });

  it("keeps only the fields the card type has", async () => {
    const result = (await call("cards.create", {
      cardType: "character",
      data: { name: "Rook", description: "d", personality: 7, evil_key: "x" },
    })) as { id: string };

    const stored = await library.getCard(result.id);
    if (stored?.cardType !== "character") throw new Error("expected a character card");
    expect(stored.cardData.data).not.toHaveProperty("evil_key");
    expect(stored.cardData.data.personality).toBe("");
  });
});

describe("cards.update", () => {
  it("asks the user first, and merges only when they agree", async () => {
    const created = (await call("cards.create", characterParams)) as { id: string };
    await call("cards.update", { id: created.id, patch: { personality: "terse" } });

    expect(confirmDestructive).toHaveBeenCalledTimes(1);
    const stored = await library.getCard(created.id);
    if (stored?.cardType !== "character") throw new Error("expected a character card");
    expect(stored.cardData.data.personality).toBe("terse");
    expect(stored.cardData.data.description).toBe("A dockhand.");
  });

  it("leaves the card alone when the user refuses", async () => {
    const created = (await call("cards.create", characterParams)) as { id: string };
    confirmDestructive.mockResolvedValueOnce(false);

    await expect(call("cards.update", { id: created.id, patch: { personality: "terse" } })).rejects.toThrow(/declined/i);
    const stored = await library.getCard(created.id);
    if (stored?.cardType !== "character") throw new Error("expected a character card");
    expect(stored.cardData.data.personality).toBe("");
  });

  it("needs an id", async () => {
    await expect(call("cards.update", { patch: {} })).rejects.toThrow(/needs an "id"/i);
  });
});

describe("cards.delete", () => {
  it("asks the user first, and removes the card when they agree", async () => {
    const created = (await call("cards.create", characterParams)) as { id: string };
    await call("cards.delete", { id: created.id });

    expect(confirmDestructive).toHaveBeenCalledTimes(1);
    expect(await library.getCard(created.id)).toBeNull();
  });

  it("keeps the card when the user refuses", async () => {
    const created = (await call("cards.create", characterParams)) as { id: string };
    confirmDestructive.mockResolvedValueOnce(false);

    await expect(call("cards.delete", { id: created.id })).rejects.toThrow(/declined/i);
    expect(await library.getCard(created.id)).not.toBeNull();
  });

  it("says so when the card is not there, rather than succeeding quietly", async () => {
    await expect(call("cards.delete", { id: "nope" })).rejects.toThrow(/no card with id/i);
  });
});

describe("cards.list and cards.get", () => {
  it("summarises without the image bytes, and filters by type", async () => {
    await call("cards.create", characterParams);
    await call("cards.create", { cardType: "persona", data: { name: "Kael" } });

    const all = (await call("cards.list", {})) as { cards: unknown[] };
    expect(all.cards).toHaveLength(2);

    const personas = (await call("cards.list", { type: "persona" })) as { cards: { name: string }[] };
    expect(personas.cards.map((c) => c.name)).toEqual(["Kael"]);
  });

  it("refuses a card type filter it does not have", async () => {
    await expect(call("cards.list", { type: "spaceship" })).rejects.toThrow(/unknown cardType/i);
  });

  it("returns a card in full, and says so when it is missing", async () => {
    const created = (await call("cards.create", characterParams)) as { id: string };
    const got = (await call("cards.get", { id: created.id })) as { name: string };
    expect(got.name).toBe("Rook");

    await expect(call("cards.get", { id: "nope" })).rejects.toThrow(/no card with id/i);
  });
});

describe("app.open", () => {
  it("hands the card to the host", async () => {
    const created = (await call("cards.create", characterParams)) as { id: string };
    await call("app.open", { id: created.id });
    expect(opened.map((c) => c.id)).toEqual([created.id]);
  });
});

describe("activity", () => {
  it("records what an agent did, newest first", async () => {
    const created = (await call("cards.create", characterParams)) as { id: string };
    await call("cards.delete", { id: created.id });

    const activity = bridgeState.getBridgeState().activity;
    expect(activity.map((a) => a.method)).toEqual(["cards.delete", "cards.create"]);
    expect(activity[0].cardName).toBe("Rook");
  });

  it("records a refusal as such", async () => {
    const created = (await call("cards.create", characterParams)) as { id: string };
    confirmDestructive.mockResolvedValueOnce(false);
    await expect(call("cards.delete", { id: created.id })).rejects.toThrow();

    expect(bridgeState.getBridgeState().activity[0]).toMatchObject({ method: "cards.delete", refused: true });
  });
});

describe("opening a card reports what happened", () => {
  it("says a card was opened when the editor took it", async () => {
    const created = (await call("cards.create", characterParams)) as { id: string };
    const result = (await call("app.open", { id: created.id })) as { opened: boolean };
    expect(result.opened).toBe(true);
  });

  it("fails rather than claiming success when there is nothing to open", async () => {
    const created = (await call("cards.create", characterParams)) as { id: string };
    // A record whose body is gone: the editor has nothing to show.
    opened.length = 0;
    const host = { openCard: () => "\"Rook\" has no character data — the stored record is damaged." };
    bridgeState.setHost(host);

    // The agent hears why, rather than a generic failure or a false success.
    await expect(call("app.open", { id: created.id })).rejects.toThrow(/stored record is damaged/i);
  });

  it("reports open:false on create when the editor did not take the card", async () => {
    bridgeState.setHost({ openCard: () => "nothing to show" });
    const result = (await call("cards.create", { ...characterParams, open: true })) as { opened: boolean };
    expect(result.opened).toBe(false);
  });

  it("reports open:false when the caller never asked for it", async () => {
    const result = (await call("cards.create", characterParams)) as { opened: boolean };
    expect(result.opened).toBe(false);
  });
});
