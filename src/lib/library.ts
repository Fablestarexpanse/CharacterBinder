import { openDB, type IDBPDatabase } from "idb";
import type {
  DataCardType, RawCardFor, LibraryCard, LibraryCardBase, LoreBook, PersonaCard, ScenarioCard, ScriptCard, TavernCardV2,
} from "../types";

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

/**
 * What a caller must supply to store a card. One entry point for every kind,
 * keyed by `cardType`, so each kind accepts exactly the fields it needs and a
 * misplaced argument is a type error rather than a card saved wrong.
 */
interface SaveCommon {
  /** Cover art as a data: URL. Not the encoded card PNG. */
  imageSrc?: string | null;
  /** Overrides the name taken from the body. */
  name?: string;
  /** Pass the id of the record being edited; omit to store a new card. */
  existingId?: string;
  tags?: string[];
}

export type SaveCardInput =
  | (SaveCommon & {
      cardType: "character";
      body: TavernCardV2;
      /** The card re-encoded into its PNG, kept so archive export needs no re-encode. */
      pngData?: Uint8Array | null;
      platform?: string;
    })
  | (SaveCommon & { cardType: "lorebook"; body: LoreBook })
  | (SaveCommon & { cardType: "script"; body: ScriptCard })
  | (SaveCommon & { cardType: "scenario"; body: ScenarioCard })
  | (SaveCommon & { cardType: "persona"; body: PersonaCard });

/**
 * Pair a card kind with a body of that kind's type.
 *
 * SaveCardInput is a union over cardType, and TypeScript cannot see that a
 * generic K and a RawCardFor<K> line up — so callers holding both generically
 * had to cast the whole input, erasing the check that catches a lorebook saved
 * as a persona. The pairing is proved by this signature and asserted once here
 * rather than at every call site.
 */
export function saveCardInput<K extends DataCardType>(
  cardType: K,
  body: RawCardFor<K>,
  common: Omit<SaveCommon, "body"> = {}
): SaveCardInput {
  return { ...common, cardType, body } as SaveCardInput;
}

/** Store a card, or update the one named by `existingId`. */
export async function saveLibraryCard(input: SaveCardInput): Promise<LibraryCard> {
  const db = await getDb();
  const now = Date.now();
  const shell = {
    id: input.existingId ?? crypto.randomUUID(),
    imageSrc: input.imageSrc ?? null,
    createdAt: await originalCreatedAt(db, input.existingId, now),
    updatedAt: now,
  };

  let card: LibraryCard;
  if (input.cardType === "character") {
    card = {
      ...shell,
      cardType: "character",
      cardData: input.body,
      name: input.name || input.body.data.name || "Unnamed Character",
      pngData: input.pngData ?? null,
      platform: input.platform ?? "sillytavern",
      tags: input.tags ?? input.body.data.tags ?? [],
    };
  } else {
    // Non-character cards carry no encoded PNG, and their "platform" is the
    // kind itself — nothing converts them per target app.
    const common = {
      ...shell,
      name: input.name || input.body.name || `Unnamed ${input.cardType}`,
      pngData: null,
      platform: input.cardType,
      tags: input.tags ?? [],
    };
    switch (input.cardType) {
      case "lorebook": card = { ...common, cardType: "lorebook", rawData: input.body }; break;
      case "script":   card = { ...common, cardType: "script",   rawData: input.body }; break;
      case "scenario": card = { ...common, cardType: "scenario", rawData: input.body }; break;
      case "persona":  card = { ...common, cardType: "persona",  rawData: input.body }; break;
    }
  }

  await db.put(STORE, card);
  return card;
}

/**
 * Records written before card types existed have no `cardType`; they are all
 * character cards. Both reads apply this, so nothing downstream needs to repeat
 * the fallback — a card that has been through here always has a type.
 */
function withCardType(record: LibraryCard): LibraryCard {
  if (record.cardType) return record;
  const legacy = record as LibraryCardBase & { cardData: TavernCardV2 };
  return { ...legacy, cardType: "character" };
}

/** Return all cards, newest first. */
export async function getAllCards(): Promise<LibraryCard[]> {
  const db = await getDb();
  const all: LibraryCard[] = await db.getAll(STORE);
  return all.map(withCardType).sort((a, b) => b.updatedAt - a.updatedAt);
}

/** One card by id, without reading the whole library to find it. */
export async function getCard(id: string): Promise<LibraryCard | null> {
  const db = await getDb();
  const card = await db.get(STORE, id);
  return card ? withCardType(card) : null;
}

export async function deleteCard(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE, id);
}

