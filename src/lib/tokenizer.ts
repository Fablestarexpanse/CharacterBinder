import type { TavernCardV2 } from "../types";

/**
 * Token counting for the budget badges.
 *
 * cl100k, not the newer o200k the package exports by default: its BPE table is
 * 1.06 MB against 2.22 MB, and these counts are an estimate shown beside each
 * field — every target platform runs a different model with a different
 * tokenizer anyway.
 *
 * Even 1.06 MB is too much to put in the chunk every visitor downloads before
 * seeing anything, so the table is fetched after first paint. Until it lands,
 * counts come from a character-based approximation and the badges say so.
 */

let encode: ((text: string) => number[]) | null = null;
const listeners = new Set<() => void>();

/** Roughly four characters per token for English prose. */
function estimate(text: string): number {
  return Math.ceil(text.length / 4);
}

let loading: Promise<void> | null = null;
function loadEncoder(): void {
  loading ??= import("gpt-tokenizer/encoding/cl100k_base").then((mod) => {
    encode = mod.encode;
    for (const fn of listeners) fn();
  });
}

/**
 * Resolves once counts are exact. The app does not wait on this — the badges
 * correct themselves — but a test asserting real token counts must.
 */
export function whenTokenizerReady(): Promise<void> {
  loadEncoder();
  return loading!;
}

/** True once counts are exact rather than approximate. */
export function isTokenizerReady(): boolean {
  return encode !== null;
}

/** Called when the real encoder arrives, so displayed counts can be corrected. */
export function subscribeTokenizer(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function countTokens(text: string): number {
  if (!text) return 0;
  if (!encode) {
    loadEncoder();
    return estimate(text);
  }
  return encode(text).length;
}

// Start fetching as soon as the app is running, so the approximation is only
// ever on screen briefly.
if (typeof window !== "undefined") {
  const idle = window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 200));
  idle(() => loadEncoder());
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
