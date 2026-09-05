import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoreBookEditor from "./LoreBookEditor";

// The editor's only outside dependency in these tests is the library write,
// which needs IndexedDB. Everything else — entries, selection, the filename —
// is local state, which is what these cases are about.
const saveLibraryCard = vi.fn(async () => ({ id: "saved-id" }));
vi.mock("../../lib/library", async () => {
  const actual = await vi.importActual<typeof import("../../lib/library")>("../../lib/library");
  return { ...actual, saveLibraryCard: () => saveLibraryCard() };
});

const book = (entries: number) => ({
  name: "World",
  description: "",
  creator: "",
  version: "1.0",
  creator_notes: "",
  scan_depth: 50,
  token_budget: 512,
  recursive_scanning: false,
  entries: Array.from({ length: entries }, (_, i) => ({
    id: `e${i}`,
    name: `Entry ${i}`,
    keys: [`k${i}`],
    secondary_keys: [],
    content: `Content ${i}`,
    enabled: true,
    insertion_order: 100,
    case_sensitive: false,
    priority: 10,
    selective: false,
    constant: false,
    position: "before_char" as const,
    comment: "",
  })),
});

beforeEach(() => vi.clearAllMocks());

describe("LoreBookEditor", () => {
  it("opens with the first entry of a loaded book selected", () => {
    render(<LoreBookEditor initialCard={book(2)} />);
    expect(screen.getByPlaceholderText("Dragon Lore...")).toHaveValue("Entry 0");
  });

  it("adds an entry and selects it", async () => {
    const user = userEvent.setup();
    render(<LoreBookEditor initialCard={book(1)} />);
    await user.click(screen.getByRole("button", { name: /add entry/i }));
    // The new entry is blank and selected, so the detail pane shows empty fields.
    expect(screen.getByPlaceholderText("Dragon Lore...")).toHaveValue("");
  });

  it("edits the selected entry's name in the list as you type", async () => {
    const user = userEvent.setup();
    render(<LoreBookEditor initialCard={book(1)} />);
    const nameField = screen.getByPlaceholderText("Dragon Lore...");
    await user.clear(nameField);
    await user.type(nameField, "Dragons");
    expect(screen.getByText("Dragons")).toBeInTheDocument();
  });

  it("derives the output filename from the book name, then leaves a typed one alone", async () => {
    const user = userEvent.setup();
    render(<LoreBookEditor initialCard={book(1)} />);
    const fileField = screen.getByDisplayValue("World_lorebook.png");

    await user.clear(fileField);
    await user.type(fileField, "my_file.png");

    const bookName = screen.getByPlaceholderText("Lorebook name...");
    await user.type(bookName, " Two");

    expect(fileField).toHaveValue("my_file.png");
  });

  it("counts the entries it holds", async () => {
    const user = userEvent.setup();
    render(<LoreBookEditor initialCard={book(2)} />);
    await user.click(screen.getByRole("button", { name: /add entry/i }));
    const aside = screen.getByText("Entries").closest("div")!;
    expect(within(aside).getByText("3")).toBeInTheDocument();
  });
});
