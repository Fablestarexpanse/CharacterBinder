import { encode } from "gpt-tokenizer";
import type { TavernCardV2 } from "../../types";

export function countTokens(text: string): number {
  if (!text) return 0;
  return encode(text).length;
}

export interface CardTokenBreakdown {
  description: number;
  personality: number;
  scenario: number;
  first_mes: number;
  mes_example: number;
  system_prompt: number;
  post_history_instructions: number;
  alternate_greetings: number;
  creator_notes: number;
  total: number;
}

export function getCardTokenBreakdown(card: TavernCardV2): CardTokenBreakdown {
  const d = card.data;
  const greetingTokens = (d.alternate_greetings ?? []).reduce(
    (sum, g) => sum + countTokens(g),
    0
  );

  const description = countTokens(d.description);
  const personality = countTokens(d.personality);
  const scenario = countTokens(d.scenario);
  const first_mes = countTokens(d.first_mes);
  const mes_example = countTokens(d.mes_example);
  const system_prompt = countTokens(d.system_prompt);
  const post_history_instructions = countTokens(d.post_history_instructions);
  const alternate_greetings = greetingTokens;
  const creator_notes = countTokens(d.creator_notes);

  return {
    description,
    personality,
    scenario,
    first_mes,
    mes_example,
    system_prompt,
    post_history_instructions,
    alternate_greetings,
    creator_notes,
    total:
      description +
      personality +
      scenario +
      first_mes +
      mes_example +
      system_prompt +
      post_history_instructions +
      alternate_greetings +
      creator_notes,
  };
}

export type TokenBudgetLevel = "low" | "medium" | "high" | "over";

export function getTokenBudgetLevel(total: number): TokenBudgetLevel {
  if (total <= 1000) return "low";
  if (total <= 2000) return "medium";
  if (total <= 3000) return "high";
  return "over";
}

export const TOKEN_BUDGET_LABELS: Record<TokenBudgetLevel, string> = {
  low: "Lightweight",
  medium: "Moderate",
  high: "Heavy",
  over: "Very Large",
};

export const TOKEN_BUDGET_COLORS: Record<TokenBudgetLevel, string> = {
  low: "text-status-ok",
  medium: "text-status-warn",
  high: "text-status-warn",
  over: "text-status-danger",
};

export const TOKEN_BUDGET_BAR_COLORS: Record<TokenBudgetLevel, string> = {
  low: "bg-status-ok",
  medium: "bg-status-warn",
  high: "bg-status-warn",
  over: "bg-status-danger",
};
