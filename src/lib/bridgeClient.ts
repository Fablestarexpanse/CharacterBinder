/**
 * App side of the MCP bridge.
 *
 * The MCP server can't reach IndexedDB, so it dials nothing — it *listens*, and
 * this client connects out to it. Once connected, the server issues RPCs and
 * this module fulfils them against the real card library, so an agent's card
 * lands in the user's actual collection rather than a parallel store.
 *
 * Off by default. Nothing connects until the user turns the bridge on, because
 * an always-open socket to a local port isn't something to enable behind
 * someone's back.
 */

import {
  BRIDGE_URL,
  BRIDGE_PROTOCOL_VERSION,
  CLOSE_ALREADY_CONNECTED,
  CLOSE_BAD_TOKEN,
  CLOSE_PROTOCOL,
  isBridgeRequest,
  isHandshakeFrame,
  proveToken,
  randomNonce,
  safeEqual,
  PROOF_SERVER,
  PROOF_CLIENT,
  type BridgeResponse,
} from "../shared/bridgeProtocol";
import { errorMessage } from "../shared/errorMessage";
import { cancelPendingApprovals, handleBridgeRequest } from "./bridgeHandlers";
import {
  getBridgeToken,
  isBridgeEnabled,
  setBridgeEnabled,
  setHost,
  setState,
  getBridgeState,
  type BridgeHost,
} from "./bridgeState";

/** Same read/patch contract as the app's other persisted settings. */

// ── Connection ──────────────────────────────────────────────────────────────

let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let manualDisconnect = false;

export function connectBridge() {
  setBridgeEnabled(true);
  manualDisconnect = false;
  openSocket();
}

export function disconnectBridge() {
  setBridgeEnabled(false);
  manualDisconnect = true;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = null;
  socket?.close();
  socket = null;
  setState({ status: "off", error: null });
}

/**
 * Register the host and reconnect if the user left the bridge on.
 *
 * The host is taken here rather than registered separately, so the bridge
 * cannot be started without one — an agent connected to a hostless bridge
 * opens cards nowhere and cannot have its deletes confirmed.
 */
export function initBridge(h: BridgeHost) {
  setHost(h);
  // The same latch the reconnect path respects: a deliberate refusal — a bad
  // token, another tab holding the connection — must not be undone by a
  // re-entry (React's StrictMode double-invoke, or a remount), which would
  // reopen a socket that is about to be closed again and strand the light on
  // "connecting".
  if (isBridgeEnabled() && !manualDisconnect) openSocket();
}

function scheduleReconnect() {
  if (manualDisconnect || reconnectTimer) return;
  // Fixed, unhurried retry: the MCP server appears when an agent starts it, and
  // a tight loop against a closed port is just noise.
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    openSocket();
  }, 4000);
}

/**
 * Take one pre-authentication frame.
 *
 * Kept apart from the socket wiring: this is the whole security decision — what
 * the app will and will not talk to — and it reads better as a state machine of
 * its own than as a branch inside the message handler.
 *
 * @returns true when the handshake has completed and RPCs may begin.
 */
async function advanceHandshake(
  ws: WebSocket,
  msg: unknown,
  ctx: { clientNonce: string; serverProved: () => boolean; prove: () => void }
): Promise<boolean> {
  const refuse = (error: string, code?: number, reason?: string) => {
    manualDisconnect = true;
    setState({ status: "error", error });
    if (code) ws.close(code, reason);
    else ws.close();
  };

  if (!isHandshakeFrame(msg)) return false;
  const frame = msg;

  if (frame.type === "challenge") {
    const token = getBridgeToken();
    // Checked before proving anything: WebCrypto rejects an empty key, and that
    // rejection inside an async handler left the light stuck on "connecting"
    // with no explanation at all.
    if (!token) {
      refuse("No pairing token set. Copy it from the MCP server output into Settings → MCP bridge.");
      return false;
    }

    const expected = await proveToken(token, PROOF_SERVER + ctx.clientNonce);
    if (!safeEqual(frame.proof, expected)) {
      // Whatever is on that port does not hold the token. Say nothing more.
      refuse("The server on that port failed to prove it holds your pairing token. Not sending anything to it.");
      return false;
    }

    ctx.prove();
    ws.send(JSON.stringify({ type: "auth", proof: await proveToken(token, PROOF_CLIENT + frame.serverNonce) }));
    return false;
  }

  if (frame.type === "ready") {
    // Only after the server has proved it holds the token. Without this check a
    // process that grabbed the port could skip the challenge entirely, send
    // "ready", and be served the whole card library.
    if (!ctx.serverProved()) {
      refuse(
        "The server on that port skipped the pairing check. Not sending anything to it.",
        CLOSE_PROTOCOL,
        "Ready before challenge"
      );
      return false;
    }
    return true;
  }

  if (frame.type === "auth_failed") {
    manualDisconnect = true;
    setState({ status: "error", error: `Pairing rejected: ${frame.reason}. Check the token in Settings.` });
  }
  return false;
}

