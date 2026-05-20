import type {
  TavernCardV2,
  JanitorAICharacter,
  RPBuddyCharacter,
  AgnaiCharacter,
  GenericCharacterCard,
} from "../../types";

export function createBlankTavernCard(name = ""): TavernCardV2 {
  return {
    spec: "chara_card_v2",
    spec_version: "2.0",
    data: {
      name,
      description: "",
      personality: "",
      scenario: "",
      first_mes: "",
      mes_example: "",
      creator_notes: "",
      system_prompt: "",
      post_history_instructions: "",
      alternate_greetings: [],
      tags: [],
      creator: "",
      character_version: "1.0",
      extensions: {},
    },
  };
}

export function tavernToJanitor(card: TavernCardV2): JanitorAICharacter {
  return {
    name: card.data.name,
    persona: card.data.description,
    world: card.data.scenario,
    scenario: card.data.scenario,
    greeting: card.data.first_mes,
    example_dialogs: card.data.mes_example,
    visibility: "public",
    tags: card.data.tags,
    nsfw: false,
  };
}

export function tavernToRPBuddy(card: TavernCardV2): RPBuddyCharacter {
  return {
    name: card.data.name,
    description: card.data.description,
    personality: card.data.personality,
    scenario: card.data.scenario,
    greeting: card.data.first_mes,
    example_dialogs: card.data.mes_example,
    system_prompt: card.data.system_prompt,
    tags: card.data.tags,
    version: card.data.character_version,
  };
}

export function tavernToAgnai(card: TavernCardV2): AgnaiCharacter {
  return {
    kind: "character",
    name: card.data.name,
    description: card.data.description,
    persona: {
      kind: "text",
      attributes: {
        personality: [card.data.personality],
      },
    },
    sampleChat: card.data.mes_example,
    scenario: card.data.scenario,
    greeting: card.data.first_mes,
    systemPrompt: card.data.system_prompt,
    postHistoryInstructions: card.data.post_history_instructions,
    tags: card.data.tags,
    creator: card.data.creator,
    characterVersion: card.data.character_version,
  };
}

export function tavernToGeneric(card: TavernCardV2): GenericCharacterCard {
  return {
    name: card.data.name,
    description: card.data.description,
    personality: card.data.personality,
    scenario: card.data.scenario,
    first_message: card.data.first_mes,
    example_dialogs: card.data.mes_example,
    system_prompt: card.data.system_prompt,
    tags: card.data.tags,
    creator: card.data.creator,
    version: card.data.character_version,
  };
}

export function janitorToTavern(j: JanitorAICharacter): TavernCardV2 {
  const card = createBlankTavernCard(j.name);
  card.data.description = j.persona;
  card.data.scenario = j.scenario ?? "";
  card.data.first_mes = j.greeting ?? "";
  card.data.mes_example = j.example_dialogs ?? "";
  card.data.tags = j.tags ?? [];
  return card;
}

export function genericToTavern(g: GenericCharacterCard): TavernCardV2 {
  const card = createBlankTavernCard(g.name);
  card.data.description = g.description;
  card.data.personality = g.personality ?? "";
  card.data.scenario = g.scenario ?? "";
  card.data.first_mes = g.first_message ?? "";
  card.data.mes_example = g.example_dialogs ?? "";
  card.data.system_prompt = g.system_prompt ?? "";
  card.data.tags = g.tags ?? [];
  card.data.creator = g.creator ?? "";
  card.data.character_version = g.version ?? "1.0";
  return card;
}

export function autoParseCard(json: unknown): TavernCardV2 | null {
  if (!json || typeof json !== "object") return null;
  const obj = json as Record<string, unknown>;

  // Already Tavern v2
  if (obj.spec === "chara_card_v2") return obj as unknown as TavernCardV2;

  // Tavern v1 style
  if (obj.name && obj.description && !obj.spec) {
    return genericToTavern(obj as unknown as GenericCharacterCard);
  }

  // JanitorAI
  if (obj.persona && !obj.spec) {
    return janitorToTavern(obj as unknown as JanitorAICharacter);
  }

  return null;
}
