/**
 * Curated subset of WebLLM's prebuilt model list.
 *
 * WebLLM ships 160+ models; almost all of them are wrong for this job (coder
 * models, math models, vision models, 8B models nobody wants to download). These
 * are the five worth offering for field extraction, smallest first.
 *
 * `vramMB` is the figure WebLLM itself reports as required VRAM. The first-run
 * download is in the same ballpark — that's the number users actually feel, so
 * the UI presents it as "about this big".
 */

export interface SorterModel {
  id: string;
  label: string;
  vramMB: number;
  blurb: string;
}

export const SORTER_MODELS: SorterModel[] = [
  {
    id: "SmolLM2-360M-Instruct-q4f16_1-MLC",
    label: "SmolLM2 360M",
    vramMB: 376,
    blurb: "Tiny and quick. For low-end machines — expect rougher splits.",
  },
  {
    id: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
    label: "Qwen2.5 1.5B",
    vramMB: 1630,
    blurb: "Fast, small download, handles most personas well.",
  },
  {
    id: "Llama-3.2-3B-Instruct-q4f16_1-MLC",
    label: "Llama 3.2 3B",
    vramMB: 2264,
    blurb: "Best balance of accuracy and size. Recommended.",
  },
  {
    id: "Qwen2.5-3B-Instruct-q4f16_1-MLC",
    label: "Qwen2.5 3B",
    vramMB: 2505,
    blurb: "Similar to Llama 3.2 3B; sometimes better on terse text.",
  },
  {
    id: "Phi-3.5-mini-instruct-q4f16_1-MLC",
    label: "Phi-3.5 mini",
    vramMB: 3672,
    blurb: "Most accurate on messy input. Biggest download.",
  },
];

export const DEFAULT_MODEL_ID = "Llama-3.2-3B-Instruct-q4f16_1-MLC";

export function findModel(id: string): SorterModel | undefined {
  return SORTER_MODELS.find((m) => m.id === id);
}

export function formatSize(mb: number): string {
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`;
}
