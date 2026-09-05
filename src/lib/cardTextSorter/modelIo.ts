/**
 * What goes into the model and what comes back out.
 *
 * Both halves are pure and both handle untrusted input — a persona of any
 * length on the way in, whatever a 1.5B model emits on the way out — so they
 * live apart from the engine lifecycle and are tested directly.
 */

import { countTokens } from "../tokenizer";

export const CONTEXT_TOKENS = 8192;
export const MAX_OUTPUT_TOKENS = 3000;
/** Room the generated JSON and the system prompt need inside the window. */
const RESERVED_TOKENS = MAX_OUTPUT_TOKENS + 500;

/**
 * Trim a persona to what fits in the model's context window.
 *
 * The cut walks back to a paragraph edge, so the model is not handed half a
 * sentence, and the caller is told it happened so the user can be told too.
 */
export function budgetInput(text: string): { text: string; truncated: boolean } {
  const limit = CONTEXT_TOKENS - RESERVED_TOKENS;
  if (countTokens(text) <= limit) return { text, truncated: false };

  // Trim by characters, then walk back to a paragraph edge so we don't cut mid-thought.
  let slice = text;
  while (slice.length > 200 && countTokens(slice) > limit) {
    slice = slice.slice(0, Math.floor(slice.length * 0.9));
  }
  const lastBreak = slice.lastIndexOf("\n\n");
  if (lastBreak > slice.length * 0.5) slice = slice.slice(0, lastBreak);
  return { text: slice.trim(), truncated: true };
}

/**
 * The JSON object in a model reply, or null when there isn't one.
 *
 * Decoding is schema-constrained, so a well-behaved model returns bare JSON —
 * but an endpoint the user points at may be any server at all, and those wrap
 * replies in code fences or prose. A reply parsed as an array is not the answer
 * itself — the schema describes an object of fields — but the brace slice below
 * still recovers an object wrapped in one.
 */
export function coerceJson(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const candidates = [trimmed];

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) candidates.push(fenced[1]);

  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first !== -1 && last > first) candidates.push(trimmed.slice(first, last + 1));

  for (const c of candidates) {
    try {
      const parsed = JSON.parse(c);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      /* try the next shape */
    }
  }
  return null;
}
