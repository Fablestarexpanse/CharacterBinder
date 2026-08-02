/**
 * AI-backed persona sorter.
 *
 * The keyword parser in ../personaParser can only match vocabulary, so a
 * sentence like "Kael is a blunt, wiry man born in Anvale" — appearance,
 * personality and background all at once — defeats it. A model reads the
 * meaning instead and splits mid-sentence where needed.
 *
 * Two backends behind one call:
 *   webllm    — runs in-browser on WebGPU. Nothing leaves the machine.
 *   endpoint  — any OpenAI-compatible server (Ollama, LM Studio, KoboldCpp,
 *               and remote providers too, with a warning).
 *
 * Output is constrained to a JSON schema at the decoding level (xgrammar for
 * WebLLM, response_format for endpoints), so a 1.5B model physically cannot
 * emit malformed or off-schema output. Anything that still goes wrong falls
 * back to the keyword parser rather than failing the user's paste.
 */

import type { ParsedPersona, PersonaField, CardField } from "../personaParser";
import { parsePersonaText } from "../personaParser";
import { countTokens } from "../tokenizer";
import { getSorterSettings, isRemoteUrl, type SorterSettings } from "./settings";

// ── Prompt + schema ─────────────────────────────────────────────────────────

/**
 * What each target shape asks the model for. Personas want appearance and
 * background; character cards fold those into description and want scenario,
 * greeting, and example dialogue instead.
 */
export type SortTarget = "persona" | "character";

const FIELD_DOCS: Record<CardField, string> = {
  name: "just the subject's name. It is usually the subject of the opening sentence, or the first proper noun in the text. Return an empty string only if the text genuinely never names them.",
  appearance: "physical description — build, height, hair, eyes, skin, scars, clothing, how they carry themselves.",
  personality: "temperament, manner, habits, likes/dislikes, how they treat people, speech style.",
  background: "history, origin, family, occupation, training, notable past events.",
  scenario: "the setting or situation the character exists in — where this takes place and what is going on.",
  first_mes: "the opening message the character sends to start a conversation. Only fill this if the text actually contains one.",
  mes_example: "sample dialogue exchanges, if the text contains any. Otherwise an empty string.",
  description: "who they are at a glance, plus leftover facts that fit no other field (age, gender, species, job title, relationships, stats).",
  creator: "the card's author, if stated.",
  creator_notes: "notes aimed at whoever uses the card, if stated.",
};

const TARGET_FIELDS: Record<SortTarget, CardField[]> = {
  persona: ["name", "description", "personality", "appearance", "background"],
  character: ["name", "description", "personality", "scenario", "first_mes", "mes_example"],
};

/** All keys required so the grammar forces every one to be emitted (possibly ""). */
function buildSchema(target: SortTarget): string {
  const properties: Record<string, unknown> = {};
  for (const f of TARGET_FIELDS[target]) properties[f] = { type: "string" };
  properties.tags = { type: "array", items: { type: "string" } };
  return JSON.stringify({
    type: "object",
    properties,
    required: [...TARGET_FIELDS[target], "tags"],
    additionalProperties: false,
  });
}

function buildSystemPrompt(target: SortTarget): string {
  const fields = TARGET_FIELDS[target].map((f) => `- ${f}: ${FIELD_DOCS[f]}`).join("\n");
  const descriptionRule =
    target === "character"
      ? `5. Each fact goes in ONE field only. Physical appearance and backstory belong in description for a character card — there are no separate fields for them. Never copy the whole input into description if other fields already cover it.`
      : `5. Each fact goes in ONE field only. Never restate in description anything you already placed in appearance, personality, or background. Never copy the whole input into description — if the other fields cover everything, description is a short summary or an empty string.`;

  return `You sort raw character/persona text into structured fields. You are an extractor, not a writer.

Fields:
${fields}
- tags: short lowercase keywords, only if the text supplies them or they are obvious. Otherwise an empty array.

Rules:
1. Copy the author's own wording. Do not rewrite, summarise, censor, or embellish.
2. Split sentences when they cover more than one field. "Kael is a blunt, wiry man born in Anvale" becomes appearance "wiry", personality "blunt", background "born in Anvale".
3. Never invent detail that is not in the input.
4. Lose nothing. Every fact in the input must appear in exactly one field.
${descriptionRule}
6. A field with nothing to say gets an empty string.
7. Keep the input's language and point of view.
8. Do NOT summarise. Do NOT compress the author's prose into keyword lists. Your fields together should be about as long as the input — you are moving sentences into the right buckets, not shortening them. If the input has a four-paragraph appearance section, that text still all has to land somewhere.`;
}

