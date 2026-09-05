import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Settings from "./Settings";
import { DEFAULT_SETTINGS } from "../../lib/settings";

const setBridgeToken = vi.fn((_t: string) => {});
vi.mock("../../lib/bridgeClient", async () => {
  const actual = await vi.importActual<typeof import("../../lib/bridgeClient")>("../../lib/bridgeClient");
  return { ...actual, getBridgeToken: () => "", setBridgeToken: (t: string) => setBridgeToken(t) };
});

beforeEach(() => vi.clearAllMocks());

describe("Settings", () => {
  it("holds a change as a draft until it is saved", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<Settings settings={DEFAULT_SETTINGS} onSave={onSave} />);

    await user.click(screen.getByLabelText(/pretty-print json exports/i));
    // Editing alone must not persist: the page has an explicit Save.
    expect(onSave).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /save settings/i }));
    expect(onSave).toHaveBeenCalledWith({ ...DEFAULT_SETTINGS, prettyPrintJson: !DEFAULT_SETTINGS.prettyPrintJson });
  });

  it("puts every setting back to its default on reset", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<Settings settings={{ ...DEFAULT_SETTINGS, prettyPrintJson: false }} onSave={onSave} />);

    await user.click(screen.getByRole("button", { name: /reset/i }));
    await user.click(screen.getByRole("button", { name: /save settings/i }));
    expect(onSave).toHaveBeenCalledWith(DEFAULT_SETTINGS);
  });

  it("stores the pairing token it is given, trimming what was pasted", async () => {
    const user = userEvent.setup();
    render(<Settings settings={DEFAULT_SETTINGS} onSave={vi.fn()} />);

    // A password field has no textbox role; it is reached by its own label.
    const field = screen.getByLabelText("Pairing token");
    await user.type(field, "  abc123  ");
    await user.click(screen.getByRole("button", { name: /save pairing token/i }));

    // The trim happens in setBridgeToken, so the field's raw value is passed on.
    expect(setBridgeToken).toHaveBeenCalledWith("  abc123  ");
  });
});
