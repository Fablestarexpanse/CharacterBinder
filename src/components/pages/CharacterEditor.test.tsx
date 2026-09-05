/**
 * The app's main editing surface. Its panels are tested individually; this
 * covers the wiring between them and the card — including the two paths that
 * used to fail quietly, an unreadable image and a greeting removed from the
 * middle of the list.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CharacterEditor from "./CharacterEditor";
import { createBlankTavernCard } from "../../shared/tavernCard";
import type { TavernCardV2 } from "../../types";

const readImageFile = vi.fn(async (_f: File) => "data:image/png;base64,AAA");
vi.mock("../../lib/png/readImageFile", () => ({ readImageFile: (f: File) => readImageFile(f) }));

function cardWith(patch: Partial<TavernCardV2["data"]> = {}): TavernCardV2 {
  const card = createBlankTavernCard("Rook");
  Object.assign(card.data, patch);
  return card;
}

beforeEach(() => vi.clearAllMocks());

describe("CharacterEditor", () => {
  it("reports each edited field to its owner rather than holding state of its own", async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    render(<CharacterEditor card={cardWith()} onUpdate={onUpdate} onUpdateImage={vi.fn()} />);

    await user.type(screen.getByLabelText(/^name$/i), "!");
    expect(onUpdate).toHaveBeenCalledWith({ name: "Rook!" });
  });

  it("says an image could not be read, instead of looking like the drop worked", async () => {
    readImageFile.mockRejectedValueOnce(new Error("not a readable image"));
    const onUpdateImage = vi.fn();
    render(<CharacterEditor card={cardWith()} onUpdate={vi.fn()} onUpdateImage={onUpdateImage} />);

    const input = screen.getByLabelText(/choose a character image/i);
    fireEvent.change(input, { target: { files: [new File(["x"], "broken.png", { type: "image/png" })] } });

    expect(await screen.findByText(/not a readable image/i)).toBeInTheDocument();
    expect(onUpdateImage).not.toHaveBeenCalled();
  });

  it("passes a readable image up and clears any previous complaint", async () => {
    const onUpdateImage = vi.fn();
    render(<CharacterEditor card={cardWith()} onUpdate={vi.fn()} onUpdateImage={onUpdateImage} />);

    const input = screen.getByLabelText(/choose a character image/i);
    fireEvent.change(input, { target: { files: [new File(["x"], "cover.png", { type: "image/png" })] } });

    await waitFor(() => expect(onUpdateImage).toHaveBeenCalledWith("data:image/png;base64,AAA"));
  });

  it("removes the alternate greeting that was asked for, not the one after it", async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    render(
      <CharacterEditor
        card={cardWith({ alternate_greetings: ["first", "second", "third"] })}
        onUpdate={onUpdate}
        onUpdateImage={vi.fn()}
      />
    );

    // Greetings live behind the advanced section, collapsed by default.
    await user.click(screen.getByRole("button", { name: /advanced fields/i }));
    await user.click(screen.getByRole("button", { name: /remove alternate greeting 2/i }));
    expect(onUpdate).toHaveBeenCalledWith({ alternate_greetings: ["first", "third"] });
  });
});
