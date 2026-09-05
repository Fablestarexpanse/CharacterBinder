import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import ErrorBoundary from "./ErrorBoundary";

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
