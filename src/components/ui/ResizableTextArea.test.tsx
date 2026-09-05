import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ResizableTextArea from "./ResizableTextArea";

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
