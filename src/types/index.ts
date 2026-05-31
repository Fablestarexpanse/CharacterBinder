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

export interface TavernCardV2 {
  spec: "chara_card_v2";
  spec_version: "2.0";
  data: TavernCardV2Data;
}

export interface JanitorAICharacter {
  name: string;
  persona: string;
  world?: string;
  scenario?: string;
  greeting?: string;
  example_dialogs?: string;
  visibility?: "public" | "private" | "unlisted";
  tags?: string[];
  nsfw?: boolean;
}

export interface RPBuddyCharacter {
  name: string;
  description: string;
  personality?: string;
  scenario?: string;
  greeting?: string;
  example_dialogs?: string;
  system_prompt?: string;
  tags?: string[];
  version?: string;
}

export interface AgnaiCharacter {
  kind: "character";
  name: string;
  description: string;
  persona: {
    kind: "text";
    attributes: Record<string, string[]>;
  };
  sampleChat: string;
  scenario: string;
  greeting: string;
  systemPrompt?: string;
  postHistoryInstructions?: string;
  tags?: string[];
  creator?: string;
  characterVersion?: string;
}

export interface GenericCharacterCard {
  name: string;
  description: string;
  personality?: string;
  scenario?: string;
  first_message?: string;
  example_dialogs?: string;
  system_prompt?: string;
  tags?: string[];
  creator?: string;
  version?: string;
}

export type ExportFormat =
  | "tavern_v2"
  | "janitor_ai"
  | "rpbuddy"
  | "agnai"
  | "generic";

export type MetadataKey =
  | "chara"
  | "character"
  | "tavern"
  | "tavern_card_v2"
  | "lorebook"
  | "script"
  | "scenario";

export interface AppSettings {
  defaultExportFormat: ExportFormat;
  defaultMetadataKey: MetadataKey;
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
  name: string;
  card: TavernCardV2;
  imageSrc?: string;
  templateImageSrc?: string;
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
}

export type LibraryCardType = "character" | "lorebook" | "script" | "scenario";

export interface LibraryCard {
  id: string;
  name: string;
  /** Defaults to "character" for legacy records that pre-date this field. */
  cardType: LibraryCardType;
  cardData?: TavernCardV2;   // present when cardType === "character"
  rawData?: unknown;          // present when cardType is lorebook | script | scenario
  pngData: Uint8Array | null;
  imageSrc: string | null;
  platform: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}
