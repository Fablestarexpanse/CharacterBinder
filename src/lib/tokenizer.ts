// cl100k, not the newer o200k the package exports by default: its BPE table is
// 1.06 MB against 2.22 MB, and it made up most of the entry chunk. The counts
// here are a budget estimate shown next to each field — every target platform
// runs a different model with a different tokenizer anyway, so the extra
// megabyte bought no accuracy that means anything to the user.
import { encode } from "gpt-tokenizer/encoding/cl100k_base";
import type { TavernCardV2 } from "../types";

export function countTokens(text: string): number {
  if (!text) return 0;
  return encode(text).length;
}

/**
 * The card fields that count against the prompt budget, in the order the UI
 * shows them. Listed once: the breakdown type, the counting and the total are
 * all derived from it, so a field cannot be counted but left out of the total.
 */
export const COUNTED_FIELDS = [
  "description",
  "personality",
  "scenario",
  "first_mes",
  "mes_example",
  "system_prompt",
  "post_history_instructions",
  "creator_notes",
] as const;

export type CountedField = (typeof COUNTED_FIELDS)[number];

export type CardTokenBreakdown = Record<CountedField, number> & {
  /** Summed across the array, not a single field. */
  alternate_greetings: number;
  total: number;
};

export function getCardTokenBreakdown(card: TavernCardV2): CardTokenBreakdown {
  const d = card.data;
  const counts = {} as Record<CountedField, number>;
  for (const field of COUNTED_FIELDS) counts[field] = countTokens(d[field]);

  const alternate_greetings = (d.alternate_greetings ?? []).reduce(
    (sum, g) => sum + countTokens(g),
    0
  );
  const total =
    Object.values(counts).reduce((sum, n) => sum + n, 0) + alternate_greetings;

  return { ...counts, alternate_greetings, total };
}

export type TokenBudgetLevel = "low" | "medium" | "high" | "over";

/**
 * The top of the budget: past this a card is "Very Large", and the meters that
 * draw a fill percentage treat it as full. Exported so the meters and the level
 * thresholds cannot disagree — the number was restated in two components.
 */
export const TOKEN_BUDGET_MAX = 3000;

export function getTokenBudgetLevel(total: number): TokenBudgetLevel {
  if (total <= 1000) return "low";
  if (total <= 2000) return "medium";
  if (total <= TOKEN_BUDGET_MAX) return "high";
  return "over";
}

/** How full the budget meter should be drawn, 0-100. */
export function tokenBudgetPercent(total: number): number {
  return Math.min((total / TOKEN_BUDGET_MAX) * 100, 100);
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
