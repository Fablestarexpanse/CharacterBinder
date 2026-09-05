import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ImportPNG from "./ImportPNG";
import DecodePNG from "./DecodePNG";
import { encodeCharaToPng } from "../../lib/pngMetadata";
import { MINIMAL_PNG } from "../../lib/minimalPng";
import { createBlankTavernCard } from "../../shared/tavernCard";

/**
 * Both panels read a real PNG built by the app's own encoder, so these cover
 * the decode → detect → route path end to end rather than a mocked stand-in.
 */

function pngWith(key: Parameters<typeof encodeCharaToPng>[2], payload: unknown): File {
  const bytes = encodeCharaToPng(MINIMAL_PNG, JSON.stringify(payload), key, false);
  const file = new File([bytes as BlobPart], "card.png", { type: "image/png" });
  // jsdom's File has no arrayBuffer in this version; the panels use it.
  Object.defineProperty(file, "arrayBuffer", { value: async () => bytes.buffer });
  return file;
}

const characterPayload = () => {
  const card = createBlankTavernCard("Rook");
  card.data.description = "A dockhand.";
  return card;
};

const lorebook = {
  name: "Harbour Lore",
  entries: [{ keys: ["dock"], content: "The dock is old." }],
};

function drop(container: HTMLElement, file: File) {
  const input = container.querySelector('input[type="file"]')!;
  fireEvent.change(input, { target: { files: [file] } });
}

beforeEach(() => vi.clearAllMocks());

describe("ImportPNG", () => {
  it("loads a character card and reports the platform it came from", async () => {
    const onLoad = vi.fn();
    const { container } = render(<ImportPNG onLoad={onLoad} onOpenDataCard={vi.fn()} />);

    drop(container, pngWith("chara", characterPayload()));

    await waitFor(() => expect(onLoad).toHaveBeenCalled());
    expect(onLoad.mock.calls[0][0].data.name).toBe("Rook");
    expect(screen.getByText(/loaded character "Rook"/i)).toBeInTheDocument();
  });

  it("opens a lorebook stored under the character key as a lorebook, and says so", async () => {
    const onLoad = vi.fn();
    const onOpenDataCard = vi.fn();
    const { container } = render(<ImportPNG onLoad={onLoad} onOpenDataCard={onOpenDataCard} />);

    // The regression: trusting the keyword rebuilt this as a blank character
    // card and dropped every entry behind a success message.
    drop(container, pngWith("chara", lorebook));

    await waitFor(() => expect(onOpenDataCard).toHaveBeenCalled());
    expect(onLoad).not.toHaveBeenCalled();
    expect(onOpenDataCard.mock.calls[0][0]).toBe("lorebook");
    expect(screen.getByText(/labelled 'chara' but its contents are a lorebook/i)).toBeInTheDocument();
  });

  it("says a PNG carries no card rather than failing silently", async () => {
    const { container } = render(<ImportPNG onLoad={vi.fn()} onOpenDataCard={vi.fn()} />);
    const bare = new File([MINIMAL_PNG as BlobPart], "plain.png", { type: "image/png" });
    Object.defineProperty(bare, "arrayBuffer", { value: async () => MINIMAL_PNG.buffer });

    drop(container, bare);

    expect(await screen.findByText(/no card metadata found/i)).toBeInTheDocument();
  });
});

describe("DecodePNG", () => {
  it("lists the chunks it found and offers to open the card", async () => {
    const { container } = render(<DecodePNG onLoad={vi.fn()} onOpenDataCard={vi.fn()} />);

    drop(container, pngWith("chara", characterPayload()));

    expect(await screen.findByText(/detection result/i)).toBeInTheDocument();
    expect(screen.getByText(/text chunk/i)).toBeInTheDocument();
  });

  it("routes by payload shape, not by the keyword", async () => {
    const onOpenDataCard = vi.fn();
    const { container } = render(<DecodePNG onLoad={vi.fn()} onOpenDataCard={onOpenDataCard} />);

    drop(container, pngWith("chara", lorebook));

    expect(await screen.findByText(/its contents are a lorebook/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /load .*editor/i }));
    expect(onOpenDataCard.mock.calls[0][0]).toBe("lorebook");
  });
});
