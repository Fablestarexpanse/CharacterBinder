import { openDB, type IDBPDatabase } from "idb";
import type { LibraryCard, LibraryCardType, RawCardFor, TavernCardV2 } from "../../types";

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

/**
 * Read the createdAt of an existing record, so an update keeps its original
 * creation time rather than resetting it.
 */
async function originalCreatedAt(db: IDBPDatabase, existingId: string | undefined, fallback: number): Promise<number> {
  if (!existingId) return fallback;
  const prior = await db.get(STORE, existingId);
  return prior?.createdAt ?? fallback;
}

/** Save or update a character card. Name and tags come from the card itself. */
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
    pngData,
    imageSrc,
    platform,
    tags: cardData.data.tags ?? [],
    createdAt: await originalCreatedAt(db, existingId, now),
    updatedAt: now,
  };
  await db.put(STORE, card);
  return card;
}

/**
 * Save or update a lorebook, script, scenario, or persona card.
 *
 * Generic over the card type so `rawData` is checked against the payload that
 * type actually stores, rather than being accepted as `unknown` and cast back
 * out at every read.
 */
export async function saveAnyCard<T extends Exclude<LibraryCardType, "character">>(
  cardType: T,
  name: string,
  rawData: RawCardFor<T>,
  imageSrc: string | null,
  tags: string[],
  existingId?: string
): Promise<LibraryCard> {
  const db = await getDb();
  const now = Date.now();
  const card = {
    id: existingId ?? crypto.randomUUID(),
    name: name || `Unnamed ${cardType}`,
    cardType,
    rawData,
    pngData: null,
    imageSrc,
    platform: cardType,
    tags,
    createdAt: await originalCreatedAt(db, existingId, now),
    updatedAt: now,
  } as LibraryCard;
  await db.put(STORE, card);
  return card;
}

/** Return all cards, newest first, with legacy records normalised to "character". */
export async function getAllCards(): Promise<LibraryCard[]> {
  const db = await getDb();
  const all: LibraryCard[] = await db.getAll(STORE);
  return all
    .map((c) => ({ ...c, cardType: c.cardType ?? "character" }) as LibraryCard)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * One card by id. Callers previously scanned getAllCards() to find one, which
 * reads and deserialises the entire library to answer a point lookup.
 */
export async function getCard(id: string): Promise<LibraryCard | null> {
  const db = await getDb();
  const card = await db.get(STORE, id);
  return card ? ({ ...card, cardType: card.cardType ?? "character" } as LibraryCard) : null;
}

export async function deleteCard(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE, id);
}

