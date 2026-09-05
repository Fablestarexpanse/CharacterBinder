import { useSyncExternalStore } from "react";
import { getBridgeState, subscribeBridgeState, type BridgeState } from "../lib/bridgeState";

/** Live view of the MCP bridge connection. */
export function useBridgeState(): BridgeState {
  return useSyncExternalStore(subscribeBridgeState, getBridgeState, getBridgeState);
}
