import type { TavernCardV2, ValidationResult } from "../../types";

export function validateTavernCardV2(card: TavernCardV2): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!card.data.name?.trim()) errors.push("Name is required");
  if (!card.data.description?.trim()) errors.push("Description is required");
  if (!card.data.first_mes?.trim()) warnings.push("First message is empty — consider adding a greeting");
  if (!card.data.personality?.trim()) warnings.push("Personality is empty");
  if (card.data.name?.length > 100) warnings.push("Name is very long (>100 chars)");
  if (card.data.description?.length > 50000) warnings.push("Description is very long — may affect performance");
  if (card.spec !== "chara_card_v2") errors.push("Invalid spec — expected 'chara_card_v2'");
  if (card.spec_version !== "2.0") errors.push("Invalid spec_version — expected '2.0'");

  return { valid: errors.length === 0, errors, warnings };
}

export function validateJson(jsonStr: string): { valid: boolean; error?: string } {
  try {
    JSON.parse(jsonStr);
    return { valid: true };
  } catch (e) {
    return { valid: false, error: (e as Error).message };
  }
}

