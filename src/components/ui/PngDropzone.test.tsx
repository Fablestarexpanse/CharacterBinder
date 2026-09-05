import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PngDropzone from "./PngDropzone";

const png = () => new File(["bytes"], "card.png", { type: "image/png" });

describe("PngDropzone", () => {
  it("names itself for the action it performs", () => {
    render(<PngDropzone onFile={vi.fn()} label="Choose a card PNG to import">{() => null}</PngDropzone>);
    expect(screen.getByRole("button")).toHaveAccessibleName("Choose a card PNG to import, or drop one here");
  });

  it("opens the file picker from the keyboard", () => {
    // The visible target is a div and the input is hidden, so without this
    // there is no way to import a card without a mouse.
    const { container } = render(
      <PngDropzone onFile={vi.fn()} label="Choose a card PNG">{() => null}</PngDropzone>
    );
    const input = container.querySelector('input[type="file"]')!;
    const clicked = vi.fn();
    input.addEventListener("click", clicked);

    fireEvent.keyDown(screen.getByRole("button"), { key: "Enter" });
    fireEvent.keyDown(screen.getByRole("button"), { key: " " });
    expect(clicked).toHaveBeenCalledTimes(2);
  });

  it("reports a dropped file", () => {
    const onFile = vi.fn();
    render(<PngDropzone onFile={onFile} label="Choose a card PNG">{() => null}</PngDropzone>);

    fireEvent.drop(screen.getByRole("button"), { dataTransfer: { files: [png()] } });
    expect(onFile).toHaveBeenCalledWith(expect.objectContaining({ name: "card.png" }));
  });

  it("shows its drag state while a file is over it", () => {
    render(
      <PngDropzone onFile={vi.fn()} label="Choose a card PNG">
        {(dragging) => <p>{dragging ? "release it" : "drag it"}</p>}
      </PngDropzone>
    );

    expect(screen.getByText("drag it")).toBeInTheDocument();
    fireEvent.dragOver(screen.getByRole("button"));
    expect(screen.getByText("release it")).toBeInTheDocument();
    fireEvent.dragLeave(screen.getByRole("button"));
    expect(screen.getByText("drag it")).toBeInTheDocument();
  });

  it("lets the same file be chosen twice in a row", () => {
    const onFile = vi.fn();
    const { container } = render(
      <PngDropzone onFile={onFile} label="Choose a card PNG">{() => null}</PngDropzone>
    );
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [png()] } });
    // The input clears itself, so re-choosing the same file still fires.
    expect(input.value).toBe("");
    fireEvent.change(input, { target: { files: [png()] } });
    expect(onFile).toHaveBeenCalledTimes(2);
  });
});
