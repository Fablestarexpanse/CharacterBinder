import { describe, it, expect, beforeEach, vi } from "vitest";
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { createBlankTavernCard } from "../shared/tavernCard";
import { blankPersonaCard } from "./blankCards";

// A fresh factory per test: the library caches its database handle, so the
// module is re-imported alongside it.
let library: typeof import("./library");

beforeEach(async () => {
  indexedDB = new IDBFactory();
  vi.resetModules();
  library = await import("./library");
});

const character = (name: string) => {
  const card = createBlankTavernCard(name);
  card.data.description = "A dockhand.";
  card.data.tags = ["harbour"];
  return card;
};

describe("saveLibraryCard", () => {
  it("stores a character card and reads it back whole", async () => {
    const saved = await library.saveLibraryCard({ cardType: "character", body: character("Rook") });
    const read = await library.getCard(saved.id);

    expect(read?.name).toBe("Rook");
    expect(read?.cardType).toBe("character");
    // Narrow the union the way a caller would, rather than reaching past it.
    if (read?.cardType !== "character") throw new Error("expected a character card");
    expect(read.cardData.data.description).toBe("A dockhand.");
    // Tags come from the card itself, so the library can index on them.
    expect(read?.tags).toEqual(["harbour"]);
  });

  it("takes the name and tags a data card is given", async () => {
    const saved = await library.saveLibraryCard({
      cardType: "persona",
      body: { ...blankPersonaCard(), name: "Kael" },
      tags: ["scientist"],
    });
    const read = await library.getCard(saved.id);

    expect(read?.name).toBe("Kael");
    expect(read?.cardType).toBe("persona");
    expect(read?.tags).toEqual(["scientist"]);
    // A data card carries no encoded PNG, and its platform is its own kind.
    expect(read?.pngData).toBeNull();
    expect(read?.platform).toBe("persona");
  });

  it("updates in place when given the existing id, keeping createdAt", async () => {
    const first = await library.saveLibraryCard({ cardType: "character", body: character("Rook") });
    await new Promise((r) => setTimeout(r, 5));
    const second = await library.saveLibraryCard({
      cardType: "character",
      body: character("Rook the Elder"),
      existingId: first.id,
    });

    expect(second.id).toBe(first.id);
    expect(second.createdAt).toBe(first.createdAt);
    expect(second.updatedAt).toBeGreaterThanOrEqual(first.updatedAt);
    expect(await library.getAllCards()).toHaveLength(1);
  });

  it("stores a second card when no id is given, so a version bump forks", async () => {
    await library.saveLibraryCard({ cardType: "character", body: character("Rook") });
    await library.saveLibraryCard({ cardType: "character", body: character("Rook") });
    expect(await library.getAllCards()).toHaveLength(2);
  });

  it("names an unnamed card after its kind rather than storing an empty name", async () => {
    const saved = await library.saveLibraryCard({ cardType: "scenario", body: { ...blankPersonaCard(), name: "" } as never });
    expect(saved.name).toBe("Unnamed scenario");
  });
});

describe("getAllCards", () => {
  it("returns newest first", async () => {
    const a = await library.saveLibraryCard({ cardType: "character", body: character("First") });
    await new Promise((r) => setTimeout(r, 5));
    const b = await library.saveLibraryCard({ cardType: "character", body: character("Second") });

    const all = await library.getAllCards();
    expect(all.map((c) => c.id)).toEqual([b.id, a.id]);
  });

  it("treats a record written before card types existed as a character", async () => {
    const saved = await library.saveLibraryCard({ cardType: "character", body: character("Legacy") });
    // Strip the field the way an old record would have been stored.
    const db = await new Promise<IDBDatabase>((resolve) => {
      const req = indexedDB.open("characterbinder-library");
      req.onsuccess = () => resolve(req.result);
    });
    await new Promise<void>((resolve) => {
      const tx = db.transaction("cards", "readwrite");
      const store = tx.objectStore("cards");
      const get = store.get(saved.id);
      get.onsuccess = () => {
        const record = get.result as Record<string, unknown>;
        delete record.cardType;
        store.put(record);
      };
      tx.oncomplete = () => resolve();
    });

    expect((await library.getCard(saved.id))?.cardType).toBe("character");
    expect((await library.getAllCards())[0].cardType).toBe("character");
  });
});

describe("getCard and deleteCard", () => {
  it("returns null for an id that is not there", async () => {
    expect(await library.getCard("nope")).toBeNull();
  });

  it("removes only the card asked for", async () => {
    const a = await library.saveLibraryCard({ cardType: "character", body: character("Keep") });
    const b = await library.saveLibraryCard({ cardType: "character", body: character("Drop") });

    await library.deleteCard(b.id);

    expect(await library.getCard(b.id)).toBeNull();
    expect(await library.getCard(a.id)).not.toBeNull();
  });
});
