import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ScriptEditor from "./ScriptEditor";
import ScenarioEditor from "./ScenarioEditor";
import PersonaEditor from "./PersonaEditor";

const saveLibraryCard = vi.fn(async (_input: unknown) => ({ id: "saved-1" }));
vi.mock("../../lib/library", async () => {
  const actual = await vi.importActual<typeof import("../../lib/library")>("../../lib/library");
  return { ...actual, saveLibraryCard: (i: unknown) => saveLibraryCard(i) };
});

const downloadJson = vi.fn();
vi.mock("../../lib/download", () => ({
  downloadJson: (d: unknown, n: string) => downloadJson(d, n),
  downloadPng: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  saveLibraryCard.mockResolvedValue({ id: "saved-1" });
});

/**
 * The three simple editors share one hook, so these cover what each still owns:
 * its own fields, its metadata key, and the shape it hands the library.
 */

describe("ScriptEditor", () => {
  it("saves the script body under the field the card type reads", async () => {
    const user = userEvent.setup();
    render(<ScriptEditor />);

    await user.type(screen.getByPlaceholderText(/my script/i), "Runner");
    await user.type(screen.getByLabelText(/script code/i), "console.log(1);");
    await user.click(screen.getByRole("button", { name: /save to library/i }));

    await waitFor(() => expect(saveLibraryCard).toHaveBeenCalled());
    const input = saveLibraryCard.mock.calls[0][0] as { cardType: string; body: Record<string, unknown> };
    expect(input.cardType).toBe("script");
    expect(input.body.name).toBe("Runner");
    expect(input.body.content).toBe("console.log(1);");
    expect(input.body.spec).toBe("script_card_v1");
  });

  it("names the exported file after the card", async () => {
    const user = userEvent.setup();
    render(<ScriptEditor />);

    await user.type(screen.getByPlaceholderText(/my script/i), "Runner");
    await user.click(screen.getByRole("button", { name: /export json/i }));

    expect(downloadJson.mock.calls[0][1]).toBe("Runner_script.png");
  });
});

describe("ScenarioEditor", () => {
  it("saves the scenario's own fields under its spec", async () => {
    const user = userEvent.setup();
    render(<ScenarioEditor />);

    await user.type(screen.getByPlaceholderText(/the abandoned lab/i), "The Lab");
    await user.click(screen.getByRole("button", { name: /save to library/i }));

    await waitFor(() => expect(saveLibraryCard).toHaveBeenCalled());
    const input = saveLibraryCard.mock.calls[0][0] as { cardType: string; body: Record<string, unknown> };
    expect(input.cardType).toBe("scenario");
    expect(input.body.name).toBe("The Lab");
    expect(input.body.spec).toBe("scenario_card_v1");
  });
});

describe("PersonaEditor", () => {
  it("saves the persona under its spec", async () => {
    const user = userEvent.setup();
    render(<PersonaEditor />);

    await user.type(screen.getByPlaceholderText(/your character name/i), "Kael");
    await user.click(screen.getByRole("button", { name: /save to library/i }));

    await waitFor(() => expect(saveLibraryCard).toHaveBeenCalled());
    const input = saveLibraryCard.mock.calls[0][0] as { cardType: string; body: Record<string, unknown> };
    expect(input.cardType).toBe("persona");
    expect(input.body.name).toBe("Kael");
    expect(input.body.spec).toBe("persona_card_v1");
  });

  it("applies a smart-import split into the persona's fields", async () => {
    const user = userEvent.setup();
    render(<PersonaEditor />);

    await user.type(
      screen.getByLabelText(/paste anything/i),
      "Name: Kael Mercer\nAppearance: tall and wiry\nPersonality: blunt"
    );
    await user.click(screen.getByRole("button", { name: /keywords only/i }));
    await user.click(screen.getByRole("button", { name: /^apply to \d+ field/i }));

    // A persona has its own Appearance field, so the section lands there rather
    // than being folded into the description the way a character card needs.
    expect(screen.getByPlaceholderText(/your character name/i)).toHaveValue("Kael Mercer");
    expect(screen.getByDisplayValue("tall and wiry")).toBeInTheDocument();
  });
});
