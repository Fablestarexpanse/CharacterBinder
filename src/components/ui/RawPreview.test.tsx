import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import RawPreview from "./RawPreview";
import { createBlankTavernCard } from "../../shared/tavernCard";

describe("RawPreview", () => {
  it("shows the card's fields as they will be written", () => {
    const card = createBlankTavernCard("Rook");
    card.data.description = "A dockhand.";
    render(<RawPreview card={card} />);

    expect(screen.getByText(/Rook/)).toBeInTheDocument();
    expect(screen.getByText(/A dockhand\./)).toBeInTheDocument();
  });
});
