import { Plug } from "lucide-react";
import { useBridgeState } from "../../hooks/useBridgeState";
import { connectBridge, disconnectBridge, getBridgeToken } from "../../lib/bridge/client";
import { BRIDGE_PORT } from "../../shared/bridgeProtocol";

/**
 * On/off light for the MCP bridge, alongside Ready and the AI light.
 *
 * While this is on, a coding agent can read and write your card library, so it
 * shouldn't be something that quietly turns itself on — the light is both the
 * indicator and the switch.
 */
export default function BridgeStatusLight() {
  const bridge = useBridgeState();
  // Without a token the handshake can only fail, so say that here rather than
  // after a round trip that ends in "the server rejected your pairing token".
  const paired = !!getBridgeToken();

  function toggle() {
    if (bridge.status !== "off") disconnectBridge();
    else if (paired) connectBridge();
  }

  const { dot, label, title } = (() => {
    switch (bridge.status) {
      case "connected":
        return {
          dot: "bg-status-ok",
          label: "MCP",
          title: `Connected to the MCP server on port ${BRIDGE_PORT}. An agent can read and edit your library${
            bridge.served ? ` — ${bridge.served} request${bridge.served === 1 ? "" : "s"} so far` : ""
          }. Click to disconnect.`,
        };
      case "connecting":
        return {
          dot: "bg-status-warn animate-pulse",
          label: "MCP",
          title: `Connecting to the MCP server on port ${BRIDGE_PORT}…`,
        };
      case "error":
        return {
          dot: "bg-status-warn",
          label: "MCP",
          title: `${bridge.error ?? "Not connected."} Retrying. Click to stop trying.`,
        };
      default:
        return {
          dot: "bg-text-muted",
          label: "MCP",
          title: paired
            ? "MCP bridge is off. Click to let a coding agent create and edit cards in your library. Requires the CharacterBinder MCP server to be running."
            : "MCP bridge is off and has no pairing token. Start the CharacterBinder MCP server and paste the token it prints into Settings → MCP bridge.",
        };
    }
  })();

  return (
    <button
      type="button"
      onClick={toggle}
      title={title}
      aria-label={title}
      className="flex items-center gap-1.5 rounded px-1.5 py-0.5 hover:bg-bg-hover transition-colors cursor-pointer"
    >
      <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
      <Plug size={10} className="text-text-muted shrink-0" />
      <span className="text-xs text-text-muted whitespace-nowrap">{label}</span>
    </button>
  );
}
