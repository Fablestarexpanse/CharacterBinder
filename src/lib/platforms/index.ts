import type { TavernCardV2 } from "../../types";

export type PlatformId =
  | "sillytavern"
  | "janitorai"
  | "chub"
  | "agnai"
  | "venus"
  | "backyard"
  | "risu"
  | "generic";

export interface FieldSupport {
  field: keyof TavernCardV2["data"];
  label: string;
  support: "full" | "partial" | "none" | "renamed";
  note?: string;
}

export interface PlatformDef {
  id: PlatformId;
  name: string;
  color: string;           // tailwind bg color class
  textColor: string;       // tailwind text color
  borderColor: string;
  description: string;
  pngSupport: boolean;
  jsonSupport: boolean;
  metadataKey?: string;    // PNG chunk key if pngSupport
  templateVars: { user: string; char: string };
  fields: FieldSupport[];
  importKeys: string[];    // JSON keys that identify this format
  website?: string;
}

export const PLATFORMS: Record<PlatformId, PlatformDef> = {
  sillytavern: {
    id: "sillytavern",
    name: "SillyTavern",
    color: "bg-indigo-900/40",
    textColor: "text-indigo-300",
    borderColor: "border-indigo-700/50",
    description: "Full Tavern Card v2 — all fields supported",
    pngSupport: true,
    jsonSupport: true,
    metadataKey: "chara",
    templateVars: { user: "{{user}}", char: "{{char}}" },
    importKeys: ["spec", "spec_version"],
    fields: [
      { field: "name", label: "Name", support: "full" },
      { field: "description", label: "Description", support: "full" },
      { field: "personality", label: "Personality", support: "full" },
      { field: "scenario", label: "Scenario", support: "full" },
      { field: "first_mes", label: "First Message", support: "full" },
      { field: "mes_example", label: "Example Dialogs", support: "full" },
      { field: "system_prompt", label: "System Prompt", support: "full" },
      { field: "post_history_instructions", label: "Post-History", support: "full" },
      { field: "alternate_greetings", label: "Alternate Greetings", support: "full" },
      { field: "character_book", label: "Lorebook", support: "full" },
      { field: "tags", label: "Tags", support: "full" },
      { field: "creator", label: "Creator", support: "full" },
      { field: "creator_notes", label: "Creator Notes", support: "full" },
      { field: "character_version", label: "Version", support: "full" },
    ],
  },

  janitorai: {
    id: "janitorai",
    name: "JanitorAI",
    color: "bg-cyan-900/40",
    textColor: "text-cyan-300",
    borderColor: "border-cyan-700/50",
    description: "JSON import only — description maps to 'persona'",
    pngSupport: false,
    jsonSupport: true,
    templateVars: { user: "{{user}}", char: "{{bot}}" },
    importKeys: ["persona", "greeting"],
    fields: [
      { field: "name", label: "Name", support: "full" },
      { field: "description", label: "Description → persona", support: "renamed", note: "Exported as 'persona'" },
      { field: "personality", label: "Personality", support: "partial", note: "Merged into 'persona'" },
      { field: "scenario", label: "Scenario → world", support: "renamed", note: "Exported as 'world'" },
      { field: "first_mes", label: "First Message → greeting", support: "renamed" },
      { field: "mes_example", label: "Example Dialogs", support: "partial", note: "{{char}} becomes {{bot}}" },
      { field: "system_prompt", label: "System Prompt", support: "none", note: "Not supported" },
      { field: "post_history_instructions", label: "Post-History", support: "none" },
      { field: "alternate_greetings", label: "Alternate Greetings", support: "none" },
      { field: "character_book", label: "Lorebook", support: "none" },
      { field: "tags", label: "Tags", support: "full" },
      { field: "creator", label: "Creator", support: "none" },
      { field: "creator_notes", label: "Creator Notes", support: "none" },
      { field: "character_version", label: "Version", support: "none" },
    ],
  },

  chub: {
    id: "chub",
    name: "Chub.ai",
    color: "bg-orange-900/40",
    textColor: "text-orange-300",
    borderColor: "border-orange-700/50",
    description: "Tavern v2 compatible + Chub extensions block",
    pngSupport: true,
    jsonSupport: true,
    metadataKey: "chara",
    templateVars: { user: "{{user}}", char: "{{char}}" },
    importKeys: ["spec", "extensions"],
    fields: [
      { field: "name", label: "Name", support: "full" },
      { field: "description", label: "Description", support: "full" },
      { field: "personality", label: "Personality", support: "full" },
      { field: "scenario", label: "Scenario", support: "full" },
      { field: "first_mes", label: "First Message", support: "full" },
      { field: "mes_example", label: "Example Dialogs", support: "full" },
      { field: "system_prompt", label: "System Prompt", support: "full" },
      { field: "post_history_instructions", label: "Post-History", support: "full" },
      { field: "alternate_greetings", label: "Alternate Greetings", support: "full" },
      { field: "character_book", label: "Lorebook", support: "full" },
      { field: "tags", label: "Tags", support: "full" },
      { field: "creator", label: "Creator", support: "full" },
      { field: "creator_notes", label: "Creator Notes", support: "full" },
      { field: "character_version", label: "Version", support: "full" },
    ],
  },

  agnai: {
    id: "agnai",
    name: "Agnai",
    color: "bg-purple-900/40",
    textColor: "text-purple-300",
    borderColor: "border-purple-700/50",
    description: "JSON only — different schema with persona.attributes",
    pngSupport: false,
    jsonSupport: true,
    templateVars: { user: "{{user}}", char: "{{char}}" },
    importKeys: ["kind", "persona", "sampleChat"],
    fields: [
      { field: "name", label: "Name", support: "full" },
      { field: "description", label: "Description", support: "full" },
      { field: "personality", label: "Personality → persona.attributes", support: "renamed", note: "Nested in persona.attributes.personality" },
      { field: "scenario", label: "Scenario", support: "full" },
      { field: "first_mes", label: "First Message → greeting", support: "renamed" },
      { field: "mes_example", label: "Example Dialogs → sampleChat", support: "renamed" },
      { field: "system_prompt", label: "System Prompt → systemPrompt", support: "renamed" },
      { field: "post_history_instructions", label: "Post-History → postHistoryInstructions", support: "renamed" },
      { field: "alternate_greetings", label: "Alternate Greetings", support: "none" },
      { field: "character_book", label: "Lorebook", support: "none", note: "Agnai uses separate 'memory book'" },
      { field: "tags", label: "Tags", support: "full" },
      { field: "creator", label: "Creator", support: "partial" },
      { field: "creator_notes", label: "Creator Notes", support: "none" },
      { field: "character_version", label: "Version → characterVersion", support: "renamed" },
    ],
  },

  venus: {
    id: "venus",
    name: "Venus AI",
    color: "bg-pink-900/40",
    textColor: "text-pink-300",
    borderColor: "border-pink-700/50",
    description: "Tavern v1/v2 hybrid — v2 fields may be ignored",
    pngSupport: true,
    jsonSupport: true,
    metadataKey: "chara",
    templateVars: { user: "{{user}}", char: "{{char}}" },
    importKeys: ["name", "description", "first_mes"],
    fields: [
      { field: "name", label: "Name", support: "full" },
      { field: "description", label: "Description", support: "full" },
      { field: "personality", label: "Personality", support: "full" },
      { field: "scenario", label: "Scenario", support: "full" },
      { field: "first_mes", label: "First Message", support: "full" },
      { field: "mes_example", label: "Example Dialogs", support: "full" },
      { field: "system_prompt", label: "System Prompt", support: "partial", note: "May be ignored on older versions" },
      { field: "post_history_instructions", label: "Post-History", support: "partial" },
      { field: "alternate_greetings", label: "Alternate Greetings", support: "partial" },
      { field: "character_book", label: "Lorebook", support: "partial" },
      { field: "tags", label: "Tags", support: "full" },
      { field: "creator", label: "Creator", support: "none" },
      { field: "creator_notes", label: "Creator Notes", support: "none" },
      { field: "character_version", label: "Version", support: "none" },
    ],
  },

  backyard: {
    id: "backyard",
    name: "Backyard AI",
    color: "bg-green-900/40",
    textColor: "text-green-300",
    borderColor: "border-green-700/50",
    description: "Own schema — name/description/prompt remapped",
    pngSupport: false,
    jsonSupport: true,
    templateVars: { user: "{{user}}", char: "{{char}}" },
    importKeys: ["aiName", "basePrompt", "initialMessage"],
    fields: [
      { field: "name", label: "Name → aiName", support: "renamed" },
      { field: "description", label: "Description → basePrompt", support: "renamed", note: "Combined with personality" },
      { field: "personality", label: "Personality → basePrompt", support: "partial", note: "Merged into basePrompt" },
      { field: "scenario", label: "Scenario", support: "partial" },
      { field: "first_mes", label: "First Message → initialMessage", support: "renamed" },
      { field: "mes_example", label: "Example Dialogs", support: "none" },
      { field: "system_prompt", label: "System Prompt", support: "partial" },
      { field: "post_history_instructions", label: "Post-History", support: "none" },
      { field: "alternate_greetings", label: "Alternate Greetings", support: "none" },
      { field: "character_book", label: "Lorebook", support: "none" },
      { field: "tags", label: "Tags", support: "none" },
      { field: "creator", label: "Creator", support: "none" },
      { field: "creator_notes", label: "Creator Notes", support: "none" },
      { field: "character_version", label: "Version", support: "none" },
    ],
  },

  risu: {
    id: "risu",
    name: "RisuAI",
    color: "bg-yellow-900/40",
    textColor: "text-yellow-300",
    borderColor: "border-yellow-700/50",
    description: "Tavern v2 + RisuAI extensions (regex, UI modules)",
    pngSupport: true,
    jsonSupport: true,
    metadataKey: "chara",
    templateVars: { user: "{{user}}", char: "{{char}}" },
    importKeys: ["spec", "extensions"],
    fields: [
      { field: "name", label: "Name", support: "full" },
      { field: "description", label: "Description", support: "full" },
      { field: "personality", label: "Personality", support: "full" },
      { field: "scenario", label: "Scenario", support: "full" },
      { field: "first_mes", label: "First Message", support: "full" },
      { field: "mes_example", label: "Example Dialogs", support: "full" },
      { field: "system_prompt", label: "System Prompt", support: "full" },
      { field: "post_history_instructions", label: "Post-History", support: "full" },
      { field: "alternate_greetings", label: "Alternate Greetings", support: "full" },
      { field: "character_book", label: "Lorebook", support: "full" },
      { field: "tags", label: "Tags", support: "full" },
      { field: "creator", label: "Creator", support: "full" },
      { field: "creator_notes", label: "Creator Notes", support: "full" },
      { field: "character_version", label: "Version", support: "full" },
    ],
  },

  generic: {
    id: "generic",
    name: "Generic / Other",
    color: "bg-zinc-800/60",
    textColor: "text-zinc-300",
    borderColor: "border-zinc-600/50",
    description: "Plain JSON fallback — basic fields only",
    pngSupport: true,
    jsonSupport: true,
    metadataKey: "character",
    templateVars: { user: "{{user}}", char: "{{char}}" },
    importKeys: ["name", "description"],
    fields: [
      { field: "name", label: "Name", support: "full" },
      { field: "description", label: "Description", support: "full" },
      { field: "personality", label: "Personality", support: "partial" },
      { field: "scenario", label: "Scenario", support: "partial" },
      { field: "first_mes", label: "First Message", support: "partial" },
      { field: "mes_example", label: "Example Dialogs", support: "partial" },
      { field: "system_prompt", label: "System Prompt", support: "none" },
      { field: "post_history_instructions", label: "Post-History", support: "none" },
      { field: "alternate_greetings", label: "Alternate Greetings", support: "none" },
      { field: "character_book", label: "Lorebook", support: "none" },
      { field: "tags", label: "Tags", support: "partial" },
      { field: "creator", label: "Creator", support: "partial" },
      { field: "creator_notes", label: "Creator Notes", support: "none" },
      { field: "character_version", label: "Version", support: "none" },
    ],
  },
};

export const PLATFORM_LIST = Object.values(PLATFORMS);

export function detectPlatform(json: unknown): PlatformId {
  if (!json || typeof json !== "object") return "generic";
  const obj = json as Record<string, unknown>;

  if (obj.spec === "chara_card_v2" || obj.spec === "chara_card_v1") {
    // Distinguish RisuAI vs SillyTavern vs Chub by extensions
    if (obj.data && typeof obj.data === "object") {
      const data = obj.data as Record<string, unknown>;
      const ext = data.extensions as Record<string, unknown> | undefined;
      if (ext?.risuai || ext?.risu) return "risu";
      if (ext?.chub) return "chub";
    }
    return "sillytavern";
  }
  if (obj.kind === "character" && obj.persona && obj.sampleChat !== undefined) return "agnai";
  if (obj.persona !== undefined && obj.greeting !== undefined) return "janitorai";
  if (obj.aiName !== undefined || obj.basePrompt !== undefined || obj.initialMessage !== undefined) return "backyard";
  if (obj.name && obj.description && obj.first_mes !== undefined) return "venus";
  return "generic";
}

export function getConversionLosses(platform: PlatformDef): FieldSupport[] {
  return platform.fields.filter((f) => f.support === "none" || f.support === "partial");
}
