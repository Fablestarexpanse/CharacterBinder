import { openDB, type IDBPDatabase } from "idb";
import type { LibraryCard, LibraryCardType, TavernCardV2 } from "../../types";

const DB_NAME = "characterbinder-library";
const DB_VERSION = 2;
const STORE = "cards";

let _db: IDBPDatabase | null = null;

async function getDb() {
  if (!_db) {
    _db = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, _newVersion, tx) {
        if (oldVersion < 1) {
          const store = db.createObjectStore(STORE, { keyPath: "id" });
          store.createIndex("name", "name");
          store.createIndex("updatedAt", "updatedAt");
          store.createIndex("platform", "platform");
        }
        if (oldVersion < 2) {
          // Add cardType index; existing records are normalised to "character" on read
          const store = tx.objectStore(STORE);
          if (!store.indexNames.contains("cardType")) {
            store.createIndex("cardType", "cardType");
          }
        }
      },
    });
  }
  return _db;
}

/** Save / update a character card. */
export async function saveCard(
  cardData: TavernCardV2,
  pngData: Uint8Array | null,
  imageSrc: string | null,
  platform: string,
  existingId?: string
): Promise<LibraryCard> {
  const db = await getDb();
  const now = Date.now();
  const card: LibraryCard = {
    id: existingId ?? crypto.randomUUID(),
    name: cardData.data.name || "Unnamed Character",
    cardType: "character",
    cardData,
    rawData: undefined,
    pngData,
    imageSrc,
    platform,
    tags: cardData.data.tags ?? [],
    createdAt: existingId ? ((await db.get(STORE, existingId))?.createdAt ?? now) : now,
    updatedAt: now,
  };
  await db.put(STORE, card);
  return card;
}

/** Save / update a lorebook, script, or scenario card. */
export async function saveAnyCard(
  cardType: Exclude<LibraryCardType, "character">,
  name: string,
  rawData: unknown,
  imageSrc: string | null,
  tags: string[],
  existingId?: string
): Promise<LibraryCard> {
  const db = await getDb();
  const now = Date.now();
  const card: LibraryCard = {
    id: existingId ?? crypto.randomUUID(),
    name: name || `Unnamed ${cardType}`,
    cardType,
    cardData: undefined,
    rawData,
    pngData: null,
    imageSrc,
    platform: cardType,
    tags,
    createdAt: existingId ? ((await db.get(STORE, existingId))?.createdAt ?? now) : now,
    updatedAt: now,
  };
  await db.put(STORE, card);
  return card;
}

/** Return all cards, sorted newest-first, with legacy cardType normalised to "character". */
export async function getAllCards(): Promise<LibraryCard[]> {
  const db = await getDb();
  const all: LibraryCard[] = await db.getAll(STORE);
  return all
    .map((c) => ({ ...c, cardType: c.cardType ?? "character" }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getCard(id: string): Promise<LibraryCard | undefined> {
  const db = await getDb();
  return db.get(STORE, id);
}

export async function deleteCard(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE, id);
}

export async function getCardCount(): Promise<number> {
  const db = await getDb();
  return db.count(STORE);
}
