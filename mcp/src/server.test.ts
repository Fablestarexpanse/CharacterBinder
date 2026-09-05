/**
 * The tool layer, driven the way an agent drives it: over a real MCP transport,
 * with the bridge absent.
 *
 * Every storage-backed tool goes through the app, which is not running here, so
 * what these pin down is the part that is this server's own job — the schemas
 * that reject a malformed call, and the error mapping that turns a bridge
 * failure into an answer the agent can read rather than a crash.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { server } from "./server.js";

const client = new Client({ name: "test", version: "0" });

beforeAll(async () => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
});

afterAll(async () => {
  await client.close();
});

/** The text a tool answered with, whatever shape it came in. */
async function callText(name: string, args: Record<string, unknown> = {}): Promise<string> {
  const res = (await client.callTool({ name, arguments: args })) as {
    content: Array<{ text?: string }>;
    isError?: boolean;
  };
  return res.content.map((c) => c.text ?? "").join("\n");
}

describe("MCP tool layer", () => {
  it("answers app_status without the app, saying how to connect it", async () => {
    const text = await callText("app_status");
    expect(text).toMatch(/"connected": false/);
    expect(text).toMatch(/MCP light/i);
  });

  it("turns a bridge failure into a tool error, not a crash", async () => {
    // Nothing is connected, so every storage-backed tool must fail this way.
    const res = (await client.callTool({ name: "list_cards", arguments: {} })) as { isError?: boolean };
    expect(res.isError).toBe(true);
  });

  it("rejects a call that omits a required id before it reaches the bridge", async () => {
    const res = (await client.callTool({ name: "get_card", arguments: {} })) as {
      isError?: boolean;
      content: Array<{ text?: string }>;
    };
    expect(res.isError).toBe(true);
    // The schema, not the app: the agent is told which argument was wrong.
    expect(res.content.map((c) => c.text).join("")).toMatch(/id/i);
  });

  it("rejects a card type it does not have", async () => {
    const res = (await client.callTool({
      name: "list_cards",
      arguments: { type: "spaceship" },
    })) as { isError?: boolean; content: Array<{ text?: string }> };
    expect(res.isError).toBe(true);
    expect(res.content.map((c) => c.text).join("")).toMatch(/type/i);
  });

  it("validates a character card without the app running", async () => {
    const text = await callText("validate_character", {
      card: { name: "Rook", description: "A dockhand of few words." },
    });
    expect(text).toMatch(/"valid": true/);
  });

  it("reports what a platform cannot carry, from the app's own registry", async () => {
    const text = await callText("platform_compatibility", { platform: "janitorai" });
    expect(text.toLowerCase()).toContain("janitorai");
    expect(text).toMatch(/"dropped"/);
  });

  it("splits pasted text with the app's own parser", async () => {
    const text = await callText("parse_card_text", { text: "Name: Mira\nDescription: Keeper of the light." });
    expect(text).toContain("Mira");
    expect(text).toContain("Keeper of the light.");
  });
});
