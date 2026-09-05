import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PlatformSelector from "./PlatformSelector";
import FieldCompatibility from "./FieldCompatibility";
import { PLATFORMS } from "../../shared/platforms";

describe("PlatformSelector", () => {
  it("lists every platform the app can export to", () => {
    render(<PlatformSelector selected="sillytavern" onChange={vi.fn()} />);
    for (const platform of Object.values(PLATFORMS)) {
      expect(screen.getByText(platform.name)).toBeInTheDocument();
    }
  });

  it("reports the platform the user picked", async () => {
    const onChange = vi.fn();
    render(<PlatformSelector selected="sillytavern" onChange={onChange} />);

    await userEvent.click(screen.getByText(PLATFORMS.janitorai.name));
    expect(onChange).toHaveBeenCalledWith("janitorai");
  });
});

describe("FieldCompatibility", () => {
  it("marks every field with how the target platform handles it", () => {
    render(<FieldCompatibility platformId="janitorai" />);
    // Silently losing fields on export is the whole reason this panel exists.
    expect(screen.getAllByText("Not supported").length).toBe(
      PLATFORMS.janitorai.fields.filter((f) => f.support === "none").length
    );
    expect(screen.getAllByText("Renamed").length).toBe(
      PLATFORMS.janitorai.fields.filter((f) => f.support === "renamed").length
    );
  });

  it("in compact form, counts the losses and says when there are none", () => {
    const { unmount } = render(<FieldCompatibility platformId="janitorai" compact />);
    expect(screen.getByText(/not exported \(7\)/i)).toBeInTheDocument();
    unmount();

    render(<FieldCompatibility platformId="sillytavern" compact />);
    expect(screen.getByText(/all \d+ fields fully supported/i)).toBeInTheDocument();
    expect(screen.queryByText(/not exported/i)).not.toBeInTheDocument();
  });
});
