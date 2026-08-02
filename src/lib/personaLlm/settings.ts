import { DEFAULT_MODEL_ID } from "./models";

/** Where the AI sorter runs. */
export type SorterBackend = "webllm" | "endpoint";

export interface SorterSettings {
  backend: SorterBackend;
  /** WebLLM model id, from SORTER_MODELS. */
  modelId: string;
  /** OpenAI-compatible base URL, e.g. http://localhost:11434/v1 */
  endpointUrl: string;
  endpointModel: string;
  endpointKey: string;
  /** Set once the user has acknowledged sending persona text off-machine. */
  remoteAcknowledged: boolean;
}

const KEY = "cb_sorter_settings";

const DEFAULTS: SorterSettings = {
  backend: "webllm",
  modelId: DEFAULT_MODEL_ID,
  endpointUrl: "http://localhost:11434/v1",
  endpointModel: "llama3.2",
  endpointKey: "",
  remoteAcknowledged: false,
};

export function getSorterSettings(): SorterSettings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return { ...DEFAULTS };
  }
}

const listeners = new Set<(s: SorterSettings) => void>();

/**
 * These settings are edited in the Quick Import panel but also read by the
 * sidebar AI light. Without a notification the light kept a stale copy, so
 * clicking it could start downloading a model the user had just deselected —
 * potentially several GB.
 */
export function subscribeSorterSettings(fn: (s: SorterSettings) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function saveSorterSettings(patch: Partial<SorterSettings>): SorterSettings {
  const next = { ...getSorterSettings(), ...patch };
  localStorage.setItem(KEY, JSON.stringify(next));
  for (const fn of listeners) fn(next);
  return next;
}

/**
 * True when the URL points somewhere off this machine. Persona text sent there
 * leaves the user's control, so the UI warns before the first such request.
 */
export function isRemoteUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return !(
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      host === "::1" ||
      host === "[::1]" ||
      host.endsWith(".localhost")
    );
  } catch {
    // Unparseable URL — treat as remote; the safer assumption.
    return true;
  }
}
