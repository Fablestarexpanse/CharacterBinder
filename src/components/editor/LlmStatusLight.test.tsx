import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LlmStatusLight from "./LlmStatusLight";

type Engine = { status: string; modelId: string | null; progress: number; message: string; error: string | null };
const engineState = vi.fn((): Engine => ({ status: "off", modelId: null, progress: 0, message: "", error: null }));
const isModelCached = vi.fn(async () => false);
const preloadModel = vi.fn(async () => {});
const unloadModel = vi.fn(async () => {});

vi.mock("../../hooks/useEngineState", () => ({ useEngineState: () => engineState() }));
vi.mock("../../lib/cardTextSorter/engine", async () => {
  const actual = await vi.importActual<typeof import("../../lib/cardTextSorter/engine")>("../../lib/cardTextSorter/engine");
  return {
    ...actual,
    isWebGpuAvailable: () => true,
    isModelCached: () => isModelCached(),
    preloadModel: () => preloadModel(),
    unloadModel: () => unloadModel(),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  engineState.mockReturnValue({ status: "off", modelId: null, progress: 0, message: "", error: null });
});

describe("LlmStatusLight", () => {
  it("warns about the download size before the model has ever been fetched", async () => {
    render(<LlmStatusLight />);
    // A click here can start a multi-gigabyte download, so the size has to be
    // on the control itself.
    expect(await screen.findByRole("button", { name: /downloads about/i })).toBeInTheDocument();
  });

  it("says no download is needed once the model is cached", async () => {
    isModelCached.mockResolvedValue(true);
    render(<LlmStatusLight />);
    expect(await screen.findByRole("button", { name: /no download needed/i })).toBeInTheDocument();
  });

  it("loads the model when off and unloads it when ready", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<LlmStatusLight />);

    await user.click(screen.getByRole("button"));
    expect(preloadModel).toHaveBeenCalledTimes(1);

    engineState.mockReturnValue({ status: "ready", modelId: "m", progress: 1, message: "", error: null });
    rerender(<LlmStatusLight />);
    await user.click(screen.getByRole("button"));
    expect(unloadModel).toHaveBeenCalledTimes(1);
  });

  it("shows loading progress rather than looking stuck", () => {
    engineState.mockReturnValue({ status: "loading", modelId: "m", progress: 0.4, message: "Fetching weights", error: null });
    render(<LlmStatusLight />);
    expect(screen.getByRole("button")).toHaveAccessibleName(/fetching weights/i);
  });

  it("surfaces an engine error", () => {
    engineState.mockReturnValue({ status: "error", modelId: null, progress: 0, message: "", error: "WebGPU device lost" });
    render(<LlmStatusLight />);
    expect(screen.getByRole("button")).toHaveAccessibleName(/webgpu device lost/i);
  });
});
