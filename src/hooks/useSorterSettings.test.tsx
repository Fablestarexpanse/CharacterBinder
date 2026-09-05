import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";

const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
});

let useSorterSettings: typeof import("./useSorterSettings").useSorterSettings;
let saveSorterSettings: typeof import("../lib/cardTextSorter/settings").saveSorterSettings;

beforeEach(async () => {
  store.clear();
  vi.resetModules();
  ({ useSorterSettings } = await import("./useSorterSettings"));
  ({ saveSorterSettings } = await import("../lib/cardTextSorter/settings"));
});

function Probe() {
  const settings = useSorterSettings();
  return <p data-testid="backend">{settings.backend}</p>;
}

describe("useSorterSettings", () => {
  it("shows the stored settings", () => {
    render(<Probe />);
    expect(screen.getByTestId("backend")).toHaveTextContent("webllm");
  });

  it("re-renders when another part of the app saves a change", () => {
    render(<Probe />);
    act(() => void saveSorterSettings({ backend: "endpoint" }));
    // This is the whole point of the hook: the sidebar light must not keep
    // offering to download a model the user just switched away from.
    expect(screen.getByTestId("backend")).toHaveTextContent("endpoint");
  });

  it("hands out a stable snapshot, so it cannot re-render forever", () => {
    // useSyncExternalStore compares snapshots by identity; a fresh object per
    // read would loop. Rendering twice with no save is the check.
    const { rerender } = render(<Probe />);
    rerender(<Probe />);
    expect(screen.getByTestId("backend")).toHaveTextContent("webllm");
  });
});
