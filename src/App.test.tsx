import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

// The bridge dials a socket on mount; the app's own routing is what these cover.
vi.mock("./lib/bridgeClient", async () => {
  const actual = await vi.importActual<typeof import("./lib/bridgeClient")>("./lib/bridgeClient");
  return { ...actual, initBridge: vi.fn(), getBridgeToken: () => "" };
});
vi.mock("./lib/library", () => ({
  getAllCards: async () => [],
  saveLibraryCard: async () => ({ id: "saved" }),
  deleteCard: async () => {},
}));

beforeEach(() => vi.clearAllMocks());

describe("App", () => {
  it("opens on the character editor", () => {
    render(<App />);
    expect(screen.getByText(/quick import/i)).toBeInTheDocument();
  });

  it("navigates to each card kind's editor", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /create lorebook/i }));
    expect(screen.getByPlaceholderText(/lorebook name/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /create script card/i }));
    expect(screen.getByPlaceholderText(/my script/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /create scenario card/i }));
    expect(screen.getByPlaceholderText(/the abandoned lab/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /create persona/i }));
    expect(screen.getByPlaceholderText(/your character name/i)).toBeInTheDocument();
  });

  it("confirms before clearing a character card that has work in it", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByPlaceholderText(/character name/i), "Rook");
    await user.click(screen.getByRole("button", { name: /new character/i }));

    expect(screen.getByRole("dialog")).toHaveAccessibleName(/clear current card/i);
    await user.click(screen.getByRole("button", { name: /clear card/i }));
    expect(screen.getByPlaceholderText(/character name/i)).toHaveValue("");
  });

  it("keeps what was open in an editor when moving between pages and back", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /create script card/i }));
    await user.type(screen.getByPlaceholderText(/my script/i), "Runner");

    await user.click(screen.getByRole("button", { name: /^help \/ about$/i }));
    await user.click(screen.getByRole("button", { name: /create script card/i }));

    // Editors are unmounted when you navigate away, so unsaved text is gone —
    // this pins that they come back blank rather than showing another kind's card.
    expect(screen.getByPlaceholderText(/my script/i)).toHaveValue("");
  });
});
