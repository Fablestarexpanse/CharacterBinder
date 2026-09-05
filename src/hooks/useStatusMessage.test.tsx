import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { useStatusMessage } from "./useStatusMessage";

afterEach(() => vi.useRealTimers());

function StatusProbe() {
  const { status, setMsg } = useStatusMessage(1000);
  return (
    <div>
      <button onClick={() => setMsg("Saved!", true)}>ok</button>
      <button onClick={() => setMsg("Failed.", false)}>fail</button>
      <p data-testid="status">{status ? `${status.msg}:${status.ok}` : "none"}</p>
    </div>
  );
}

describe("useStatusMessage", () => {
  it("shows a message and clears it after the delay", () => {
    vi.useFakeTimers();
    render(<StatusProbe />);

    fireEvent.click(screen.getByText("ok"));
    expect(screen.getByTestId("status")).toHaveTextContent("Saved!:true");

    act(() => void vi.advanceTimersByTime(1000));
    expect(screen.getByTestId("status")).toHaveTextContent("none");
  });

  it("replaces a standing message rather than letting the first one clear the second", () => {
    vi.useFakeTimers();
    render(<StatusProbe />);

    fireEvent.click(screen.getByText("ok"));
    act(() => void vi.advanceTimersByTime(900));
    fireEvent.click(screen.getByText("fail"));

    // The first message's timer must not clear the second 100ms later.
    act(() => void vi.advanceTimersByTime(200));
    expect(screen.getByTestId("status")).toHaveTextContent("Failed.:false");
  });
});
