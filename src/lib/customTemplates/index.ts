import type { TavernCardV2 } from "../../types";

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
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

function persist(templates: CustomTemplate[]) {
  localStorage.setItem(KEY, JSON.stringify(templates));
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
