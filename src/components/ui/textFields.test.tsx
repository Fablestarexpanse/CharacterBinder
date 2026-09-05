import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ResizableTextArea from "./ResizableTextArea";
import TextAreaField from "./TextAreaField";
import RawPreview from "./RawPreview";
import { createBlankTavernCard } from "../../shared/tavernCard";

describe("ResizableTextArea", () => {
  it("reports what the user types", async () => {
    const onChange = vi.fn();
    render(<ResizableTextArea value="" onChange={onChange} placeholder="Describe…" />);

    await userEvent.type(screen.getByPlaceholderText("Describe…"), "a");
    expect(onChange).toHaveBeenCalled();
  });

  it("offers its resize handle to the keyboard, not just the mouse", () => {
    render(<ResizableTextArea value="" onChange={vi.fn()} placeholder="Describe…" />);
    const handle = screen.getByRole("separator");

    const before = screen.getByPlaceholderText("Describe…").style.height;
    fireEvent.keyDown(handle, { key: "ArrowDown" });
    expect(screen.getByPlaceholderText("Describe…").style.height).not.toBe(before);
  });
});

describe("TextAreaField", () => {
  it("labels its field and reports edits", async () => {
    const onChange = vi.fn();
    render(<TextAreaField label="Scenario" value="" onChange={onChange} placeholder="Where it happens…" />);

    const field = screen.getByLabelText("Scenario");
    await userEvent.type(field, "x");
    expect(onChange).toHaveBeenCalledWith("x");
  });

  it("counts the tokens its content costs", () => {
    render(
      <TextAreaField
        label="Scenario"
        value="The quick brown fox jumps over the lazy dog."
        onChange={vi.fn()}
        placeholder="Where it happens…"
      />
    );
    expect(screen.getByText(/\d+ tk/)).toBeInTheDocument();
  });
});

describe("RawPreview", () => {
  it("shows the card's fields as they will be written", () => {
    const card = createBlankTavernCard("Rook");
    card.data.description = "A dockhand.";
    render(<RawPreview card={card} />);

    expect(screen.getByText(/Rook/)).toBeInTheDocument();
    expect(screen.getByText(/A dockhand\./)).toBeInTheDocument();
  });
});
