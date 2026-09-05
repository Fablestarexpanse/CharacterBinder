/**
 * The endpoint backend and the response handling behind it.
 *
 * Everything here runs against a stubbed fetch: no model, no network, no
 * WebGPU. What is worth pinning down is what the user is told when the far end
 * misbehaves — a wrong URL, an error status, a redirect — because each of those
 * used to surface as a raw TypeError or a silently empty result.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { sortCardTextWithAi, sortCardTextAuto } from "./sorter";
import type { SorterSettings } from "./settings";

const settings: SorterSettings = {
  backend: "endpoint",
  modelId: "unused",
  endpointUrl: "http://localhost:11434/v1",
  endpointModel: "llama3",
  endpointKey: "",
  remoteAcknowledged: false,
};

/** Shapeless prose, so the router doesn't hand it to the keyword parser. */
const PROSE =
  "she keeps the lamp room at the harbour mouth and has done for nineteen winters and talks to the gulls";

function reply(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), { status: 200, ...init });
}

function modelSaid(content: string) {
  return reply({ choices: [{ message: { content } }] });
}

afterEach(() => vi.unstubAllGlobals());

describe("sortCardTextWithAi over an endpoint", () => {
  it("puts the model's fields on the result and lowercases its tags", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => modelSaid(JSON.stringify({
      name: " Mira ",
      description: "Keeper of the harbour light.",
      tags: [" Harbour ", "KEEPER", ""],
    }))));

    const result = await sortCardTextWithAi(PROSE, { settings });
    expect(result.fields.name).toBe("Mira");
    expect(result.fields.description).toBe("Keeper of the harbour light.");
    expect(result.tags).toEqual(["harbour", "keeper"]);
    expect(result.method).toBe("ai");
  });

  it("keeps the fields it recognises when the model answers with junk beside them", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => modelSaid(JSON.stringify({
      name: "Mira",
      description: 42,          // wrong type
      personality: "   ",       // blank after trimming
      nonsense: "ignored",      // not a field
    }))));

    const result = await sortCardTextWithAi(PROSE, { settings });
    expect(result.fields.name).toBe("Mira");
    expect(result.fields.description).toBeUndefined();
    expect(result.fields.personality).toBeUndefined();
  });

  it("names the endpoint when it cannot be reached, rather than reporting a fetch failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    await expect(sortCardTextWithAi(PROSE, { settings })).rejects.toThrow(/couldn't reach .*11434/i);
  });

  it("reports the status when the endpoint answers with an error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 502, statusText: "Bad Gateway" })));
    await expect(sortCardTextWithAi(PROSE, { settings })).rejects.toThrow(/502/);
  });

  it("blames the URL when the answer isn't JSON, which is what a wrong path returns", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>not an API</html>", { status: 200 })));
    await expect(sortCardTextWithAi(PROSE, { settings })).rejects.toThrow(/isn't JSON|endpoint URL/i);
  });

  it("refuses a redirect instead of replaying the text wherever it points", async () => {
    // The local-vs-remote check is lexical and only ever saw the original URL.
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 307 })));
    await expect(sortCardTextWithAi(PROSE, { settings })).rejects.toThrow(/redirect/i);
  });

  it("refuses an off-machine endpoint the user has not acknowledged", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const remote = { ...settings, endpointUrl: "https://api.openai.com/v1" };

    await expect(sortCardTextWithAi(PROSE, { settings: remote })).rejects.toThrow(/not on this machine/i);
    // Nothing left the machine to find that out.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("says the model returned nothing usable rather than applying an empty split", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => modelSaid("I'm sorry, I can't help with that.")));
    await expect(sortCardTextWithAi(PROSE, { settings })).rejects.toThrow(/usable JSON/i);
  });

  it("warns when a long input comes back much shorter than it went in", async () => {
    const long = PROSE + " ".repeat(0) + "and ".repeat(400);
    vi.stubGlobal("fetch", vi.fn(async () => modelSaid(JSON.stringify({ name: "Mira", description: "A keeper." }))));

    const result = await sortCardTextWithAi(long, { settings });
    expect(result.notes.some((n) => /condensed/i.test(n))).toBe(true);
  });
});

describe("sortCardTextAuto", () => {
  it("uses the parser for text that already has structure, without calling the endpoint", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await sortCardTextAuto("Name: Mira\nDescription: Keeper of the light.", { settings });
    expect(result.method).toBe("labelled");
    expect(result.fields.name).toBe("Mira");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
