import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ConfirmClearPanel from "./ConfirmClearPanel";

describe("ConfirmClearPanel", () => {
  it("asks before clearing, and only then clears", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<ConfirmClearPanel label="Lorebook" onConfirm={onConfirm} />);

    await user.click(screen.getByRole("button", { name: /new lorebook/i }));
    expect(onConfirm).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /clear/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("backs out without clearing", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<ConfirmClearPanel label="Lorebook" onConfirm={onConfirm} />);

    await user.click(screen.getByRole("button", { name: /new lorebook/i }));
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
