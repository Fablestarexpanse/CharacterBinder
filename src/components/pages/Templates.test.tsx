import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Templates from "./Templates";
import type { CustomTemplate } from "../../lib/customTemplates";
import { createBlankTavernCard } from "../../shared/tavernCard";

const getCustomTemplates = vi.fn((): CustomTemplate[] => []);
const deleteCustomTemplate = vi.fn((_id: string) => {});
vi.mock("../../lib/customTemplates", () => ({
  getCustomTemplates: () => getCustomTemplates(),
  deleteCustomTemplate: (id: string) => deleteCustomTemplate(id),
}));

const custom = (id: string, name: string): CustomTemplate => ({
  id,
  name,
  description: "Saved from the editor",
  card: createBlankTavernCard(name),
  createdAt: 1,
});

beforeEach(() => {
  vi.clearAllMocks();
  getCustomTemplates.mockReturnValue([custom("t1", "My Template")]);
});

describe("Templates", () => {
  it("lists the built-in templates alongside saved ones", () => {
    render(<Templates onLoad={vi.fn()} />);
    expect(screen.getByText("Blank Character")).toBeInTheDocument();
    expect(screen.getByText("Ronan Voss")).toBeInTheDocument();
    expect(screen.getByText("My Template")).toBeInTheDocument();
  });

  it("loads the card behind a template", async () => {
    const onLoad = vi.fn();
    render(<Templates onLoad={onLoad} />);

    // Each template card carries its own "Use Template" button; take the one
    // sitting in the Ronan Voss card.
    const useButtons = screen.getAllByRole("button", { name: /use template/i });
    const ronan = useButtons.find((b) => b.closest("div")?.textContent?.includes("Ronan Voss"))!;
    await userEvent.click(ronan);
    expect(onLoad).toHaveBeenCalledTimes(1);
    expect(onLoad.mock.calls[0][0].data.name).toBe("Ronan Voss");
  });

  it("confirms before deleting a saved template, since there is no undo", async () => {
    const user = userEvent.setup();
    render(<Templates onLoad={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /delete my template/i }));
    expect(deleteCustomTemplate).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /^delete$/i }));
    expect(deleteCustomTemplate).toHaveBeenCalledWith("t1");
  });

  it("says so when a delete is refused by the browser", async () => {
    const user = userEvent.setup();
    deleteCustomTemplate.mockImplementationOnce(() => { throw new Error("storage blocked"); });
    render(<Templates onLoad={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /delete my template/i }));
    await user.click(screen.getByRole("button", { name: /^delete$/i }));

    expect(await screen.findByText(/storage blocked/i)).toBeInTheDocument();
  });
});
