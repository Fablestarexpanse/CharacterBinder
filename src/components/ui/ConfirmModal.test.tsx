import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ConfirmModal from "./ConfirmModal";

describe("ConfirmModal", () => {
  const props = { title: "Delete card?", message: "This cannot be undone.", onConfirm: vi.fn(), onCancel: vi.fn() };

  it("announces itself as a dialog with its title and message", () => {
    render(<ConfirmModal {...props} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAccessibleName("Delete card?");
    expect(screen.getByText("This cannot be undone.")).toBeInTheDocument();
  });

  it("cancels on Escape, so the destructive path is never the easy one", () => {
    const onCancel = vi.fn();
    render(<ConfirmModal {...props} onCancel={onCancel} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onCancel).toHaveBeenCalled();
  });

  it("does not confirm on a bare Enter", async () => {
    // Enter used to confirm from anywhere in the dialog, which meant a keyboard
    // user could destroy a card by dismissing what they thought was a prompt.
    const onConfirm = vi.fn();
    render(<ConfirmModal {...props} onConfirm={onConfirm} />);
    await userEvent.keyboard("{Enter}");
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("confirms when the confirm button is pressed", async () => {
    const onConfirm = vi.fn();
    render(<ConfirmModal {...props} confirmLabel="Delete Card" onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole("button", { name: "Delete Card" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