function buildUserPrompt(text: string): string {
  return `Sort this text into the fields.\n\n<card_text>\n${text}\n</card_text>`;
}

// ── Input budgeting ─────────────────────────────────────────────────────────

/**
 * Prebuilt WebLLM configs default to a 4096-token window, which is too small
 * here: the output has to reproduce nearly all of the input, so a long persona
 * would get cut off mid-JSON. These models support far more, so the window is
 * raised at load time and the output budget sized to match.
 */
const CONTEXT_TOKENS = 8192;
const MAX_OUTPUT_TOKENS = 3000;
const RESERVED_TOKENS = MAX_OUTPUT_TOKENS + 500; // generated JSON + system prompt

function budgetInput(text: string): { text: string; truncated: boolean } {
  const limit = CONTEXT_TOKENS - RESERVED_TOKENS;
  if (countTokens(text) <= limit) return { text, truncated: false };

  // Trim by characters, then walk back to a paragraph edge so we don't cut mid-thought.
  let slice = text;
  while (slice.length > 200 && countTokens(slice) > limit) {
    slice = slice.slice(0, Math.floor(slice.length * 0.9));
  }
  const lastBreak = slice.lastIndexOf("\n\n");
  if (lastBreak > slice.length * 0.5) slice = slice.slice(0, lastBreak);
  return { text: slice.trim(), truncated: true };
}

// ── Engine lifecycle (WebLLM) ───────────────────────────────────────────────

export interface LoadProgress {
  /** 0..1, or null while the model is still being fetched with no ratio yet. */
  progress: number;
  text: string;
}

type WebLlmEngine = {
  chat: { completions: { create: (req: unknown) => Promise<unknown> } };
  unload?: () => Promise<void>;
};

let engine: WebLlmEngine | null = null;
let engineModelId: string | null = null;
let engineLoading: Promise<WebLlmEngine> | null = null;

// ── Observable status ───────────────────────────────────────────────────────
// The model is a couple of GB of VRAM, and it can be loaded from either the
// import panel or the sidebar light. Both need to agree on what's happening, so
// the state lives here and anything interested subscribes.

export type EngineStatus = "off" | "loading" | "ready" | "error";

export interface EngineState {
  status: EngineStatus;
  modelId: string | null;
  /** 0..1 while loading. */
  progress: number;
  message: string;
  error: string | null;
}

let state: EngineState = { status: "off", modelId: null, progress: 0, message: "", error: null };
const listeners = new Set<(s: EngineState) => void>();

function setState(patch: Partial<EngineState>) {
  state = { ...state, ...patch };
  for (const listener of listeners) listener(state);
}

export function getEngineState(): EngineState {
  return state;
}

