import { DEFAULT_MODEL_ID } from "./models";
import { createPersistedSettings, cachedSnapshot } from "../persistedSettings";

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

const store = createPersistedSettings("cb_sorter_settings", {
  backend: "webllm",
  modelId: DEFAULT_MODEL_ID,
  endpointUrl: "http://localhost:11434/v1",
  endpointModel: "llama3.2",
  endpointKey: "",
  remoteAcknowledged: false,
} as SorterSettings);

/**
 * `backend` decides which code path runs, so a stored value that is neither
 * "webllm" nor "endpoint" (an older build, a hand-edited key) would fall
 * through to the WebLLM branch and try to download a model. Read it back to a
 * known value rather than trusting what is in storage.
 */
function readSettings(): SorterSettings {
  const stored = store.get();
  return {
    ...stored,
    backend: stored.backend === "endpoint" ? "endpoint" : "webllm",
    remoteAcknowledged: stored.remoteAcknowledged === true,
  };
}

export const getSorterSettings = cachedSnapshot(store, readSettings);

/**
 * Saves notify subscribers because these settings are edited in the Quick
 * Import panel but also read by the sidebar AI light. Without that the light
 * kept a stale copy, so clicking it could start downloading a model the user
 * had just deselected — potentially several GB.
 */
export const saveSorterSettings = store.save;
export const subscribeSorterSettings = store.subscribe;

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
