export interface CharacterBook {
  name?: string;
  description?: string;
  scan_depth?: number;
  token_budget?: number;
  recursive_scanning?: boolean;
  extensions?: Record<string, unknown>;
  entries: CharacterBookEntry[];
}

export interface CharacterBookEntry {
  keys: string[];
  content: string;
  extensions?: Record<string, unknown>;
  enabled: boolean;
  insertion_order: number;
  case_sensitive?: boolean;
  name?: string;
  priority?: number;
  id?: number;
  comment?: string;
  selective?: boolean;
  secondary_keys?: string[];
  constant?: boolean;
  position?: "before_char" | "after_char";
}

export interface TavernCardV2Data {
  name: string;
  description: string;
  personality: string;
  scenario: string;
  first_mes: string;
  mes_example: string;
  creator_notes: string;
  system_prompt: string;
  post_history_instructions: string;
  alternate_greetings: string[];
  character_book?: CharacterBook;
  tags: string[];
  creator: string;
  character_version: string;
  extensions: Record<string, unknown>;
}

/**
 * Declared as a type alias, not an interface, so it satisfies
 * `Record<string, unknown>` — the shape every platform converter returns. An
 * interface has no implicit index signature, which is what forced the export
 * dispatcher to cast three of its eight branches through `unknown`.
 */
export type TavernCardV2 = {
  spec: "chara_card_v2";
  spec_version: "2.0";
  data: TavernCardV2Data;
};

export type MetadataKey =
  | "chara"
  | "character"
  | "tavern"
  | "tavern_card_v2"
  | "lorebook"
  | "script"
  | "scenario"
  | "persona";

export interface AppSettings {
  autoValidateBeforeExport: boolean;
  preserveUnknownChunks: boolean;
  prettyPrintJson: boolean;
}

export interface PngChunkInfo {
  keyword: string;
  dataLength: number;
  chunkType: string;
}

export interface MetadataInfo {
  format: string;
  encoding: string;
  dataSize: number;
  imageWidth: number;
  imageHeight: number;
  chunks: PngChunkInfo[];
  rawKey?: string;
}

export interface CardProject {
  id: string;
  card: TavernCardV2;
  imageSrc?: string;
  outputFileName: string;
  lastModified: string;
  metadataInfo?: MetadataInfo;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export type NavPage =
  | "create"
  | "library"
  | "lorebook"
  | "script"
  | "scenario"
  | "persona"
  | "import"
  | "decode"
  | "templates"
  | "settings"
  | "help";

export interface LoreEntry {
  id: string;
  name: string;
  keys: string[];
  secondary_keys: string[];
  content: string;
  enabled: boolean;
  insertion_order: number;
  case_sensitive: boolean;
  priority: number;
  selective: boolean;
  constant: boolean;
  position: "before_char" | "after_char";
  comment: string;
}

export interface LoreBook {
  name: string;
  description: string;
  creator: string;
  version: string;
  creator_notes: string;
  scan_depth: number;
  token_budget: number;
  recursive_scanning: boolean;
  entries: LoreEntry[];
}

export interface ScriptCard {
  spec: "script_card_v1";
  name: string;
  description: string;
  content: string;
  tags: string[];
  author: string;
  version: string;
  creator_notes: string;
}

export interface ScenarioCard {
  spec: "scenario_card_v1";
  name: string;
  description: string;
  scenario: string;
  first_mes: string;
  tags: string[];
  creator: string;
  version: string;
  creator_notes: string;
}

/**
 * The five kinds of card this app understands, in the order the UI presents
 * them. Declared once as a tuple: every other module imports this rather than
 * restating the literals, so a new card type is a compile error everywhere it
 * needs handling instead of a silent gap — and schemas that need the list (the
 * MCP tools) can take it rather than spelling the members out again.
 */
export const CARD_TYPES = ["character", "lorebook", "script", "scenario", "persona"] as const;

export type LibraryCardType = (typeof CARD_TYPES)[number];

/**
 * Every kind but "character": the four cards stored as a plain body rather than
 * a Tavern V2 card, and edited by the four non-character editors.
 */
export type DataCardType = Exclude<LibraryCardType, "character">;

/**
 * Open a non-character card in the editor for its kind.
 *
 * Character cards do not come through here: they are converted per platform on
 * the way in, so the import panels hand them to `onLoad` with the metadata and
 * source platform they were read with, and the library hands them to
 * `onEditCard` with their cover image and id. Everything else — which needs
 * neither conversion nor metadata — takes this one callback.
 *
 * One callback carrying the kind, rather than one prop per kind: ImportPNG,
 * DecodePNG and Library each used to take four structurally identical
 * `onLoad*`/`onEdit*` props that App satisfied with eight near-identical
 * handlers, so adding a sixth card kind meant editing four component
 * signatures and their call sites.
 *
 * `payload` is whatever was decoded — from a PNG, a JSON file, or a library
 * record — and is normalised by the receiver, so no caller has to know the
 * shape of the kind it is opening.
 */
export type OpenDataCard = (
  cardType: DataCardType,
  payload: unknown,
  imageSrc: string | null,
  libraryId?: string
) => void;

export function isCardType(value: unknown): value is LibraryCardType {
  return typeof value === "string" && (CARD_TYPES as readonly string[]).includes(value);
}

export interface PersonaCard {
  spec: "persona_card_v1";
  name: string;
  description: string;
  personality: string;
  appearance: string;
  background: string;
  tags: string[];
  creator: string;
  version: string;
  creator_notes: string;
}

/** Everything every stored card carries, regardless of kind. */
export interface LibraryCardBase {
  id: string;
  name: string;
  pngData: Uint8Array | null;
  imageSrc: string | null;
  platform: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

/**
 * A stored card, discriminated on `cardType`.
 *
 * The payload slot used to depend on cardType by convention, documented in a
 * comment — so every read re-asserted the type with a cast the compiler could
 * not check. Narrowing on `cardType` now does that work.
 */
export type LibraryCard =
  | (LibraryCardBase & { cardType: "character"; cardData: TavernCardV2; rawData?: never })
  | (LibraryCardBase & { cardType: "lorebook"; rawData: LoreBook; cardData?: never })
  | (LibraryCardBase & { cardType: "script"; rawData: ScriptCard; cardData?: never })
  | (LibraryCardBase & { cardType: "scenario"; rawData: ScenarioCard; cardData?: never })
  | (LibraryCardBase & { cardType: "persona"; rawData: PersonaCard; cardData?: never });

/** The non-character payload for a given card type. */
export type RawCardFor<T extends Exclude<LibraryCardType, "character">> =
  T extends "lorebook" ? LoreBook
  : T extends "script" ? ScriptCard
  : T extends "scenario" ? ScenarioCard
  : PersonaCard;
