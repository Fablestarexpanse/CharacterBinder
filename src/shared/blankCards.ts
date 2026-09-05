/**
 * Empty cards, and how to build a valid one from an untrusted body.
 *
 * The editors each held their own `DEFAULT` literal, so "what a blank scenario
 * card is" had one definition per editor plus none at all for the MCP bridge —
 * which instead stored whatever object an agent sent, unchecked, under a type
 * that claimed it was a ScenarioCard. Both problems are the same missing piece:
 * one place that says what each card kind is made of.
 */

import type { LoreBook, PersonaCard, ScenarioCard, ScriptCard, LibraryCardType, RawCardFor, TavernCardV2 } from "../types";
import { parseLorebook } from "./lorebook";
import { createBlankTavernCard } from "./tavernCard";

export const blankScriptCard = (): ScriptCard => ({
  spec: "script_card_v1",
  name: "",
  description: "",
  content: "",
  tags: [],
  creator: "",
  version: "1.0",
  creator_notes: "",
});

export const blankScenarioCard = (): ScenarioCard => ({
  spec: "scenario_card_v1",
  name: "",
  description: "",
  scenario: "",
  first_mes: "",
  tags: [],
  creator: "",
  version: "1.0",
  creator_notes: "",
});

export const blankPersonaCard = (): PersonaCard => ({
  spec: "persona_card_v1",
  name: "",
  description: "",
  personality: "",
  appearance: "",
  background: "",
  tags: [],
  creator: "",
  version: "1.0",
  creator_notes: "",
});

export const blankLoreBook = (): LoreBook => parseLorebook({});

/** Keep a string field, dropping anything that isn't one. */
const str = (v: unknown, fallback: string): string => (typeof v === "string" ? v : fallback);
const strList = (v: unknown, fallback: string[]): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : fallback;

/**
 * Build a card of `cardType` from an arbitrary object, keeping only the fields
 * that kind actually has and only where the value has the right type.
 *
 * Anything else — an unknown key, a number where a string belongs — is dropped
 * rather than stored, so a card read back from the library always matches the
 * type the library says it holds.
 */
export function coerceCardBody<T extends Exclude<LibraryCardType, "character">>(
  cardType: T,
  raw: unknown
): RawCardFor<T> {
  if (cardType === "lorebook") {
    return parseLorebook(raw) as RawCardFor<T>;
  }

  const body: Record<string, unknown> =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  const blank =
    cardType === "script" ? blankScriptCard()
    : cardType === "scenario" ? blankScenarioCard()
    : blankPersonaCard();

  const out: Record<string, unknown> = { ...blank };
  // Script cards stored `author` before the field was renamed to match every
  // other kind; read it so an existing card still opens with its creator.
  if (cardType === "script" && body.creator === undefined && typeof body.author === "string") {
    out.creator = body.author;
  }
  for (const [key, fallback] of Object.entries(blank)) {
    if (key === "spec") continue; // the spec identifies the kind; a body may not change it
    if (!(key in body)) continue;
    out[key] = Array.isArray(fallback)
      ? strList(body[key], fallback as string[])
      : str(body[key], fallback as string);
  }
  return out as unknown as RawCardFor<T>;
}

/**
 * Build the `data` block of a character card from an arbitrary object, keeping
 * only the v2 fields and only where the value has the right type — so a card
 * read back always matches the type the library says it holds.
 */
export function coerceCharacterData(body: Record<string, unknown>): TavernCardV2["data"] {
  const blank = createBlankTavernCard().data;
  const out: Record<string, unknown> = { ...blank };

  for (const [key, fallback] of Object.entries(blank)) {
    if (!(key in body)) continue;
    const value = body[key];
    if (key === "extensions") {
      // Free-form by spec, but it must at least be an object.
      if (value && typeof value === "object" && !Array.isArray(value)) out[key] = value;
      continue;
    }
    out[key] = Array.isArray(fallback)
      ? strList(value, fallback as string[])
      : str(value, fallback as string);
  }

  // character_book is optional, so it is not on the blank card the loop walks —
  // and dropping it would silently strip a character's embedded lorebook on
  // every bridge write.
  if (body.character_book && typeof body.character_book === "object" && !Array.isArray(body.character_book)) {
    out.character_book = body.character_book;
  }

  return out as unknown as TavernCardV2["data"];
}
