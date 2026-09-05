/**
 * The in-browser model: loading it, unloading it, and reporting what it is
 * doing. Nothing here knows about personas — see sorter.ts for that.
 */

import { CONTEXT_TOKENS } from "./modelIo";
import { errorMessage } from "../../shared/errorMessage";
import { createObservable } from "../observable";

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
// Kept so "Free memory" can actually stop the thread. unload() releases GPU
// memory but leaves the worker running, so switching models repeatedly used to
// pile up orphaned workers.
let engineWorker: Worker | null = null;

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

const engineState = createObservable<EngineState>({
  status: "off", modelId: null, progress: 0, message: "", error: null,
});

const setState = engineState.set;

export function getEngineState(): EngineState {
  return engineState.get();
}

export const subscribeEngineState = engineState.subscribe;

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
  await ensureEngine(modelId, onProgress);
}

export function isWebGpuAvailable(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

export function loadedModelId(): string | null {
  return engineModelId;
}

export async function ensureEngine(modelId: string, onProgress?: (p: LoadProgress) => void): Promise<WebLlmEngine> {
  if (engine && engineModelId === modelId) return engine;
  if (engineLoading && engineModelId === modelId) return engineLoading;

  // Switching models — drop the old weights before pulling new ones.
  if (engine && engineModelId !== modelId) {
    await teardownEngine();
  }

  engineModelId = modelId;
  setState({ status: "loading", modelId, progress: 0, message: "Starting…", error: null });

  engineLoading = (async () => {
    const webllm = await import("@mlc-ai/web-llm");
    const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
    engineWorker = worker;
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
      error: errorMessage(err),
    });
    throw err;
  } finally {
    engineLoading = null;
  }
}

/** Releases the GPU memory *and* the worker thread that holds it. */
async function teardownEngine() {
  try {
    await engine?.unload?.();
  } catch {
    /* best effort */
  }
  try {
    engineWorker?.terminate();
  } catch {
    /* best effort */
  }
  engine = null;
  engineWorker = null;
  engineModelId = null;
}

/** Frees GPU memory. The next sort reloads from the browser cache, not the network. */
export async function unloadModel() {
  await teardownEngine();
  setState({ status: "off", modelId: null, progress: 0, message: "", error: null });
}
