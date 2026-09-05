#!/usr/bin/env node
/**
 * CharacterBinder MCP server.
 *
 * Gives a coding agent the same abilities the app's UI has: create and edit
 * character cards, lorebooks, personas, scenarios, and scripts, plus validate
 * them and check how they'll survive each platform's format.
 *
 * Two kinds of tool live here:
 *   - Storage-backed ones proxy to the running app over the local bridge,
 *     because the card library is IndexedDB in the browser.
 *   - Pure ones (validation, platform compatibility, text parsing) reuse the
 *     app's own modules directly, so there's one implementation of each rule
 *     rather than a copy that drifts.
 *
 * stdout is the MCP transport. Never write to it — logs go to stderr.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { startBridge, callApp, bridgeStatus } from "./bridge.js";
import { validateTavernCardV2 } from "../../src/lib/validators/index.js";
import { PLATFORMS, type PlatformId } from "../../src/lib/platforms/index.js";
import { parsePersonaText, toCharacterFields } from "../../src/lib/personaParser/index.js";
import type { CardSummary, GetResult, MutationResult } from "../../src/lib/bridge/protocol.js";

const server = new McpServer({ name: "characterbinder", version: "1.0.0" });

const text = (value: unknown) => ({
  content: [{ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }],
});

// ── Shared field shapes ─────────────────────────────────────────────────────

const tags = z.array(z.string()).optional().describe("Lowercase keywords, e.g. ['demi-human','scientist']");
const openAfter = z
  .boolean()
  .optional()
  .describe(
    "Bring the card up in the app's editor after saving. Defaults to false — opening a card replaces whatever the user is currently editing, and any unsaved work in that panel is lost. Set true only when the user asked to see it."
  );

// ── Status ──────────────────────────────────────────────────────────────────

server.registerTool(
  "app_status",
  {
    title: "Check the CharacterBinder connection",
    description:
      "Whether the CharacterBinder app is connected to this server. Every card tool needs it. Call this first if anything fails with a connection error.",
  },
  async () => {
    const s = bridgeStatus();
    if (s.connected) {
      const pong = await callApp<{ app: string; version: string }>("ping").catch(() => null);
      return text({
        connected: true,
        port: s.port,
        app: pong ? `${pong.app} v${pong.version}` : "connected",
      });
    }
    return text({
      connected: false,
      port: s.port,
      listenError: s.error,
      howToFix:
        "Start the app (npm start in the CharacterBinder folder, then open http://localhost:3737) and click the MCP light in the sidebar footer to switch the bridge on.",
    });
  }
);

// ── Reading ─────────────────────────────────────────────────────────────────

server.registerTool(
  "list_cards",
  {
    title: "List cards in the library",
    description: "Every card saved in the user's CharacterBinder library, newest first. Optionally filter by type.",
    inputSchema: {
      type: z
        .enum(["character", "lorebook", "script", "scenario", "persona"])
        .optional()
        .describe("Only return cards of this type."),
    },
  },
  async ({ type }) => {
    const res = await callApp<{ cards: CardSummary[] }>("cards.list", { type });
    if (!res.cards.length) return text("The library is empty.");
    return text(res.cards);
  }
);

server.registerTool(
  "get_card",
  {
    title: "Read one card in full",
    description: "The complete contents of a card, by id. Use list_cards to find ids.",
    inputSchema: { id: z.string().describe("Card id from list_cards.") },
  },
  async ({ id }) => text(await callApp<GetResult>("cards.get", { id }))
);

// ── Creating ────────────────────────────────────────────────────────────────

async function create(cardType: string, data: Record<string, unknown>, open?: boolean) {
  const opened = open ?? false;
  const res = await callApp<MutationResult>("cards.create", { cardType, data, open: opened });
  return text({
    ...res,
    saved: opened
      ? "Card saved to the library and opened in the app."
      : "Card saved to the library. It is in the Library view; pass open:true to bring it up in the editor.",
  });
}

server.registerTool(
  "create_character",
  {
    title: "Create a character card",
    description:
      "Create a Tavern Card v2 character in the user's library. Description carries physical appearance and backstory — there are no separate fields for those. Use {{char}} and {{user}} as placeholders.",
    inputSchema: {
      name: z.string().describe("Character's name."),
      description: z
        .string()
        .describe("Who they are: appearance, background, defining traits. The card's main body of text."),
      personality: z.string().optional().describe("Temperament and manner, often a short trait list."),
      scenario: z.string().optional().describe("The setting or situation the conversation starts in."),
      first_mes: z.string().optional().describe("The character's opening message to the user."),
      mes_example: z
        .string()
        .optional()
        .describe("Sample exchanges, using {{user}}: and {{char}}: to mark speakers."),
      system_prompt: z.string().optional().describe("Overrides the app's system prompt when supported."),
      post_history_instructions: z.string().optional().describe("Instructions injected after chat history."),
      alternate_greetings: z.array(z.string()).optional().describe("Additional opening messages."),
      creator: z.string().optional(),
      creator_notes: z.string().optional().describe("Notes for whoever uses the card."),
      character_version: z.string().optional().describe("Defaults to 1.0."),
      tags,
      open: openAfter,
    },
  },
  async ({ open, ...data }) => create("character", data, open)
);

server.registerTool(
  "create_persona",
  {
    title: "Create a persona card",
    description:
      "Create a persona — the {{user}} identity, i.e. who the human is in the conversation. Unlike a character card this has separate appearance and background fields.",
    inputSchema: {
      name: z.string(),
      description: z.string().optional().describe("Brief overview of who this persona is."),
      personality: z.string().optional(),
      appearance: z.string().optional().describe("Physical description."),
      background: z.string().optional().describe("Backstory, occupation, history."),
      creator: z.string().optional(),
      creator_notes: z.string().optional(),
      version: z.string().optional().describe("Defaults to 1.0."),
      tags,
      open: openAfter,
    },
  },
  async ({ open, ...data }) => create("persona", { spec: "persona_card_v1", ...data, version: data.version ?? "1.0" }, open)
);

server.registerTool(
  "create_lorebook",
  {
    title: "Create a lorebook",
    description:
      "Create a SillyTavern-compatible world info book. Entries are injected into context when one of their trigger keys appears in conversation.",
    inputSchema: {
      name: z.string(),
      description: z.string().optional(),
      creator: z.string().optional(),
      entries: z
        .array(
          z.object({
            name: z.string().optional().describe("Label for the entry, for your own reference."),
            keys: z.array(z.string()).describe("Trigger keywords that activate this entry."),
            secondary_keys: z.array(z.string()).optional().describe("Required second keys when selective is on."),
            content: z.string().describe("The text injected into context."),
            enabled: z.boolean().optional().describe("Defaults to true."),
            constant: z.boolean().optional().describe("Always inject, ignoring keys."),
            selective: z.boolean().optional().describe("Require a secondary key as well."),
            case_sensitive: z.boolean().optional(),
            insertion_order: z.number().optional().describe("Defaults to 100."),
            priority: z.number().optional().describe("Defaults to 10."),
          })
        )
        .optional()
        .describe("The book's entries."),
      open: openAfter,
    },
  },
  async ({ open, entries, ...rest }) =>
    create(
      "lorebook",
      {
        ...rest,
        entries: (entries ?? []).map((e, i) => ({
          secondary_keys: [],
          enabled: true,
          constant: false,
          selective: false,
          case_sensitive: false,
          insertion_order: 100,
          priority: 10,
          name: `Entry ${i + 1}`,
          ...e,
        })),
      },
      open
    )
);

server.registerTool(
  "create_scenario",
  {
    title: "Create a scenario card",
    description:
      "Create a standalone situation that can be dropped into a conversation with any character, independent of who you're talking to.",
    inputSchema: {
      name: z.string(),
      description: z.string().optional().describe("Brief overview of the scenario."),
      scenario: z.string().describe("The setting itself — where this takes place and what is going on."),
      first_mes: z.string().optional().describe("Opening message that starts the scene."),
      creator: z.string().optional(),
      creator_notes: z.string().optional(),
      version: z.string().optional(),
      tags,
      open: openAfter,
    },
  },
  async ({ open, ...data }) => create("scenario", { spec: "scenario_card_v1", ...data, version: data.version ?? "1.0" }, open)
);

server.registerTool(
  "create_script",
  {
    title: "Create a script card",
    description: "Package a JavaScript snippet or system prompt as a portable, shareable card.",
    inputSchema: {
      name: z.string(),
      description: z.string().optional().describe("What the script does."),
      content: z.string().describe("The script body."),
      author: z.string().optional(),
      creator_notes: z.string().optional(),
      version: z.string().optional(),
      tags,
      open: openAfter,
    },
  },
  async ({ open, ...data }) => create("script", { spec: "script_card_v1", ...data, version: data.version ?? "1.0" }, open)
);

// ── Editing ─────────────────────────────────────────────────────────────────

server.registerTool(
  "update_card",
  {
    title: "Edit an existing card",
    description:
      "Shallow-merge changes into a card already in the library. Only the fields you pass are touched; everything else is left alone. Read the card first with get_card if you need its current contents.",
    inputSchema: {
      id: z.string().describe("Card id from list_cards."),
      patch: z
        .record(z.unknown())
        .describe("Fields to overwrite, e.g. { personality: '...', tags: ['a','b'] }."),
      open: z.boolean().optional().describe("Bring the card up in the editor afterwards."),
    },
  },
  async ({ id, patch, open }) => text(await callApp<MutationResult>("cards.update", { id, patch, open }))
);

server.registerTool(
  "delete_card",
  {
    title: "Delete a card",
    description: "Permanently remove a card from the library. There is no undo — confirm with the user first.",
    inputSchema: { id: z.string().describe("Card id from list_cards.") },
  },
  async ({ id }) => text(await callApp<{ id: string }>("cards.delete", { id }))
);

server.registerTool(
  "open_card",
  {
    title: "Open a card in the app",
    description: "Bring an existing card up in the matching editor so the user can see it.",
    inputSchema: { id: z.string() },
  },
  async ({ id }) => text(await callApp<{ id: string }>("app.open", { id }))
);

// ── Pure tools — no app needed ──────────────────────────────────────────────

server.registerTool(
  "validate_character",
  {
    title: "Validate a character card",
    description:
      "Check a character card against the Tavern Card v2 spec. Runs the app's own validator, so it matches what the UI reports. Pass either an id from the library or the fields directly.",
    inputSchema: {
      id: z.string().optional().describe("Validate a card already in the library."),
      card: z.record(z.unknown()).optional().describe("Or validate these fields directly."),
    },
  },
  async ({ id, card }) => {
    let data = card;
    if (id) {
      const fetched = await callApp<GetResult>("cards.get", { id });
      const v2 = fetched.data as { data?: Record<string, unknown> };
      data = v2?.data ?? (fetched.data as Record<string, unknown>);
    }
    if (!data) throw new Error("Pass either an id or a card object.");

    const result = validateTavernCardV2({
      spec: "chara_card_v2",
      spec_version: "2.0",
      // The validator expects a full data block; missing keys read as empty.
      data: { name: "", description: "", personality: "", scenario: "", first_mes: "", mes_example: "", creator_notes: "", system_prompt: "", post_history_instructions: "", alternate_greetings: [], tags: [], creator: "", character_version: "", extensions: {}, ...data },
    } as never);

    return text({ valid: result.valid, errors: result.errors, warnings: result.warnings });
  }
);

server.registerTool(
  "platform_compatibility",
  {
    title: "Check how a card survives a platform",
    description:
      "Which fields a target platform drops or renames, and whether it can import PNG cards at all. Use before telling a user to upload somewhere.",
    inputSchema: {
      platform: z
        .enum(["sillytavern", "janitorai", "chub", "agnai", "venus", "backyard", "risu", "generic"])
        .describe("Target platform."),
    },
  },
  async ({ platform }) => {
    const p = PLATFORMS[platform as PlatformId];
    return text({
      platform: p.name,
      readsPngCards: p.pngSupport,
      readsJson: p.jsonSupport,
      metadataKey: p.metadataKey ?? "chara (fallback — this platform declares none)",
      dropped: p.fields.filter((f) => f.support === "none").map((f) => f.label),
      renamedOrPartial: p.fields
        .filter((f) => f.support === "renamed" || f.support === "partial")
        .map((f) => ({ field: f.label, note: f.note })),
      note: p.pngSupport
        ? undefined
        : `${p.name} cannot import PNG cards — export JSON for it. CharacterBinder will still build a valid PNG if you want one for archiving.`,
    });
  }
);

server.registerTool(
  "parse_card_text",
  {
    title: "Sort unstructured card text into fields",
    description:
      "Turn a pasted blob — a JanitorAI dump, labelled sections, W++, or a JSON export — into structured fields. This is the app's Quick Import parser. Useful before create_character or create_persona so you fill fields correctly rather than guessing.",
    inputSchema: {
      text: z.string().describe("The raw card text."),
      target: z
        .enum(["persona", "character"])
        .optional()
        .describe("Which field shape to produce. Defaults to persona."),
    },
  },
  async ({ text: raw, target }) => {
    const parsed = parsePersonaText(raw);
    const fields = target === "character" ? toCharacterFields(parsed) : parsed.fields;
    return text({
      detectedFormat: parsed.method,
      fields,
      tags: parsed.tags,
      notes: parsed.notes,
    });
  }
);

// ── Boot ────────────────────────────────────────────────────────────────────

startBridge();
await server.connect(new StdioServerTransport());
console.error("[characterbinder-mcp] ready on stdio");
