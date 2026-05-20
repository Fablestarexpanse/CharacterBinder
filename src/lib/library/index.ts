import { openDB, type IDBPDatabase } from "idb";
import type { LibraryCard, TavernCardV2 } from "../../types";

const DB_NAME = "characterbinder-library";
const DB_VERSION = 1;
const STORE = "cards";

let _db: IDBPDatabase | null = null;

async function getDb() {
  if (!_db) {
    _db = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("name", "name");
        store.createIndex("updatedAt", "updatedAt");
        store.createIndex("platform", "platform");
      },
    });
  }
  return _db;
}

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
    cardData,
    pngData,
    imageSrc,
    platform,
    tags: cardData.data.tags ?? [],
    createdAt: existingId ? (await db.get(STORE, existingId))?.createdAt ?? now : now,
    updatedAt: now,
  };
  await db.put(STORE, card);
  return card;
}

export async function getAllCards(): Promise<LibraryCard[]> {
  const db = await getDb();
  return db.getAllFromIndex(STORE, "updatedAt");
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
