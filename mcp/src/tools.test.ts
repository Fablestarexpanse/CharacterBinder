import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PLATFORMS } from "../../src/shared/platforms/registry.js";
import { CARD_TYPES } from "../../src/types/index.js";

/**
 * The tool surface is the contract an agent codes against, and a tool that
 * names a field the app does not read fails silently — which has happened.
 * These read the source rather than booting the server, which would bind a port.
 */

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "index.ts"),
  "utf8"
);

const toolNames = [...source.matchAll(/server\.registerTool\(\s*"([a-z_]+)"/g)].map((m) => m[1]);

describe("MCP tool surface", () => {
  it("registers a creator for every card kind the app has", () => {
    for (const kind of CARD_TYPES) {
      expect(toolNames).toContain(`create_${kind}`);
    }
  });

  it("offers the tools the README documents", () => {
    const readme = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "..", "README.md"), "utf8");
    for (const tool of toolNames) {
      expect(readme, `${tool} is registered but undocumented`).toContain(`\`${tool}\``);
    }
  });

  it("names the script body the field ScriptCard actually reads", () => {
    // create_script used to take `code` while every consumer read `content`,
    // so an agent-written script arrived empty.
    const start = source.indexOf('"create_script"');
    const next = source.indexOf("server.registerTool(", start + 1);
    const createScript = source.slice(start, next === -1 ? undefined : next);
    expect(createScript).toContain("content: z.string()");
    expect(createScript).not.toMatch(/\bcode: z\.string\(\)/);
  });

  it("warns on every tool that can replace what the user is editing", () => {
    // `open` brings a card up in the editor, discarding unsaved work; the
    // shared constant carries that warning, so no tool may declare its own.
    const inlineOpenDeclarations = source.match(/open: z\.boolean\(\)/g) ?? [];
    expect(inlineOpenDeclarations).toHaveLength(0);
  });

  it("takes its card-kind and platform lists from the app rather than restating them", () => {
    // Restated literals is how a tool ends up offering a kind the app dropped,
    // or missing a platform it gained.
    expect(source).toMatch(/\.?enum\(CARD_TYPES\)/);
    expect(source).toMatch(/\.?enum\(PLATFORM_IDS\)/);
    expect(source).not.toMatch(/z\.enum\(\s*\[/);
  });

  it("knows every platform the app defines", async () => {
    const { PLATFORM_IDS } = await import("../../src/shared/platforms/registry.js");
    expect([...PLATFORM_IDS].sort()).toEqual(Object.keys(PLATFORMS).sort());
  });
});
