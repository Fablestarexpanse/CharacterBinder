/**
 * The two lorebook shapes, and the conversions between them.
 *
 * Inside the app an entry is identified by a stable UUID, because the editor
 * selects, patches and reorders entries by identity. The interchange format
 * SillyTavern and its relatives read identifies entries by their position
 * instead, and accepts `entries` as either an array or an object keyed by
 * numeric strings.
 *
 * Keeping both shapes under one name is what let a positional export be stored
 * as if it were an internal book: reopening it handed the editor entries whose
 * `id` was a number, so a later `crypto.randomUUID()` entry sat in the same
 * list under a different notion of identity. The conversion is explicit here so
 * neither side can silently stand in for the other.
 */

import type { LoreBook, LoreEntry } from "../../types";

/** An entry as written to a .json or PNG export: positional id, `extensions`. */
export interface ExportedLoreEntry extends Omit<LoreEntry, "id"> {
  id: number;
  extensions: Record<string, unknown>;
}

/** A lorebook as written to a .json or PNG export. */
export interface ExportedLoreBook extends Omit<LoreBook, "entries"> {
  extensions: Record<string, unknown>;
  entries: ExportedLoreEntry[];
}

/**
 * Read any lorebook-shaped payload into the internal shape.
 *
 * Accepts interchange exports, older library records, and hand-written JSON,
 * so every path into the editor goes through one normalisation.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export function parseLorebook(raw: any): LoreBook {
  const src = raw && typeof raw === "object" ? raw : {};

  let rawEntries: unknown[];
  if (Array.isArray(src.entries)) {
    rawEntries = src.entries;
  } else if (src.entries && typeof src.entries === "object") {
    // ST writes entries as an object keyed by numeric strings.
    rawEntries = Object.values(src.entries);
  } else {
    rawEntries = [];
  }

  const entries: LoreEntry[] = rawEntries.map((e: any) => ({
    id: crypto.randomUUID(),
    name: e?.name ?? e?.comment ?? "",
    comment: e?.comment ?? e?.name ?? "",
    keys: Array.isArray(e?.keys) ? e.keys : [],
    secondary_keys: Array.isArray(e?.secondary_keys) ? e.secondary_keys : [],
    content: e?.content ?? "",
    enabled: e?.enabled ?? true,
    insertion_order: e?.insertion_order ?? 100,
    case_sensitive: e?.case_sensitive ?? false,
    priority: e?.priority ?? 10,
    selective: e?.selective ?? false,
    constant: e?.constant ?? false,
    position: e?.position === "after_char" ? "after_char" : "before_char",
  }));

  return {
    name: src.name ?? "",
    description: src.description ?? "",
    creator: src.creator ?? src.author ?? "",
    version: src.version ?? "1.0",
    creator_notes: src.creator_notes ?? "",
    scan_depth: src.scan_depth ?? 50,
    token_budget: src.token_budget ?? 512,
    recursive_scanning: src.recursive_scanning ?? false,
    entries,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Render the internal shape as the interchange format other tools read. */
export function toExportedLorebook(book: LoreBook): ExportedLoreBook {
  return {
    name: book.name,
    description: book.description,
    creator: book.creator,
    version: book.version,
    creator_notes: book.creator_notes,
    scan_depth: book.scan_depth,
    token_budget: book.token_budget,
    recursive_scanning: book.recursive_scanning,
    extensions: {},
    entries: book.entries.map((e, i) => ({
      id: i,
      keys: e.keys,
      secondary_keys: e.secondary_keys,
      comment: e.comment || e.name,
      content: e.content,
      constant: e.constant,
      selective: e.selective,
      insertion_order: e.insertion_order,
      enabled: e.enabled,
      position: e.position,
      case_sensitive: e.case_sensitive,
      name: e.name,
      priority: e.priority,
      extensions: {},
    })),
  };
}
