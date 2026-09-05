/**
 * Sorting a blob of card text into fields with a model.
 *
 * Two transports behind one call — the in-browser engine and any
 * OpenAI-compatible endpoint — and the routing that prefers the keyword parser
 * when the text already has structure of its own.
 */

import type { ParsedCardText, CardField } from "../../shared/cardTextParser";
import { parseCardText } from "../../shared/cardTextParser";
import { budgetInput, coerceJson, MAX_OUTPUT_TOKENS } from "./modelIo";
import { getSorterSettings, isRemoteUrl, type SorterSettings } from "./settings";
import { buildSchema, buildSystemPrompt, buildUserPrompt, TARGET_FIELDS, type SortTarget } from "./prompts";
import { ensureEngine, isWebGpuAvailable, type LoadProgress } from "./engine";

export type { SortTarget };

// ── Public entry point ──────────────────────────────────────────────────────

export interface SortOptions {
  settings?: SorterSettings;
  /** Which field shape to extract into. Defaults to persona. */
  target?: SortTarget;
  /** Model-download progress. Only the in-browser backend loads a model. */
  onProgress?: (p: LoadProgress) => void;
  /** Cancels the sort on either backend. */
  signal?: AbortSignal;
}

/** Rejection shape the DOM uses for a cancelled operation, so callers can `err.name === "AbortError"`. */
function abortError(): Error {
  return typeof DOMException === "function"
    ? new DOMException("The sort was cancelled.", "AbortError")
    : Object.assign(new Error("The sort was cancelled."), { name: "AbortError" });
}

export async function sortCardTextWithAi(raw: string, opts: SortOptions = {}): Promise<ParsedCardText> {
  const settings = opts.settings ?? getSorterSettings();
  const target = opts.target ?? "persona";
  const text = raw.trim();
  if (!text) return parseCardText(raw);

  const { text: input, truncated } = budgetInput(text);
  const notes: string[] = [];
  if (truncated) {
    notes.push("Your text was longer than the model's context window, so the tail was left out. Sort the rest separately, or use a bigger model.");
  }

  const rawJson =
    settings.backend === "endpoint"
      ? await runEndpoint(input, settings, target, opts.signal)
      : await runWebLlm(input, settings, target, opts.onProgress, opts.signal);

  const parsed = coerceJson(rawJson);
  if (!parsed) throw new Error("The model didn't return usable JSON. Try Quick sort, or a larger model.");

  return toParsedCardText(parsed, notes, settings, input.length, target);
}

/**
 * Picks the right sorter for the text instead of making the user guess.
 *
 * Structured input — labelled sections, JSON, W++ — is better served by the
 * parser: it moves the author's own words across verbatim, instantly, with no
 * model download. Models tend to paraphrase and compress that same input.
 * Shapeless prose is the opposite case, and that's where the model earns its
 * keep, because only it can split one sentence across three fields.
 */
export async function sortCardTextAuto(raw: string, opts: SortOptions = {}): Promise<ParsedCardText> {
  const heuristic = parseCardText(raw);

  if (heuristic.method === "labelled" || heuristic.method === "json" || heuristic.method === "wpp") {
    return {
      ...heuristic,
      notes: [
        "Your text already had structure, so it was split on that directly — your wording is preserved exactly, with no model involved.",
        ...heuristic.notes.slice(1),
      ],
    };
  }

  return sortCardTextWithAi(raw, opts);
}

async function runWebLlm(
  input: string,
  settings: SorterSettings,
  target: SortTarget,
  onProgress?: (p: LoadProgress) => void,
  signal?: AbortSignal
): Promise<string> {
  if (!isWebGpuAvailable()) {
    throw new Error(
      "This browser has no WebGPU, so the in-browser model can't run. Use Chrome or Edge, or point the sorter at a local server in Settings."
    );
  }

  if (signal?.aborted) throw abortError();
  const eng = await ensureEngine(settings.modelId, onProgress);
  if (signal?.aborted) throw abortError();

  // Generation runs on the GPU and cannot be dropped mid-token, but WebLLM can
  // be told to stop early; without this, cancelling only stopped the caller
  // waiting while the model kept generating.
  const stop = () => {
    void (eng as { interruptGenerate?: () => void }).interruptGenerate?.();
  };
  signal?.addEventListener("abort", stop, { once: true });

  try {
    const reply = (await eng.chat.completions.create({
      messages: [
        { role: "system", content: buildSystemPrompt(target) },
        { role: "user", content: buildUserPrompt(input) },
      ],
      temperature: 0.2,
      max_tokens: MAX_OUTPUT_TOKENS,
      // Constrains decoding to the schema — the model cannot emit anything else.
      response_format: { type: "json_object", schema: buildSchema(target) },
    })) as { choices?: Array<{ message?: { content?: string } }> };

    if (signal?.aborted) throw abortError();
    return reply.choices?.[0]?.message?.content ?? "";
  } finally {
    signal?.removeEventListener("abort", stop);
  }
}

