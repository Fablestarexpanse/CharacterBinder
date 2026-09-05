import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useDataCardEditor } from "./useDataCardEditor";
import { blankScriptCard } from "../lib/blankCards";
import type { ScriptCard } from "../types";

const saveLibraryCard = vi.fn(async () => ({ id: "saved-1" }));
vi.mock("../lib/library", async () => {
  const actual = await vi.importActual<typeof import("../lib/library")>("../lib/library");
  // saveCardInput is a pure pairing helper; only the write is stubbed.
  return { ...actual, saveLibraryCard: (...args: unknown[]) => saveLibraryCard(...(args as [])) };
});

const downloadJson = vi.fn();
const downloadPng = vi.fn();
vi.mock("../lib/download", () => ({
  downloadJson: (...a: unknown[]) => downloadJson(...(a as [])),
  downloadPng: (...a: unknown[]) => downloadPng(...(a as [])),
}));

vi.mock("../lib/carrierImage", () => ({ getCarrierPng: async () => new Uint8Array([1, 2, 3]) }));
vi.mock("../lib/pngMetadata", () => ({ encodeCharaToPng: () => new Uint8Array([4, 5, 6]) }));

function Probe({ initialCard, initialLibraryId }: { initialCard?: ScriptCard; initialLibraryId?: string }) {
  const editor = useDataCardEditor({
    cardType: "script",
    blank: blankScriptCard,
    initialCard,
    initialLibraryId,
  });
  return (
    <div>
      <p data-testid="name">{editor.card.name}</p>
      <p data-testid="file">{editor.outputFileName}</p>
      <p data-testid="library-id">{editor.libraryId ?? "none"}</p>
      <p data-testid="status">{editor.status ? `${editor.status.msg}:${editor.status.ok}` : "none"}</p>
      <button onClick={() => editor.update({ name: "Renamed" })}>rename</button>
      <button onClick={() => editor.update({ version: "2.0" })}>bump</button>
      <button onClick={() => editor.setOutputFileName("mine.png")}>rename file</button>
      <button onClick={() => void editor.save()}>save</button>
      <button onClick={editor.exportJson}>export json</button>
      <button onClick={() => void editor.exportPng()}>export png</button>
      <button onClick={editor.clear}>clear</button>
    </div>
  );
}

const scriptCard = (over: Partial<ScriptCard> = {}): ScriptCard => ({ ...blankScriptCard(), name: "Runner", ...over });

beforeEach(() => {
  vi.clearAllMocks();
  saveLibraryCard.mockResolvedValue({ id: "saved-1" });
});

describe("useDataCardEditor", () => {
  it("derives the filename from the card name, then leaves a typed one alone", () => {
    render(<Probe initialCard={scriptCard()} />);
    expect(screen.getByTestId("file")).toHaveTextContent("Runner_script.png");

    fireEvent.click(screen.getByText("rename file"));
    fireEvent.click(screen.getByText("rename"));
    expect(screen.getByTestId("file")).toHaveTextContent("mine.png");
  });

  it("saves with the card's own tags and adopts the id it gets back", async () => {
    render(<Probe initialCard={scriptCard({ tags: ["util"] })} />);
    fireEvent.click(screen.getByText("save"));

    await waitFor(() => expect(screen.getByTestId("library-id")).toHaveTextContent("saved-1"));
    expect(saveLibraryCard).toHaveBeenCalledWith(
      expect.objectContaining({ cardType: "script", tags: ["util"], existingId: undefined })
    );
    expect(screen.getByTestId("status")).toHaveTextContent("Saved to library!:true");
  });

  it("updates in place while the version is unchanged", async () => {
    render(<Probe initialCard={scriptCard()} initialLibraryId="existing-1" />);
    fireEvent.click(screen.getByText("save"));

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("Library updated!:true"));
    expect(saveLibraryCard).toHaveBeenCalledWith(expect.objectContaining({ existingId: "existing-1" }));
  });

  it("forks a new record when the version changes, keeping the old one", async () => {
    render(<Probe initialCard={scriptCard()} initialLibraryId="existing-1" />);
    fireEvent.click(screen.getByText("bump"));
    fireEvent.click(screen.getByText("save"));

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("Saved as new version!:true"));
    expect(saveLibraryCard).toHaveBeenCalledWith(expect.objectContaining({ existingId: undefined }));
  });

  it("reports why a save failed rather than a bare failure", async () => {
    saveLibraryCard.mockRejectedValueOnce(new Error("quota exceeded"));
    render(<Probe initialCard={scriptCard()} />);
    fireEvent.click(screen.getByText("save"));

    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("Failed to save to library: quota exceeded:false")
    );
  });

  it("exports JSON and PNG under the current filename", async () => {
    render(<Probe initialCard={scriptCard()} />);

    fireEvent.click(screen.getByText("export json"));
    expect(downloadJson).toHaveBeenCalledWith(expect.objectContaining({ name: "Runner" }), "Runner_script.png");

    fireEvent.click(screen.getByText("export png"));
    await waitFor(() => expect(downloadPng).toHaveBeenCalledWith(expect.any(Uint8Array), "Runner_script.png"));
  });

  it("clears back to a blank card, dropping the library identity", async () => {
    render(<Probe initialCard={scriptCard()} initialLibraryId="existing-1" />);
    fireEvent.click(screen.getByText("clear"));

    expect(screen.getByTestId("name")).toHaveTextContent("");
    expect(screen.getByTestId("file")).toHaveTextContent("script.png");
    expect(screen.getByTestId("library-id")).toHaveTextContent("none");
  });
});

describe("unsaved-work guard", () => {
  const beforeUnloadPrevented = () => {
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  };

  it("does not guard a card that has not been touched", () => {
    render(<Probe />);
    expect(beforeUnloadPrevented()).toBe(false);
  });

  it("guards an edited card that was never saved", () => {
    render(<Probe />);
    fireEvent.click(screen.getByText("rename"));
    expect(beforeUnloadPrevented()).toBe(true);
  });

  it("stops guarding once the card is saved", async () => {
    render(<Probe />);
    fireEvent.click(screen.getByText("rename"));
    fireEvent.click(screen.getByText("save"));

    await waitFor(() => expect(screen.getByTestId("library-id")).toHaveTextContent("saved-1"));
    expect(beforeUnloadPrevented()).toBe(false);
  });

  it("guards again when the card is edited after a save", async () => {
    render(<Probe />);
    fireEvent.click(screen.getByText("save"));
    await waitFor(() => expect(screen.getByTestId("library-id")).toHaveTextContent("saved-1"));

    // The case the old check missed: a card already in the library, edited
    // again, was left unguarded.
    fireEvent.click(screen.getByText("rename"));
    expect(beforeUnloadPrevented()).toBe(true);
  });
});
