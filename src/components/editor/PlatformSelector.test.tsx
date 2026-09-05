import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PlatformSelector from "./PlatformSelector";
import { PLATFORMS } from "../../shared/platforms/registry";

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