function openSocket() {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;

  setState({ status: "connecting", error: null });

  let ws: WebSocket;
  try {
    ws = new WebSocket(BRIDGE_URL);
  } catch {
    setState({ status: "error", error: "Couldn't open a socket to the bridge." });
    scheduleReconnect();
    return;
  }
  socket = ws;

  // Nonce for this attempt. The server must HMAC it with the shared token
  // before we send any proof of our own — otherwise a process that squatted the
  // port would simply be handed the secret.
  const clientNonce = randomNonce();
  let authed = false;
  // Set only once the server's challenge proof has been checked against the
  // stored token. "ready" means nothing before that.
  let serverProved = false;

  ws.onopen = () => {
    ws.send(
      JSON.stringify({
        type: "hello",
        protocol: BRIDGE_PROTOCOL_VERSION,
        app: "CharacterBinder",
        version: __APP_VERSION__,
        clientNonce,
      })
    );
  };

  ws.onmessage = async (event) => {
    let msg: unknown;
    try {
      msg = JSON.parse(String(event.data));
    } catch {
      return;
    }

    // Everything below runs inside one guard. This is an async event handler:
    // anything that throws past it becomes an unhandled rejection, and the
    // light sits on "connecting" or "connected" with no sign that the bridge
    // has stopped working.
    try {
      if (!authed) {
        if (await advanceHandshake(ws, msg, { clientNonce, serverProved: () => serverProved, prove: () => { serverProved = true; } })) {
          authed = true;
          setState({ status: "connected", error: null });
        }
        return;
      }

      if (!isBridgeRequest(msg)) return;

      const response: BridgeResponse = { id: msg.id };
      try {
        response.result = await handleBridgeRequest(msg);
        setState({ served: getBridgeState().served + 1, lastMethod: msg.method });
      } catch (err) {
        response.error = errorMessage(err);
      }
      // Sending can fail on a socket that closed while the call ran; the agent
      // is gone either way, but the user should see that this one did not land.
      try {
        ws.send(JSON.stringify(response));
      } catch (err) {
        setState({ status: "error", error: `Couldn't answer the agent: ${errorMessage(err)}` });
      }
    } catch (err) {
      setState({ status: "error", error: `The bridge hit an error: ${errorMessage(err)}` });
    }
  };

  ws.onerror = () => {
    // The close handler does the reporting; onerror carries no useful detail.
  };

  ws.onclose = (event) => {
    socket = null;
    cancelPendingApprovals();
    if (manualDisconnect) return;

    // These are deliberate refusals; retrying in a loop would be noise.
    if (event.code === CLOSE_BAD_TOKEN) {
      manualDisconnect = true;
      setState({ status: "error", error: "The server rejected your pairing token. Update it in Settings → MCP bridge." });
      return;
    }
    if (event.code === CLOSE_ALREADY_CONNECTED) {
      manualDisconnect = true;
      setState({ status: "error", error: "Another CharacterBinder tab is already connected to the MCP server." });
      return;
    }

    setState({
      status: "error",
      error: "Not connected. Start the CharacterBinder MCP server, or check nothing else holds the port.",
    });
    scheduleReconnect();
  };
}
