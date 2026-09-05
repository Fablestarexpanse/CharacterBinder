/**
 * What the model is asked, and the schema its answer is constrained to.
 *
 * Decoding is schema-constrained, so the prompt's job is not to beg for JSON —
 * it is to say what each field means and to insist the author's own wording
 * comes across intact.
 */

import type { CardField } from "../../shared/cardTextParser";

/**
 * What each target shape asks the model for. Personas want appearance and
 * background; character cards fold those into description and want scenario,
 * greeting, and example dialogue instead.
 */
export type SortTarget = "persona" | "character";

const FIELD_DOCS: Record<CardField, string> = {
  name: "just the subject's name. It is usually the subject of the opening sentence, or the first proper noun in the text. Return an empty string only if the text genuinely never names them.",
  appearance: "physical description — build, height, hair, eyes, skin, scars, clothing, how they carry themselves.",
  personality: "temperament, manner, habits, likes/dislikes, how they treat people, speech style.",
  background: "history, origin, family, occupation, training, notable past events.",
  scenario: "the setting or situation the character exists in — where this takes place and what is going on.",
  first_mes: "the opening message the character sends to start a conversation. Only fill this if the text actually contains one.",
  mes_example: "sample dialogue exchanges, if the text contains any. Otherwise an empty string.",
  description: "who they are at a glance, plus leftover facts that fit no other field (age, gender, species, job title, relationships, stats).",
  creator: "the card's author, if stated.",
  creator_notes: "notes aimed at whoever uses the card, if stated.",
};

/** Which fields each card kind is sorted into. */
export const TARGET_FIELDS: Record<SortTarget, CardField[]> = {
  persona: ["name", "description", "personality", "appearance", "background"],
  character: ["name", "description", "personality", "scenario", "first_mes", "mes_example"],
};

/** All keys required so the grammar forces every one to be emitted (possibly ""). */
export function buildSchema(target: SortTarget): string {
  const properties: Record<string, unknown> = {};
  for (const f of TARGET_FIELDS[target]) properties[f] = { type: "string" };
  properties.tags = { type: "array", items: { type: "string" } };
  return JSON.stringify({
    type: "object",
    properties,
    required: [...TARGET_FIELDS[target], "tags"],
    additionalProperties: false,
  });
}

export function buildSystemPrompt(target: SortTarget): string {
  const fields = TARGET_FIELDS[target].map((f) => `- ${f}: ${FIELD_DOCS[f]}`).join("\n");
  const descriptionRule =
    target === "character"
      ? `5. Each fact goes in ONE field only. Physical appearance and backstory belong in description for a character card — there are no separate fields for them. Never copy the whole input into description if other fields already cover it.`
      : `5. Each fact goes in ONE field only. Never restate in description anything you already placed in appearance, personality, or background. Never copy the whole input into description — if the other fields cover everything, description is a short summary or an empty string.`;

  return `You sort raw character/persona text into structured fields. You are an extractor, not a writer.

Fields:
${fields}
- tags: short lowercase keywords, only if the text supplies them or they are obvious. Otherwise an empty array.

Rules:
1. Copy the author's own wording. Do not rewrite, summarise, censor, or embellish.
2. Split sentences when they cover more than one field. "Kael is a blunt, wiry man born in Anvale" becomes appearance "wiry", personality "blunt", background "born in Anvale".
3. Never invent detail that is not in the input.
4. Lose nothing. Every fact in the input must appear in exactly one field.
${descriptionRule}
6. A field with nothing to say gets an empty string.
7. Keep the input's language and point of view.
8. Do NOT summarise. Do NOT compress the author's prose into keyword lists. Your fields together should be about as long as the input — you are moving sentences into the right buckets, not shortening them. If the input has a four-paragraph appearance section, that text still all has to land somewhere.`;
}

export function buildUserPrompt(text: string): string {
  return `Sort this text into the fields.\n\n<card_text>\n${text}\n</card_text>`;
}
