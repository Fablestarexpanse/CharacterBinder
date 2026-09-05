/**
 * Works out what a decoded card payload actually *is*, from its own shape.
 *
 * The PNG metadata keyword says what a file claims to be, and the import path
 * used to trust it completely. That breaks whenever the two disagree — most
 * easily when a lorebook is exported from the character panel and lands under
 * the `chara` key. The importer then built a blank character card from `name`
 * and `description`, discarded every lorebook entry, and reported success.
 *
 * Shape is the more reliable signal, so we check it and let the caller reconcile.
 */

import type { LibraryCardType } from "../types";



/** Metadata keywords that are meant to carry a character card. */
export const CHARACTER_KEYS = new Set(["chara", "character", "tavern", "tavern_card_v2"]);

/** The card type a given metadata keyword claims. */
export function shapeForKey(key: string): LibraryCardType | null {
  if (CHARACTER_KEYS.has(key)) return "character";
  if (key === "lorebook" || key === "script" || key === "scenario" || key === "persona") {
    return key;
  }
  return null;
}

function hasEntries(obj: Record<string, unknown>): boolean {
  const e = obj.entries;
  return Array.isArray(e) || (!!e && typeof e === "object");
}

/**
 * Best guess at what this payload is, or null when nothing distinguishes it.
 * `spec` is authoritative when present; otherwise we look for the field that
 * only one card type has.
 */
export function detectCardShape(parsed: unknown): LibraryCardType | null {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const obj = parsed as Record<string, unknown>;

  const spec = typeof obj.spec === "string" ? obj.spec : "";
  if (spec === "persona_card_v1") return "persona";
  if (spec === "script_card_v1") return "script";
  if (spec === "scenario_card_v1") return "scenario";
  if (spec === "chara_card_v2" || spec === "chara_card_v3") return "character";
  if (spec.startsWith("lorebook")) return "lorebook";

  // Structural tells, most distinctive first.
  if (hasEntries(obj)) return "lorebook";
  if (typeof obj.content === "string" && !("first_mes" in obj) && !("description" in obj)) {
    return "script";
  }
  if (obj.data && typeof obj.data === "object") return "character";
  if ("first_mes" in obj || "greeting" in obj || "persona" in obj) return "character";
  if ("appearance" in obj || "background" in obj) return "persona";
  if ("scenario" in obj && !("personality" in obj)) return "scenario";

  return null;
}

/**
 * Reconcile what a file says it is with what it contains.
 *
 * Both import paths need this and got it separately: Import PNG trusted the
 * payload, Decode PNG trusted the keyword, so the same file could open as a
 * lorebook in one and an empty character card in the other.
 */
export function effectiveShape(key: string, parsed: unknown): {
  shape: LibraryCardType | null;
  claimed: LibraryCardType | null;
  actual: LibraryCardType | null;
  /** The keyword and the payload disagree; the payload wins and the UI says so. */
  mismatch: boolean;
} {
  const claimed = shapeForKey(key);
  const actual = detectCardShape(parsed);
  const mismatch = actual !== null && claimed !== null && actual !== claimed;
  return { shape: mismatch ? actual : claimed, claimed, actual, mismatch };
}
