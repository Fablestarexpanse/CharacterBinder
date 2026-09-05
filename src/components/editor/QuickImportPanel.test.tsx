import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import QuickImportPanel from "./QuickImportPanel";

// The AI paths need WebGPU or a server; these cases cover the routing and the
// keyword sort, which is the path that runs with neither.
vi.mock("../../lib/cardTextSorter/engine", async () => {
  const actual = await vi.importActual<typeof import("../../lib/cardTextSorter/engine")>("../../lib/cardTextSorter/engine");
  return { ...actual, isWebGpuAvailable: () => false };
});

beforeEach(() => vi.clearAllMocks());

const LABELLED = "Name: Kael Mercer\nAppearance: tall and wiry\nPersonality: blunt";

/** The panel is collapsed unless the card is blank; open it and hand back the box. */
async function openPanel(user: ReturnType<typeof userEvent.setup>) {
  const toggle = screen.queryByRole("button", { expanded: false });
  if (toggle) await user.click(toggle);
  return screen.getByLabelText(/paste anything/i);
}

describe("QuickImportPanel", () => {
  it("keeps the sort buttons disabled until there is text", async () => {
    const user = userEvent.setup();
    render(<QuickImportPanel target="character" current={{}} currentTags={[]} onApply={vi.fn()} />);
    const box = await openPanel(user);
    expect(screen.getByRole("button", { name: /sort into fields/i })).toBeDisabled();

    await user.type(box, "anything");
    expect(screen.getByRole("button", { name: /sort into fields/i })).toBeEnabled();
  });

  it("splits labelled text on its own labels, with no model involved", async () => {
    const user = userEvent.setup();
    render(<QuickImportPanel target="character" current={{}} currentTags={[]} onApply={vi.fn()} />);

    await user.type(await openPanel(user), LABELLED);
    await user.click(screen.getByRole("button", { name: /keywords only/i }));

    expect(screen.getByText(/proposed split/i)).toBeInTheDocument();
    expect(screen.getByText("Kael Mercer")).toBeInTheDocument();
    expect(screen.getByText("blunt")).toBeInTheDocument();
  });

  it("applies the fields the user kept, and only those", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    render(<QuickImportPanel target="character" current={{}} currentTags={[]} onApply={onApply} />);

    await user.type(await openPanel(user), LABELLED);
    await user.click(screen.getByRole("button", { name: /keywords only/i }));
    await user.click(screen.getByRole("button", { name: /^apply to \d+ field/i }));

    expect(onApply).toHaveBeenCalledTimes(1);
    const [fields] = onApply.mock.calls[0];
    expect(fields.name).toBe("Kael Mercer");
    expect(fields.personality).toBe("blunt");
  });

  it("folds persona-only sections into description for a character card", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    render(<QuickImportPanel target="character" current={{}} currentTags={[]} onApply={onApply} />);

    await user.type(await openPanel(user), LABELLED);
    await user.click(screen.getByRole("button", { name: /keywords only/i }));
    await user.click(screen.getByRole("button", { name: /^apply to \d+ field/i }));

    // A character card has no Appearance field, so that section must survive
    // inside description rather than being dropped.
    const [fields] = onApply.mock.calls[0];
    expect(fields.description).toContain("tall and wiry");
  });

  it("clears the pasted text and the proposed split", async () => {
    const user = userEvent.setup();
    render(<QuickImportPanel target="persona" current={{}} currentTags={[]} onApply={vi.fn()} />);

    await user.type(await openPanel(user), LABELLED);
    await user.click(screen.getByRole("button", { name: /keywords only/i }));
    await user.click(screen.getByRole("button", { name: /^clear$/i }));

    expect(screen.queryByText(/proposed split/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/paste anything/i)).toHaveValue("");
  });
});