export function subscribeEngineState(fn: (s: EngineState) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** True when the model's weights are already in the browser cache — i.e. turning it on costs no download. */
export async function isModelCached(modelId: string): Promise<boolean> {
  try {
    const webllm = await import("@mlc-ai/web-llm");
    return await webllm.hasModelInCache(modelId);
  } catch {
    return false;
  }
}

/** Turn the sorter on ahead of time, so the first real sort isn't a cold start. */
export async function preloadModel(modelId: string, onProgress?: (p: LoadProgress) => void): Promise<void> {
  await getEngine(modelId, onProgress);
}

export function isWebGpuAvailable(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

export function loadedModelId(): string | null {
  return engineModelId;
}

async function getEngine(modelId: string, onProgress?: (p: LoadProgress) => void): Promise<WebLlmEngine> {
  if (engine && engineModelId === modelId) return engine;
  if (engineLoading && engineModelId === modelId) return engineLoading;

  // Switching models — drop the old weights before pulling new ones.
  if (engine && engineModelId !== modelId) {
    try {
      await engine.unload?.();
    } catch {
      /* best effort */
    }
    engine = null;
  }

  engineModelId = modelId;
  setState({ status: "loading", modelId, progress: 0, message: "Starting…", error: null });

  engineLoading = (async () => {
    const webllm = await import("@mlc-ai/web-llm");
    const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
    const created = await webllm.CreateWebWorkerMLCEngine(
      worker,
      modelId,
      {
        initProgressCallback: (report: { progress: number; text: string }) => {
          setState({ progress: report.progress, message: report.text });
          onProgress?.({ progress: report.progress, text: report.text });
        },
      },
      { context_window_size: CONTEXT_TOKENS }
    );
    engine = created as unknown as WebLlmEngine;
    return engine;
  })();

  try {
    const ready = await engineLoading;
    setState({ status: "ready", modelId, progress: 1, message: "", error: null });
    return ready;
  } catch (err) {
    engine = null;
    engineModelId = null;
    setState({
      status: "error",
      modelId: null,
      progress: 0,
      message: "",
      error: err instanceof Error ? err.message : "Failed to load the model.",
    });
    throw err;
  } finally {
    engineLoading = null;
  }
}

/** Frees GPU memory. The next sort reloads from the browser cache, not the network. */
export async function unloadModel() {
  try {
    await engine?.unload?.();
  } catch {
    /* best effort */
  }
  engine = null;
  engineModelId = null;
  setState({ status: "off", modelId: null, progress: 0, message: "", error: null });
}

// ── Public entry point ──────────────────────────────────────────────────────

export interface SortOptions {
  settings?: SorterSettings;
  /** Which field shape to extract into. Defaults to persona. */
  target?: SortTarget;
  onProgress?: (p: LoadProgress) => void;
  signal?: AbortSignal;
}

export async function sortPersonaWithAi(raw: string, opts: SortOptions = {}): Promise<ParsedPersona> {
  const settings = opts.settings ?? getSorterSettings();
  const target = opts.target ?? "persona";
  const text = raw.trim();
  if (!text) return parsePersonaText(raw);

  const { text: input, truncated } = budgetInput(text);
  const notes: string[] = [];
  if (truncated) {
    notes.push("Your text was longer than the model's context window, so the tail was left out. Sort the rest separately, or use a bigger model.");
  }

  const rawJson =
    settings.backend === "endpoint"
      ? await runEndpoint(input, settings, target, opts.signal)
      : await runWebLlm(input, settings, target, opts.onProgress);

  const parsed = coerceJson(rawJson);
  if (!parsed) throw new Error("The model didn't return usable JSON. Try Quick sort, or a larger model.");

  return toParsedPersona(parsed, notes, settings, input.length, target);
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
export async function sortPersonaAuto(raw: string, opts: SortOptions = {}): Promise<ParsedPersona> {
  const heuristic = parsePersonaText(raw);

  if (heuristic.method === "labelled" || heuristic.method === "json" || heuristic.method === "wpp") {
    return {
      ...heuristic,
      notes: [
        "Your text already had structure, so it was split on that directly — your wording is preserved exactly, with no model involved.",
        ...heuristic.notes.slice(1),
      ],
    };
  }

  return sortPersonaWithAi(raw, opts);
}

async function runWebLlm(input: string, settings: SorterSettings, target: SortTarget, onProgress?: (p: LoadProgress) => void): Promise<string> {
  if (!isWebGpuAvailable()) {
    throw new Error(
      "This browser has no WebGPU, so the in-browser model can't run. Use Chrome or Edge, or point the sorter at a local server in Settings."
    );
  }

  const eng = await getEngine(settings.modelId, onProgress);
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

  return reply.choices?.[0]?.message?.content ?? "";
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
  } catch {
    throw new Error(`Couldn't reach ${base}. Is the server running?`);
  }

  if (res.type === "opaqueredirect" || (res.status >= 300 && res.status < 400)) {
    throw new Error(
      `${base} tried to redirect the request elsewhere. Refusing to follow it — your persona text stays here.`
    );
  }
  if (!res.ok) {
    throw new Error(`Endpoint returned ${res.status} ${res.statusText}.`);
  }

  const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return body.choices?.[0]?.message?.content ?? "";
}

// ── Response handling ───────────────────────────────────────────────────────

/**
 * WebLLM's grammar guarantees clean JSON, but arbitrary endpoints don't — some
 * ignore response_format and wrap the object in prose or a code fence.
 */
function coerceJson(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const candidates = [trimmed];

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) candidates.push(fenced[1]);

  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first !== -1 && last > first) candidates.push(trimmed.slice(first, last + 1));

  for (const c of candidates) {
    try {
      const parsed = JSON.parse(c);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      /* try the next shape */
    }
  }
  return null;
}

function toParsedPersona(
  obj: Record<string, unknown>,
  notes: string[],
  settings: SorterSettings,
  inputLength: number,
  target: SortTarget
): ParsedPersona {
  const fields: Partial<Record<PersonaField, string>> = {};

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
