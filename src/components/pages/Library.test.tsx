import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Library from "./Library";
import type { LibraryCard } from "../../types";
import { createBlankTavernCard } from "../../shared/tavernCard";
import { blankPersonaCard } from "../../lib/blankCards";

const getAllCards = vi.fn(async (): Promise<LibraryCard[]> => []);
const deleteCard = vi.fn(async (_id: string) => {});
vi.mock("../../lib/library", () => ({
  getAllCards: () => getAllCards(),
  deleteCard: (id: string) => deleteCard(id),
}));

const exportCardsAsZip = vi.fn(async (_cards: LibraryCard[]) => {});
vi.mock("../../lib/archive", () => ({ exportCardsAsZip: (cards: LibraryCard[]) => exportCardsAsZip(cards) }));

const base = { pngData: null, imageSrc: null, createdAt: 1, updatedAt: 2 };
const libraryCharacter = (id: string, name: string): LibraryCard => ({
  ...base, id, name, cardType: "character", cardData: createBlankTavernCard(name), platform: "sillytavern", tags: ["harbour"],
});
const persona = (id: string, name: string): LibraryCard => ({
  ...base, id, name, cardType: "persona", rawData: { ...blankPersonaCard(), name }, platform: "persona", tags: [],
});

beforeEach(() => {
  vi.clearAllMocks();
  getAllCards.mockResolvedValue([libraryCharacter("c1", "Rook"), persona("p1", "Kael")]);
});

const props = { onEditCard: vi.fn(), onOpenDataCard: vi.fn() };

describe("Library", () => {
  it("groups cards under their kind", async () => {
    render(<Library {...props} />);
    expect(await screen.findByText("Rook")).toBeInTheDocument();
    expect(screen.getByText("Character Cards")).toBeInTheDocument();
    // "Personas" also appears as the card's own type badge, so match the heading.
    expect(screen.getAllByText("Personas").length).toBeGreaterThan(0);
  });

  it("filters on name, type and tag", async () => {
    const user = userEvent.setup();
    render(<Library {...props} />);
    await screen.findByText("Rook");

    const search = screen.getByRole("textbox", { name: /search the library/i });
    await user.type(search, "kael");
    expect(screen.queryByText("Rook")).not.toBeInTheDocument();

    await user.clear(search);
    await user.type(search, "harbour");
    expect(screen.getByText("Rook")).toBeInTheDocument();
    expect(screen.queryByText("Kael")).not.toBeInTheDocument();
  });

  it("opens a character through onEditCard and a data card through onOpenDataCard", async () => {
    const user = userEvent.setup();
    const onEditCard = vi.fn();
    const onOpenDataCard = vi.fn();
    render(<Library onEditCard={onEditCard} onOpenDataCard={onOpenDataCard} />);

    await user.click(await screen.findByRole("button", { name: /edit rook/i }));
    expect(onEditCard).toHaveBeenCalledWith(expect.objectContaining({ spec: "chara_card_v2" }), null, "c1");

    await user.click(screen.getByRole("button", { name: /edit kael/i }));
    expect(onOpenDataCard).toHaveBeenCalledWith("persona", expect.objectContaining({ name: "Kael" }), null, "p1");
  });

  it("confirms before deleting, and only then deletes", async () => {
    const user = userEvent.setup();
    render(<Library {...props} />);

    await user.click(await screen.findByRole("button", { name: /delete rook/i }));
    expect(deleteCard).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /^delete$/i }));
    await waitFor(() => expect(deleteCard).toHaveBeenCalledWith("c1"));
  });

  it("says what went wrong when the library cannot be read", async () => {
    getAllCards.mockRejectedValueOnce(new Error("storage blocked"));
    render(<Library {...props} />);
    expect(await screen.findByText(/couldn't read your library: storage blocked/i)).toBeInTheDocument();
  });

  it("says what went wrong when the archive cannot be built", async () => {
    const user = userEvent.setup();
    exportCardsAsZip.mockRejectedValueOnce(new Error("out of memory"));
    render(<Library {...props} />);

    await user.click(await screen.findByRole("button", { name: /archive all/i }));
    expect(await screen.findByText(/couldn't build the archive: out of memory/i)).toBeInTheDocument();
    // The button must not be left stuck on "Archiving…".
    expect(screen.getByRole("button", { name: /archive all/i })).toBeEnabled();
  });

  it("refuses to open a character record with no card body, and says which", async () => {
    const broken = { ...libraryCharacter("c2", "Damaged"), cardData: undefined } as unknown as LibraryCard;
    getAllCards.mockResolvedValue([broken]);
    const onEditCard = vi.fn();
    const user = userEvent.setup();
    render(<Library onEditCard={onEditCard} onOpenDataCard={vi.fn()} />);

    await user.click(await screen.findByRole("button", { name: /edit damaged/i }));
    expect(onEditCard).not.toHaveBeenCalled();
    expect(screen.getByText(/its character data is missing or damaged/i)).toBeInTheDocument();
  });
});
