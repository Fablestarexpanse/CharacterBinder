import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BridgeStatusLight from "./BridgeStatusLight";
import type { BridgeState } from "../../lib/bridge/client";

const bridgeState = vi.fn((): BridgeState => ({ status: "off", error: null, served: 0, lastMethod: null, activity: [] }));
const connectBridge = vi.fn();
const disconnectBridge = vi.fn();
const getBridgeToken = vi.fn(() => "a-token");

vi.mock("../../hooks/useBridgeState", () => ({ useBridgeState: () => bridgeState() }));
vi.mock("../../lib/bridge/client", async () => {
  const actual = await vi.importActual<typeof import("../../lib/bridge/client")>("../../lib/bridge/client");
  return {
    ...actual,
    connectBridge: () => connectBridge(),
    disconnectBridge: () => disconnectBridge(),
    getBridgeToken: () => getBridgeToken(),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  bridgeState.mockReturnValue({ status: "off", error: null, served: 0, lastMethod: null, activity: [] });
  getBridgeToken.mockReturnValue("a-token");
});

describe("BridgeStatusLight", () => {
  it("says the bridge is off, and what turning it on would allow", () => {
    render(<BridgeStatusLight />);
    expect(screen.getByRole("button")).toHaveAccessibleName(/mcp bridge is off/i);
  });

  it("turns the bridge on when it is off, and off when it is on", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<BridgeStatusLight />);

    await user.click(screen.getByRole("button"));
    expect(connectBridge).toHaveBeenCalledTimes(1);
    expect(disconnectBridge).not.toHaveBeenCalled();

    bridgeState.mockReturnValue({ status: "connected", error: null, served: 3, lastMethod: "cards.list", activity: [] });
    rerender(<BridgeStatusLight />);

    await user.click(screen.getByRole("button"));
    expect(disconnectBridge).toHaveBeenCalledTimes(1);
  });

  it("says how many requests it has served once connected", () => {
    bridgeState.mockReturnValue({ status: "connected", error: null, served: 3, lastMethod: "cards.list", activity: [] });
    render(<BridgeStatusLight />);
    expect(screen.getByRole("button")).toHaveAccessibleName(/3 requests/i);
  });

  it("surfaces the error when the connection failed", () => {
    bridgeState.mockReturnValue({
      status: "error",
      error: "The server rejected your pairing token.",
      served: 0,
      lastMethod: null,
      activity: [],
    });
    render(<BridgeStatusLight />);
    expect(screen.getByRole("button")).toHaveAccessibleName(/rejected your pairing token/i);
  });

  it("will not connect without a token, and says to paste one in", async () => {
    getBridgeToken.mockReturnValue("");
    render(<BridgeStatusLight />);

    await userEvent.click(screen.getByRole("button"));
    expect(connectBridge).not.toHaveBeenCalled();
    expect(screen.getByRole("button")).toHaveAccessibleName(/settings/i);
  });
});
