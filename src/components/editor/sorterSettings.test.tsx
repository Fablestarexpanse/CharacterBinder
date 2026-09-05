import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SorterSettings from "./SorterSettings";
import type { SorterSettings as Settings } from "../../lib/cardTextSorter/settings";

const base: Settings = {
  backend: "webllm",
  modelId: "Llama-3.2-3B-Instruct-q4f16_1-MLC",
  endpointUrl: "http://localhost:11434/v1",
  endpointModel: "llama3.2",
  endpointKey: "",
  remoteAcknowledged: false,
};

beforeEach(() => vi.clearAllMocks());

describe("SorterSettings", () => {
  it("switches between the in-browser model and a local server", async () => {
    const onChange = vi.fn();
    render(<SorterSettings settings={base} onChange={onChange} />);

    await userEvent.click(screen.getByRole("radio", { name: /local server/i }));
    expect(onChange).toHaveBeenCalledWith({ backend: "endpoint" });
  });

  it("warns before persona text would be sent off this machine", async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <SorterSettings settings={{ ...base, backend: "endpoint" }} onChange={onChange} />
    );
    expect(screen.queryByText(/isn't on this machine/i)).not.toBeInTheDocument();

    rerender(
      <SorterSettings
        settings={{ ...base, backend: "endpoint", endpointUrl: "https://api.openai.com/v1" }}
        onChange={onChange}
      />
    );
    // A remote endpoint means the user's persona text leaves their control, so
    // it is not enough to warn — the send stays blocked until they agree.
    expect(screen.getByText(/isn't on this machine/i)).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /send my persona text/i })).not.toBeChecked();
  });

  it("reports the model the user picked", async () => {
    const onChange = vi.fn();
    render(<SorterSettings settings={base} onChange={onChange} />);

    const select = screen.getByRole("combobox");
    await userEvent.selectOptions(select, screen.getAllByRole("option")[0]);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ modelId: expect.any(String) }));
  });
});
