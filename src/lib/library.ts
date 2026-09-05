import { openDB, type IDBPDatabase } from "idb";
import type { PlatformId } from "../shared/platforms/registry";
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
      platform?: PlatformId;
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
    // Non-character cards carry no encoded PNG and no target platform: nothing
    // converts them per app.
    const common = {
      ...shell,
      name: input.name || input.body.name || `Unnamed ${input.cardType}`,
      pngData: null,
      tags: input.tags ?? [],
    };
    // One assertion rather than four arms whose bodies are the same text: the
    // discriminated SaveCardInput has already proved that this body belongs to
    // this kind, and the four-case switch existed only to say so again.
    card = { ...common, cardType: input.cardType, rawData: input.body } as LibraryCard;
  }

  await db.put(STORE, card);
  return card;
}

/**
 * What actually comes back out of IndexedDB.
 *
 * The store holds whatever past versions of the app wrote, so a read cannot
 * claim to be a LibraryCard before it has been through withCardType — annotating
 * it as one made the compiler agree that `record.cardType` was always there,
 * which is exactly the thing being checked.
 */
type StoredCard = Partial<LibraryCard> & LibraryCardBase & { cardData?: TavernCardV2; platform?: PlatformId };

/**
 * Records written before card types existed have no `cardType`; they are all
 * character cards. Both reads apply this, so nothing downstream needs to repeat
 * the fallback — a card that has been through here always has a type.
 */
function withCardType(record: StoredCard): LibraryCard {
  if (record.cardType) return record as LibraryCard;
  // A typeless record predates the other four kinds, so it is a character card
  // and carries no rawData; the assertion says only that.
  const { rawData: _unused, ...rest } = record;
  return {
    ...rest,
    cardType: "character",
    cardData: record.cardData ?? ({} as TavernCardV2),
    platform: record.platform ?? "sillytavern",
  };
}

/** Return all cards, newest first. */
export async function getAllCards(): Promise<LibraryCard[]> {
  const db = await getDb();
  const all: StoredCard[] = await db.getAll(STORE);
  return all.map(withCardType).sort((a, b) => b.updatedAt - a.updatedAt);
}

/** One card by id, without reading the whole library to find it. */
export async function getCard(id: string): Promise<LibraryCard | null> {
  const db = await getDb();
  const card: StoredCard | undefined = await db.get(STORE, id);
  return card ? withCardType(card) : null;
}

export async function deleteCard(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE, id);
}


/**
 * The payload a card is stored as: the whole Tavern v2 card for a character,
 * the plain body for the other four. This is what an export writes out.
 */
export function cardPayload(card: LibraryCard): object {
  return card.cardType === "character" ? card.cardData : card.rawData;
}

/**
 * Records are read back from IndexedDB, where a truncated write or an older
 * build can leave a character card with no body at all. Every accessor below
 * has to survive that: a damaged card still has to list and still has to say
 * what is wrong with it.
 */

/**
 * The editable fields inside that payload — a character card keeps them one
 * level down, under `data`. Copied, so a caller merging a patch into it cannot
 * write through to the stored record.
 */
export function cardBody(card: LibraryCard): Record<string, unknown> {
  return card.cardType === "character" ? { ...card.cardData?.data } : { ...card.rawData };
}

/**
 * A card's own version string, whatever the kind calls it, or null when it has
 * none. Character cards say `character_version`; the rest say `version`.
 */
export function cardVersion(card: LibraryCard): string | null {
  const body = cardBody(card);
  const raw = body.character_version ?? body.version;
  const v = typeof raw === "string" ? raw.trim() : "";
  return v || null;
}
