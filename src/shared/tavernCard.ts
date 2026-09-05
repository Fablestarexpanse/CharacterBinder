import type { TavernCardV2 } from "../types";

/** An empty, spec-valid Tavern Card v2 — the starting shape for every import path. */
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
