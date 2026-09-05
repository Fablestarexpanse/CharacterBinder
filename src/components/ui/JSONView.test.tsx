import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import JSONView from "./JSONView";
import { createBlankTavernCard } from "../../shared/tavernCard";

describe("JSONView", () => {
  const card = () => {
    const c = createBlankTavernCard("Rook");
    c.data.description = "A dockhand.";
    return c;
  };

  it("shows the card as JSON", () => {
    render(<JSONView card={card()} onUpdate={vi.fn()} />);
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toContain('"Rook"');
  });

  it("reports invalid JSON as you type, and refuses to apply it", async () => {
    const onUpdate = vi.fn();
    render(<JSONView card={card()} onUpdate={onUpdate} />);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "{ not json" } });
    // The parser's own message is shown, whatever this engine words it as.
    expect((await screen.findAllByText(/unexpected|expected|json/i)).length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole("button", { name: /apply/i }));
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("applies an edited card back to the editor", async () => {
    const onUpdate = vi.fn();
    const edited = card();
    edited.data.name = "Rook the Elder";
    render(<JSONView card={card()} onUpdate={onUpdate} />);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: JSON.stringify(edited) } });
    await userEvent.click(screen.getByRole("button", { name: /apply/i }));

    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ name: "Rook the Elder" }));
  });
});

describe("copying", () => {
  const card = () => createBlankTavernCard("Rook");

  it("says so when the browser refuses the clipboard", async () => {
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText: () => Promise.reject(new Error("Write permission denied")) },
    });
    try {
      render(<JSONView card={card()} onUpdate={vi.fn()} />);
      await userEvent.click(screen.getByRole("button", { name: /copy/i }));
      // A Copy button that quietly does nothing is worse than one that explains.
      expect(await screen.findByText(/couldn't copy to the clipboard/i)).toBeInTheDocument();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
