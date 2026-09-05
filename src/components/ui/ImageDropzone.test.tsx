import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ImageDropzone from "./ImageDropzone";

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