async function runEndpoint(input: string, settings: SorterSettings, target: SortTarget, signal?: AbortSignal): Promise<string> {
  const base = settings.endpointUrl.trim().replace(/\/+$/, "");
  if (!base) throw new Error("No endpoint URL set. Add one in the sorter settings.");
  if (isRemoteUrl(base) && !settings.remoteAcknowledged) {
    throw new Error("That endpoint is not on this machine. Confirm the off-machine warning in the sorter settings first.");
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (settings.endpointKey.trim()) headers.Authorization = `Bearer ${settings.endpointKey.trim()}`;

  let res: Response;
  try {
    res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers,
      signal,
      // The local-vs-remote check is lexical and only ever saw this URL. Without
      // this, an endpoint that passed the check could answer 307 and the user's
      // persona text would be replayed off-machine with no warning shown.
      redirect: "manual",
      body: JSON.stringify({
        model: settings.endpointModel,
        messages: [
          { role: "system", content: buildSystemPrompt(target) },
          { role: "user", content: buildUserPrompt(input) },
        ],
        temperature: 0.2,
        stream: false,
        response_format: { type: "json_object" },
      }),
    });
  } catch (err) {
    // A cancellation is not a connection problem, and telling the user their
    // server is down because they pressed stop sends them debugging nothing.
    if (err instanceof Error && err.name === "AbortError") throw err;
    throw new Error(`Couldn't reach ${base}. Is the server running?`, { cause: err });
  }

  if (res.type === "opaqueredirect" || (res.status >= 300 && res.status < 400)) {
    throw new Error(
      `${base} tried to redirect the request elsewhere. Refusing to follow it — your persona text stays here.`
    );
  }
  if (!res.ok) {
    throw new Error(`Endpoint returned ${res.status} ${res.statusText}.`);
  }

  let body: { choices?: Array<{ message?: { content?: string } }> };
  try {
    body = await res.json();
  } catch {
    // A wrong URL usually answers with HTML, and a raw SyntaxError tells the
    // user nothing about which setting to change.
    throw new Error(
      `${base} answered with something that isn't JSON. Check the endpoint URL points at an OpenAI-compatible /v1 API.`
    );
  }
  return body.choices?.[0]?.message?.content ?? "";
}

// ── Response handling ───────────────────────────────────────────────────────

/**
 * WebLLM's grammar guarantees clean JSON, but arbitrary endpoints don't — some
 * ignore response_format and wrap the object in prose or a code fence.
 */

function toParsedCardText(
  obj: Record<string, unknown>,
  notes: string[],
  settings: SorterSettings,
  inputLength: number,
  target: SortTarget
): ParsedCardText {
  const fields: Partial<Record<CardField, string>> = {};

  for (const key of TARGET_FIELDS[target]) {
    const value = obj[key];
    const str = typeof value === "string" ? value.trim() : "";
    if (str) fields[key] = str;
  }

  const tags = Array.isArray(obj.tags)
    ? obj.tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean).slice(0, 24)
    : [];

  const where =
    settings.backend === "endpoint"
      ? `${settings.endpointModel} via ${settings.endpointUrl}`
      : settings.modelId.replace(/-q4f\d+_\d+-MLC$/, "").replace(/-MLC$/, "");

  // Small models tend to paraphrase long input into keyword lists instead of
  // moving it. Detectable by output length, and worth saying out loud rather
  // than letting the user discover their prose was quietly rewritten.
  const outputLength = Object.values(fields).join("").length;
  const compressed = inputLength > 800 && outputLength < inputLength * 0.5;

  return {
    fields,
    tags,
    method: "ai",
    notes: [
      `Sorted by ${where}. Review before applying — models make mistakes.`,
      ...(compressed
        ? [
            `Heads up: the model condensed your ${inputLength.toLocaleString()} characters down to ${outputLength.toLocaleString()}, so wording was lost rather than just moved. If your text has section headings, Quick Sort will keep it word-for-word.`,
          ]
        : []),
      ...notes,
    ],
  };
}
