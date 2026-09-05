import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ConfirmModal from "./ConfirmModal";
import TagInput from "./TagInput";
import ImageDropzone from "./ImageDropzone";

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

describe("TagInput", () => {
  it("splits what you type on commas and reports each tag", async () => {
    const onChange = vi.fn();
    render(<TagInput label="Tags" tags={[]} onChange={onChange} />);

    await userEvent.type(screen.getByRole("textbox"), "harbour, dockhand");
    // Reported on every keystroke: waiting for a blur used to lose the last tag.
    expect(onChange).toHaveBeenLastCalledWith(["harbour", "dockhand"]);
  });

  it("shows the tags it was given", () => {
    render(<TagInput label="Tags" tags={["harbour", "dockhand"]} onChange={vi.fn()} />);
    expect(screen.getByRole("textbox")).toHaveValue("harbour, dockhand");
  });
});

describe("ImageDropzone", () => {
  it("refuses a file that is not an image, and says why", async () => {
    const onFile = vi.fn();
    const { container } = render(<ImageDropzone imageSrc={null} onFile={onFile} label="Cover" />);
    const input = container.querySelector('input[type="file"]')!;

    const notAnImage = new File(["#!/bin/sh"], "script.sh", { type: "text/x-shellscript" });
    fireEvent.change(input, { target: { files: [notAnImage] } });

    expect(await screen.findByText(/isn't an image/i)).toBeInTheDocument();
    expect(onFile).not.toHaveBeenCalled();
  });

  it("hands back the data URL for an image it can read", async () => {
    const onFile = vi.fn();
    const { container } = render(<ImageDropzone imageSrc={null} onFile={onFile} label="Cover" />);
    const input = container.querySelector('input[type="file"]')!;

    fireEvent.change(input, { target: { files: [new File(["png-bytes"], "art.png", { type: "image/png" })] } });

    await vi.waitFor(() => expect(onFile).toHaveBeenCalledWith(expect.stringMatching(/^data:image\/png/)));
  });
});
