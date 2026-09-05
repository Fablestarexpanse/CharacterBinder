import type { TavernCardV2, ValidationResult } from "../../types";

/** Fields the v2 spec requires to be present on `data`, with their expected shape. */
const REQUIRED_STRING_FIELDS = [
  "name",
  "description",
  "personality",
  "scenario",
  "first_mes",
  "mes_example",
  "creator_notes",
  "system_prompt",
  "post_history_instructions",
  "creator",
  "character_version",
] as const;

const REQUIRED_ARRAY_FIELDS = ["alternate_greetings", "tags"] as const;

/**
 * Checks a card against the Tavern Card v2 spec.
 *
 * This gates export when auto-validate is on, so it has to be more than a
 * required-fields check: a card whose `tags` is a string rather than an array,
 * or which is missing `data` entirely, used to sail through here and then break
 * somewhere less obvious — the compatibility panel, the library write, or a
 * platform converter mid-export.
 */
export function validateTavernCardV2(card: TavernCardV2): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!card || typeof card !== "object") {
    return { valid: false, errors: ["Card is missing or not an object"], warnings };
  }
  if (card.spec !== "chara_card_v2") errors.push("Invalid spec — expected 'chara_card_v2'");
  if (card.spec_version !== "2.0") errors.push("Invalid spec_version — expected '2.0'");

  const data = card.data as TavernCardV2["data"] | undefined;
  if (!data || typeof data !== "object") {
    errors.push("Card has no 'data' block");
    return { valid: false, errors, warnings };
  }

  // Content requirements. Read through a guard rather than calling .trim()
  // directly — a field holding a number would otherwise throw here, before the
  // type check below ever got the chance to report it properly.
  const str = (field: keyof TavernCardV2["data"]): string =>
    typeof data[field] === "string" ? (data[field] as string) : "";

  if (!str("name").trim()) errors.push("Name is required");
  if (!str("description").trim()) errors.push("Description is required");
  if (!str("first_mes").trim()) warnings.push("First message is empty — consider adding a greeting");
  if (!str("personality").trim()) warnings.push("Personality is empty");
  if (str("name").length > 100) warnings.push("Name is very long (>100 chars)");
  if (str("description").length > 50000) {
    warnings.push("Description is very long — may affect performance");
  }

  // Shape requirements. A wrong type here is what breaks things downstream.
  for (const field of REQUIRED_STRING_FIELDS) {
    const value = data[field];
    if (value === undefined) warnings.push(`Missing '${field}' — the v2 spec expects it, even if empty`);
    else if (typeof value !== "string") errors.push(`'${field}' must be a string, got ${typeof value}`);
  }

  for (const field of REQUIRED_ARRAY_FIELDS) {
    const value = data[field];
    if (value === undefined) warnings.push(`Missing '${field}' — the v2 spec expects an array`);
    else if (!Array.isArray(value)) errors.push(`'${field}' must be an array, got ${typeof value}`);
    else if (value.some((v) => typeof v !== "string")) errors.push(`'${field}' must contain only strings`);
  }

  if (data.extensions !== undefined && (typeof data.extensions !== "object" || data.extensions === null || Array.isArray(data.extensions))) {
    errors.push("'extensions' must be an object");
  }

  // Lorebook, if one is attached
  const book = data.character_book;
  if (book !== undefined) {
    if (typeof book !== "object" || book === null || Array.isArray(book)) {
      errors.push("'character_book' must be an object");
    } else if (!Array.isArray(book.entries)) {
      errors.push("'character_book.entries' must be an array");
    } else {
      book.entries.forEach((entry, i) => {
        if (!entry || typeof entry !== "object") {
          errors.push(`Lorebook entry ${i + 1} is not an object`);
          return;
        }
        if (!Array.isArray(entry.keys)) errors.push(`Lorebook entry ${i + 1}: 'keys' must be an array`);
        else if (!entry.keys.length) warnings.push(`Lorebook entry ${i + 1} has no trigger keys and will never fire`);
        if (typeof entry.content !== "string") errors.push(`Lorebook entry ${i + 1}: 'content' must be a string`);
        else if (!entry.content.trim()) warnings.push(`Lorebook entry ${i + 1} has no content`);
      });
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/** Same result shape as validateTavernCardV2, so callers read both the same way. */
export function validateJson(jsonStr: string): ValidationResult {
  try {
    JSON.parse(jsonStr);
    return { valid: true, errors: [], warnings: [] };
  } catch (e) {
    return { valid: false, errors: [(e as Error).message], warnings: [] };
  }
}
