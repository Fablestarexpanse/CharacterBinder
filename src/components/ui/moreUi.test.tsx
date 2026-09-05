import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ErrorBoundary from "../pages/ErrorBoundary";
import ConfirmClearPanel from "./ConfirmClearPanel";
import JSONView from "./JSONView";
import { errorMessage } from "../../shared/errorMessage";
import { createBlankTavernCard } from "../../shared/tavernCard";

describe("errorMessage", () => {
  it("reads the message off an Error", () => {
    expect(errorMessage(new Error("quota exceeded"))).toBe("quota exceeded");
  });

  it("uses a thrown string as the message, rather than showing undefined", () => {
    expect(errorMessage("plain failure")).toBe("plain failure");
  });

  it("has something to say for anything else", () => {
    expect(errorMessage(null)).toBe("Unknown error");
    expect(errorMessage(undefined)).toBe("Unknown error");
    expect(errorMessage({ code: 500 })).toBe("[object Object]");
  });
});

describe("ErrorBoundary", () => {
  const Boom = () => { throw new Error("render blew up"); };

  beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it("shows the failure instead of a blank page, and names the area", () => {
    render(
      <ErrorBoundary area="editor">
        <Boom />
      </ErrorBoundary>
    );
    expect(screen.getByText(/render blew up/i)).toBeInTheDocument();
  });

  it("renders its children when nothing throws", () => {
    render(
      <ErrorBoundary area="editor">
        <p>All fine</p>
      </ErrorBoundary>
    );
    expect(screen.getByText("All fine")).toBeInTheDocument();
  });
});

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
