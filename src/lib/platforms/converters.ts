import type { TavernCardV2 } from "../../types";
import type { PlatformId } from "./index";
import { createBlankTavernCard } from "../cardFormats";

// ─── Master → Platform ───────────────────────────────────────────────────────

export function convertToSillyTavern(card: TavernCardV2): TavernCardV2 {
  return structuredClone(card);
}

export function convertToJanitorAI(card: TavernCardV2): Record<string, unknown> {
  const { data } = card;
  // JanitorAI uses {{bot}} instead of {{char}}
  const replaceVars = (s: string) => s.replace(/\{\{char\}\}/g, "{{bot}}");
  const persona = [data.description, data.personality].filter(Boolean).join("\n\n");
  return {
    name: data.name,
    persona: replaceVars(persona),
    world: data.scenario,
    scenario: data.scenario,
    greeting: replaceVars(data.first_mes),
    example_dialogs: replaceVars(data.mes_example),
    visibility: "public",
    tags: data.tags,
    nsfw: false,
  };
}

export function convertToChub(card: TavernCardV2): TavernCardV2 {
  const clone = structuredClone(card);
  clone.data.extensions = {
    ...clone.data.extensions,
    chub: {
      full_path: "",
      rating: "SFW",
      tagline: clone.data.description.slice(0, 120),
    },
  };
  return clone;
}

export function convertToAgnai(card: TavernCardV2): Record<string, unknown> {
  const { data } = card;
  return {
    kind: "character",
    name: data.name,
    description: data.description,
    persona: {
      kind: "text",
      attributes: {
        personality: [data.personality],
      },
    },
    sampleChat: data.mes_example,
    scenario: data.scenario,
    greeting: data.first_mes,
    systemPrompt: data.system_prompt,
    postHistoryInstructions: data.post_history_instructions,
    tags: data.tags,
    creator: data.creator,
    characterVersion: data.character_version,
  };
}

export function convertToVenus(card: TavernCardV2): Record<string, unknown> {
  const { data } = card;
  return {
    spec: "chara_card_v2",
    spec_version: "2.0",
    data: {
      name: data.name,
      description: data.description,
      personality: data.personality,
      scenario: data.scenario,
      first_mes: data.first_mes,
      mes_example: data.mes_example,
      tags: data.tags,
      alternate_greetings: data.alternate_greetings,
    },
  };
}

export function convertToBackyard(card: TavernCardV2): Record<string, unknown> {
  const { data } = card;
  const basePrompt = [data.description, data.personality].filter(Boolean).join("\n\n");
  return {
    aiName: data.name,
    basePrompt,
    scenario: data.scenario,
    initialMessage: data.first_mes,
    systemPrompt: data.system_prompt || undefined,
    type: "character",
  };
}

export function convertToRisu(card: TavernCardV2): TavernCardV2 {
  const clone = structuredClone(card);
  clone.data.extensions = {
    ...clone.data.extensions,
    risuai: {
      assets: [],
    },
  };
  return clone;
}

export function convertToGeneric(card: TavernCardV2): Record<string, unknown> {
  const { data } = card;
  return {
    name: data.name,
    description: data.description,
    personality: data.personality,
    scenario: data.scenario,
    first_message: data.first_mes,
    example_dialogs: data.mes_example,
    system_prompt: data.system_prompt || undefined,
    tags: data.tags,
    creator: data.creator || undefined,
    version: data.character_version,
  };
}

// ─── Platform → Master ───────────────────────────────────────────────────────

export function convertFromJanitorAI(obj: Record<string, unknown>): TavernCardV2 {
  const card = createBlankTavernCard(String(obj.name ?? ""));
  const replaceVars = (s: string) => s.replace(/\{\{bot\}\}/g, "{{char}}");
  card.data.description = String(obj.persona ?? "");
  card.data.scenario = String(obj.world ?? obj.scenario ?? "");
  card.data.first_mes = replaceVars(String(obj.greeting ?? ""));
  card.data.mes_example = replaceVars(String(obj.example_dialogs ?? ""));
  card.data.tags = Array.isArray(obj.tags) ? obj.tags.map(String) : [];
  return card;
}

export function convertFromAgnai(obj: Record<string, unknown>): TavernCardV2 {
  const card = createBlankTavernCard(String(obj.name ?? ""));
  card.data.description = String(obj.description ?? "");
  const persona = obj.persona as Record<string, unknown> | undefined;
  const attrs = persona?.attributes as Record<string, unknown> | undefined;
  const personalityArr = attrs?.personality;
  card.data.personality = Array.isArray(personalityArr) ? String(personalityArr[0] ?? "") : "";
  card.data.scenario = String(obj.scenario ?? "");
  card.data.first_mes = String(obj.greeting ?? "");
  card.data.mes_example = String(obj.sampleChat ?? "");
  card.data.system_prompt = String(obj.systemPrompt ?? "");
  card.data.post_history_instructions = String(obj.postHistoryInstructions ?? "");
  card.data.tags = Array.isArray(obj.tags) ? obj.tags.map(String) : [];
  card.data.creator = String(obj.creator ?? "");
  card.data.character_version = String(obj.characterVersion ?? "1.0");
  return card;
}

export function convertFromBackyard(obj: Record<string, unknown>): TavernCardV2 {
  const card = createBlankTavernCard(String(obj.aiName ?? obj.name ?? ""));
  card.data.description = String(obj.basePrompt ?? obj.description ?? "");
  card.data.scenario = String(obj.scenario ?? "");
  card.data.first_mes = String(obj.initialMessage ?? obj.first_mes ?? "");
  card.data.system_prompt = String(obj.systemPrompt ?? "");
  return card;
}

// ─── Dispatcher ──────────────────────────────────────────────────────────────

export function convertCardTo(
  card: TavernCardV2,
  platformId: PlatformId
): Record<string, unknown> {
  switch (platformId) {
    case "sillytavern": return convertToSillyTavern(card) as unknown as Record<string, unknown>;
    case "janitorai":   return convertToJanitorAI(card);
    case "chub":        return convertToChub(card) as unknown as Record<string, unknown>;
    case "agnai":       return convertToAgnai(card);
    case "venus":       return convertToVenus(card);
    case "backyard":    return convertToBackyard(card);
    case "risu":        return convertToRisu(card) as unknown as Record<string, unknown>;
    case "generic":     return convertToGeneric(card);
  }
}

export function convertCardFrom(
  obj: Record<string, unknown>,
  platformId: PlatformId
): TavernCardV2 {
  switch (platformId) {
    case "janitorai":  return convertFromJanitorAI(obj);
    case "agnai":      return convertFromAgnai(obj);
    case "backyard":   return convertFromBackyard(obj);
    default: {
      // SillyTavern, Chub, Venus, RisuAI, Generic — all basically Tavern v2 shape
      if (obj.spec === "chara_card_v2") return obj as unknown as TavernCardV2;
      // Fallback: try to map common field names
      const card = createBlankTavernCard(String(obj.name ?? ""));
      card.data.description = String(obj.description ?? "");
      card.data.personality = String(obj.personality ?? "");
      card.data.scenario = String(obj.scenario ?? "");
      card.data.first_mes = String(obj.first_mes ?? obj.first_message ?? "");
      card.data.mes_example = String(obj.mes_example ?? obj.example_dialogs ?? "");
      card.data.system_prompt = String(obj.system_prompt ?? "");
      card.data.tags = Array.isArray(obj.tags) ? obj.tags.map(String) : [];
      card.data.creator = String(obj.creator ?? "");
      return card;
    }
  }
}
