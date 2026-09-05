import type { TavernCardV2 } from "../types";

export interface CustomTemplate {
  id: string;
  name: string;
  description: string;
  card: TavernCardV2;
  createdAt: number;
}

const KEY = "cb_custom_templates";

function load(): CustomTemplate[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    // Anything but an array here reaches a .map() or .filter() in the caller
    // and takes the Templates page down with it.
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (t): t is CustomTemplate =>
        !!t && typeof t === "object" && typeof (t as CustomTemplate).id === "string" && !!(t as CustomTemplate).card
    );
  } catch {
    return [];
  }
}

/**
 * Writes throw rather than failing silently. Settings that do not survive a
 * reload are an annoyance; a template the user saved and then cannot find is
 * lost work, so the caller has to be able to say it did not happen.
 */
function persist(templates: CustomTemplate[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(templates));
  } catch (err) {
    throw new Error(
      "This browser refused to store the template — its storage may be full or blocked for this site.",
      { cause: err }
    );
  }
}

export function getCustomTemplates(): CustomTemplate[] {
  return load();
}

export function saveCustomTemplate(card: TavernCardV2, description?: string): CustomTemplate {
  const templates = load();
  const tpl: CustomTemplate = {
    id: crypto.randomUUID(),
    name: card.data.name || "Unnamed Template",
    description: description || card.data.description.slice(0, 80) || "Custom template",
    card,
    createdAt: Date.now(),
  };
  persist([...templates, tpl]);
  return tpl;
}

export function deleteCustomTemplate(id: string) {
  persist(load().filter((t) => t.id !== id));
}
