import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CreateCard from "./CreateCard";
import { createBlankTavernCard } from "../../shared/tavernCard";
import { DEFAULT_SETTINGS } from "../../lib/settings";
import type { CardProject } from "../../types";

const saveLibraryCard = vi.fn(async (_input: unknown) => ({ id: "saved-1" }));
vi.mock("../../lib/library", () => ({ saveLibraryCard: (input: unknown) => saveLibraryCard(input) }));

const downloadJson = vi.fn();
const downloadPng = vi.fn();
vi.mock("../../lib/download", () => ({
  downloadJson: (d: unknown, n: string) => downloadJson(d, n),
  downloadPng: (b: unknown, n: string) => downloadPng(b, n),
}));
vi.mock("../../lib/carrierImage", () => ({ getCarrierPng: async () => new Uint8Array([1]) }));
vi.mock("../../lib/pngMetadata", () => ({ encodeCharaToPng: () => new Uint8Array([2]) }));

const project = (name: string, description = "A dockhand of few words."): CardProject => {
  const card = createBlankTavernCard(name);
  card.data.description = description;
  card.data.first_mes = "Evening.";
  return { id: "default", card, imageSrc: undefined, outputFileName: `${name}.png`, lastModified: "" };
};

// The panel is exercised through the page that owns the card: export, save and
// template writing live in useCharacterCardActions, which CreateCard calls and
// the panel only renders.
const props = {
  settings: DEFAULT_SETTINGS,
  onUpdateCard: vi.fn(),
  onUpdateImage: vi.fn(),
  targetPlatform: "sillytavern" as const,
  onUpdateOutputFileName: vi.fn(),
  onSavedToLibrary: vi.fn(),
  onPlatformChange: vi.fn(),
  onNewCard: vi.fn(),
};

beforeEach(() => vi.clearAllMocks());

describe("CreateCard", () => {
  it("shows a token count that grows with the card", () => {
    const { unmount } = render(<CreateCard project={project("Rook", "short")} {...props} />);
    const small = Number(screen.getByRole("button", { name: /token count/i }).textContent!.replace(/\D/g, ""));
    unmount();

    render(<CreateCard project={project("Rook", "a much longer description ".repeat(20))} {...props} />);
    const large = Number(screen.getByRole("button", { name: /token count/i }).textContent!.replace(/\D/g, ""));
    expect(large).toBeGreaterThan(small);
  });

  it("reports validation errors for a card that is missing required fields", async () => {
    const user = userEvent.setup();
    render(<CreateCard project={project("", "")} {...props} />);

    await user.click(screen.getByRole("button", { name: /^validate$/i }));
    expect((await screen.findAllByText(/name is required/i)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/description is required/i).length).toBeGreaterThan(0);
  });

  it("reports a valid card as valid", async () => {
    const user = userEvent.setup();
    render(<CreateCard project={project("Rook")} {...props} />);

    await user.click(screen.getByRole("button", { name: /^validate$/i }));
    expect((await screen.findAllByText(/valid/i)).length).toBeGreaterThan(0);
  });

  it("exports JSON under the project's filename", async () => {
    const user = userEvent.setup();
    render(<CreateCard project={project("Rook")} {...props} />);

    await user.click(screen.getByRole("button", { name: /export json/i }));
    // The platform is appended and the .png extension dropped, because the JSON
    // written for one platform is not the JSON written for another.
    await waitFor(() => expect(downloadJson).toHaveBeenCalled());
    expect(downloadJson.mock.calls[0][1]).toBe("Rook_sillytavern");
  });

  it("saves to the library and reports the new id", async () => {
    const user = userEvent.setup();
    const onSavedToLibrary = vi.fn();
    render(<CreateCard project={project("Rook")} {...props} onSavedToLibrary={onSavedToLibrary} />);

    await user.click(screen.getByRole("button", { name: /save to library/i }));
    await waitFor(() => expect(onSavedToLibrary).toHaveBeenCalledWith("saved-1"));
  });

  it("says why a save failed instead of a bare failure", async () => {
    const user = userEvent.setup();
    saveLibraryCard.mockRejectedValueOnce(new Error("quota exceeded"));
    render(<CreateCard project={project("Rook")} {...props} />);

    await user.click(screen.getByRole("button", { name: /save to library/i }));
    expect(await screen.findByText(/quota exceeded/i)).toBeInTheDocument();
  });
});
