import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { useStatusMessage } from "./useStatusMessage";
import { useTimedFlag } from "./useTimedFlag";
import { useUnsavedWarning } from "./useUnsavedWarning";

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

function WarningProbe({ unsaved }: { unsaved: boolean }) {
  useUnsavedWarning(unsaved);
  return null;
}

describe("useUnsavedWarning", () => {
  const fireBeforeUnload = () => {
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    return event;
  };

  it("does not interfere when there is nothing to lose", () => {
    render(<WarningProbe unsaved={false} />);
    expect(fireBeforeUnload().defaultPrevented).toBe(false);
  });

  it("asks the browser to confirm while there is unsaved work", () => {
    render(<WarningProbe unsaved />);
    expect(fireBeforeUnload().defaultPrevented).toBe(true);
  });

  it("stops asking once the work is saved", () => {
    const { rerender } = render(<WarningProbe unsaved />);
    rerender(<WarningProbe unsaved={false} />);
    expect(fireBeforeUnload().defaultPrevented).toBe(false);
  });

  it("removes its handler when the editor unmounts", () => {
    const { unmount } = render(<WarningProbe unsaved />);
    unmount();
    expect(fireBeforeUnload().defaultPrevented).toBe(false);
  });
});
