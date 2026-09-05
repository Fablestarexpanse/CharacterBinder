import { useEffect, useState } from "react";
import { useEngineState } from "../../hooks/useEngineState";
import { preloadModel, unloadModel, isModelCached, isWebGpuAvailable } from "../../lib/cardTextSorter/engine";
import { useSorterSettings } from "../../hooks/useSorterSettings";
import { findModel, formatSize } from "../../lib/cardTextSorter/models";

/**
 * On/off light for the AI sorter, sitting next to the app's Ready light.
 *
 * The model costs a couple of GB of VRAM once loaded, so whether it's resident
 * shouldn't be invisible. Clicking loads it ahead of time (so the first sort
 * isn't a cold start) or frees it again.
 */
export default function LlmStatusLight() {
  const engine = useEngineState();
  const settings = useSorterSettings();
  const [cached, setCached] = useState<boolean | null>(null);

  // Settings are edited elsewhere (the Quick Import panel), so subscribe rather
  // than sampling. Sampling on engine.status left this holding a stale model id
  // between loads, and clicking would then fetch the wrong model.

  const model = findModel(settings.modelId);
  const usingServer = settings.backend === "endpoint";
  const webGpu = isWebGpuAvailable();

  useEffect(() => {
    if (usingServer || engine.status !== "off") return;
    let alive = true;
    isModelCached(settings.modelId).then((c) => alive && setCached(c));
    return () => {
      alive = false;
    };
  }, [settings.modelId, usingServer, engine.status]);

  async function toggle() {
    if (usingServer) return;
    if (engine.status === "loading") return;
    if (engine.status === "ready") {
      await unloadModel();
      return;
    }
    try {
      await preloadModel(settings.modelId);
    } catch {
      /* Error surfaces through engine state; the tooltip explains. */
    }
  }

  const pct = Math.round(engine.progress * 100);

  const { dot, label, title, disabled } = (() => {
    if (usingServer) {
      return {
        dot: "bg-accent-purple",
        label: "AI",
        title: `AI sorter is set to use ${settings.endpointUrl}. No in-browser model is loaded.`,
        disabled: true,
      };
    }
    if (!webGpu) {
      return {
        dot: "bg-text-muted",
        label: "AI",
        title: "This browser has no WebGPU, so the in-browser model can't run. Use Chrome or Edge, or point the sorter at a local server.",
        disabled: true,
      };
    }
    switch (engine.status) {
      case "ready":
        return {
          dot: "bg-status-ok",
          label: "AI on",
          title: `AI sorter is loaded and ready (${model?.label ?? engine.modelId}). Click to unload and free GPU memory.`,
          disabled: false,
        };
      case "loading":
        return {
          dot: "bg-status-warn animate-pulse",
          label: `AI ${pct}%`,
          title: engine.message || "Loading the model…",
          disabled: true,
        };
      case "error":
        return {
          dot: "bg-status-danger",
          label: "AI error",
          title: `${engine.error ?? "The model failed to load."} Click to try again.`,
          disabled: false,
        };
      default:
        return {
          dot: "bg-status-danger",
          label: "AI off",
          title:
            cached === false && model
              ? `AI sorter is off. Click to load ${model.label} — first time downloads about ${formatSize(model.vramMB)}.`
              : `AI sorter is off. Click to load ${model?.label ?? "the model"} from cache — no download needed.`,
          disabled: false,
        };
    }
  })();

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={`flex items-center gap-1.5 rounded px-1.5 py-0.5 transition-colors ${
        disabled ? "cursor-default" : "hover:bg-bg-hover cursor-pointer"
      }`}
    >
      <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
      <span className="text-xs text-text-muted whitespace-nowrap">{label}</span>
    </button>
  );
}
