import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SorterSettingsPanel from "./SorterSettingsPanel";
import type { SorterSettings } from "../../lib/cardTextSorter/settings";

const props = { webGpuAvailable: true, loadedModelId: null, onUnload: vi.fn() };

const base: SorterSettings = {
  backend: "webllm",
  modelId: "Llama-3.2-3B-Instruct-q4f16_1-MLC",
  endpointUrl: "http://localhost:11434/v1",
  endpointModel: "llama3.2",
  endpointKey: "",
  remoteAcknowledged: false,
};

beforeEach(() => vi.clearAllMocks());

describe("SorterSettingsPanel", () => {
  it("switches between the in-browser model and a local server", async () => {
    const onChange = vi.fn();
    render(<SorterSettingsPanel settings={base} onChange={onChange} {...props} />);

    await userEvent.click(screen.getByRole("radio", { name: /local server/i }));
    expect(onChange).toHaveBeenCalledWith({ backend: "endpoint" });
  });

  it("warns before persona text would be sent off this machine", async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <SorterSettingsPanel settings={{ ...base, backend: "endpoint" }} onChange={onChange} {...props} />
    );
    expect(screen.queryByText(/isn't on this machine/i)).not.toBeInTheDocument();

    rerender(
      <SorterSettingsPanel
        settings={{ ...base, backend: "endpoint", endpointUrl: "https://api.openai.com/v1" }}
        onChange={onChange}
        {...props}
      />
    );
    // A remote endpoint means the user's persona text leaves their control, so
    // it is not enough to warn — the send stays blocked until they agree.
    expect(screen.getByText(/isn't on this machine/i)).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /send my persona text/i })).not.toBeChecked();
  });

  it("reports the model the user picked", async () => {
    const onChange = vi.fn();
    render(<SorterSettingsPanel settings={base} onChange={onChange} {...props} />);

    const select = screen.getByRole("combobox");
    await userEvent.selectOptions(select, screen.getAllByRole("option")[0]);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ modelId: expect.any(String) }));
  });
});
