import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TagInput from "./TagInput";

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
