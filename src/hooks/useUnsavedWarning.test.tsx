import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { useUnsavedWarning } from "./useUnsavedWarning";

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
