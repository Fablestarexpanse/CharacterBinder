import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { useTimedFlag } from "./useTimedFlag";

afterEach(() => vi.useRealTimers());

function FlagProbe() {
  const [flagged, raise] = useTimedFlag(500);
  return (
    <div>
      <button onClick={raise}>copy</button>
      <p data-testid="flag">{flagged ? "on" : "off"}</p>
    </div>
  );
}

describe("useTimedFlag", () => {
  it("raises the flag and lowers it again on its own", () => {
    vi.useFakeTimers();
    render(<FlagProbe />);

    expect(screen.getByTestId("flag")).toHaveTextContent("off");
    fireEvent.click(screen.getByText("copy"));
    expect(screen.getByTestId("flag")).toHaveTextContent("on");

    act(() => void vi.advanceTimersByTime(500));
    expect(screen.getByTestId("flag")).toHaveTextContent("off");
  });
});
