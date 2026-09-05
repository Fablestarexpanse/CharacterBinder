import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TextAreaField from "./TextAreaField";

describe("TextAreaField", () => {
  it("labels its field and reports edits", async () => {
    const onChange = vi.fn();
    render(<TextAreaField label="Scenario" value="" onChange={onChange} placeholder="Where it happens…" rows={3} />);

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
        rows={3}
      />
    );
    expect(screen.getByText(/\d+ tk/)).toBeInTheDocument();
  });
});
