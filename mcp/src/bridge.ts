import { WebSocketServer, type WebSocket } from "ws";
import { randomUUID, createHmac, timingSafeEqual } from "node:crypto";
import type { IncomingMessage } from "node:http";
import {
  BRIDGE_PORT,
  BRIDGE_PROTOCOL_VERSION,
  CLOSE_ALREADY_CONNECTED,
  CLOSE_BAD_ORIGIN,
  CLOSE_BAD_TOKEN,
  CLOSE_PROTOCOL,
  type BridgeMethod,
  type BridgeResponse,
} from "../../src/lib/bridge/protocol.js";
import { loadOrCreateToken, tokenPath } from "./token.js";

/**
 * The server half of the bridge.
 *
 * The card library lives in the browser's IndexedDB, so anything touching
 * storage has to be asked of the running app rather than done here. This holds
 * the socket the app dials in on and turns method calls into request/response
 * round trips over it.
 *
 * Everything below the handshake exists because loopback is a shared trust
 * boundary, not an authentication boundary: on a desktop, any unprivileged
 * process can bind this port or open a socket to it, and a web page can connect
 * too — `ws://` to loopback is exempt from mixed-content blocking and isn't
 * subject to CORS. So a connection is only promoted to "the app" after it
 * proves knowledge of the shared token, and only one at a time.
 */

let appSocket: WebSocket | null = null;
let listenError: string | null = null;
let token = "";

interface Pending {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
}
const pending = new Map<string, Pending>();

const CALL_TIMEOUT_MS = 20_000;
const HANDSHAKE_TIMEOUT_MS = 10_000;
/** Card bodies are text; a megabyte is generous and bounds a hostile peer. */
const MAX_PAYLOAD = 4 * 1024 * 1024;

/** Where the app is legitimately served from. */
const ALLOWED_ORIGINS = new Set([
  "http://localhost:3737",
  "http://127.0.0.1:3737",
  "http://[::1]:3737",
]);

const hmac = (message: string) => createHmac("sha256", token).update(message).digest("hex");

function proofsMatch(a: string, b: string): boolean {
  const ba = Buffer.from(String(a), "utf8");
  const bb = Buffer.from(String(b), "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

function randomNonce(): string {
  return randomUUID().replace(/-/g, "");
}

export function startBridge(): void {
  token = loadOrCreateToken();

  let wss: WebSocketServer;
  try {
    // Loopback only. This exposes the user's card library, so it must never be
    // reachable from off the machine.
    wss = new WebSocketServer({
      host: "127.0.0.1",
      port: BRIDGE_PORT,
      maxPayload: MAX_PAYLOAD,
      verifyClient: ({ origin }: { origin?: string }) => {
        // A browser always sends Origin; the app itself is the only browser
        // client we want. Non-browser clients send none, which we allow so the
        // handshake can still gate them.
        if (origin && !ALLOWED_ORIGINS.has(origin)) {
          console.error(`[characterbinder-mcp] rejected connection from origin ${origin}`);
          return false;
        }
        return true;
      },
    });
  } catch (err) {
    listenError = err instanceof Error ? err.message : String(err);
    return;
  }

  wss.on("error", (err) => {
    listenError =
      (err as NodeJS.ErrnoException).code === "EADDRINUSE"
        ? `Port ${BRIDGE_PORT} is already in use — another CharacterBinder MCP server is probably running.`
        : err.message;
    // Logs go to stderr; stdout belongs to the MCP transport.
    console.error(`[characterbinder-mcp] ${listenError}`);
  });

  wss.on("connection", (ws, req: IncomingMessage) => {
    // One app at a time, and the incumbent wins. Letting a newcomer displace a
    // live session would let anything that can reach the port evict the app and
    // answer in its place.
    if (appSocket && appSocket.readyState === 1) {
      ws.close(CLOSE_ALREADY_CONNECTED, "Another CharacterBinder is already connected");
      return;
    }

    const origin = req.headers.origin;
    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      ws.close(CLOSE_BAD_ORIGIN, "Origin not allowed");
      return;
    }

    let authed = false;
    let serverNonce = "";

    const handshakeTimer = setTimeout(() => {
      if (!authed) ws.close(CLOSE_PROTOCOL, "Handshake timed out");
    }, HANDSHAKE_TIMEOUT_MS);

    ws.on("error", (err) => {
      // Without this an emitter 'error' is thrown and takes the whole stdio
      // server down; a bare TCP reset is enough to trigger it.
      console.error(`[characterbinder-mcp] socket error: ${err.message}`);
      try {
        ws.close();
      } catch {
        /* already gone */
      }
    });

    ws.on("message", (raw) => {
      let msg: (BridgeResponse & { type?: string }) & Record<string, unknown>;
      try {
        msg = JSON.parse(String(raw));
      } catch {
        return;
      }

      // ── Handshake ──────────────────────────────────────────────────────
      if (!authed) {
        if (msg.type === "hello") {
          if (msg.protocol !== BRIDGE_PROTOCOL_VERSION) {
            ws.close(CLOSE_PROTOCOL, `Expected protocol ${BRIDGE_PROTOCOL_VERSION}`);
            return;
          }
          const clientNonce = String(msg.clientNonce ?? "");
          if (clientNonce.length < 16) {
            ws.close(CLOSE_PROTOCOL, "Missing client nonce");
            return;
          }
          serverNonce = randomNonce();
          // Prove we hold the token before the app proves anything, so a
          // squatter can never harvest it.
          ws.send(JSON.stringify({ type: "challenge", serverNonce, proof: hmac(clientNonce) }));
          return;
        }

        if (msg.type === "auth") {
          if (!serverNonce || !proofsMatch(String(msg.proof ?? ""), hmac(serverNonce))) {
            console.error("[characterbinder-mcp] rejected a connection with a bad token");
            ws.send(JSON.stringify({ type: "auth_failed", reason: "Token did not match" }));
            ws.close(CLOSE_BAD_TOKEN, "Bad token");
            return;
          }
          authed = true;
          clearTimeout(handshakeTimer);
          appSocket = ws;
          ws.send(JSON.stringify({ type: "ready" }));
          console.error("[characterbinder-mcp] CharacterBinder connected and authenticated");
          return;
        }

        // Anything else before auth is not something we answer.
        ws.close(CLOSE_PROTOCOL, "Handshake required");
        return;
      }

      // ── Authenticated RPC responses ────────────────────────────────────
      // Only the promoted socket may resolve calls; a displaced or stale
      // connection must not be able to answer for the app.
      if (ws !== appSocket) return;

      const entry = msg.id ? pending.get(msg.id) : undefined;
      if (!entry) return;
      pending.delete(msg.id);
      clearTimeout(entry.timer);
      if (msg.error) entry.reject(new Error(String(msg.error)));
      else entry.resolve(msg.result);
    });

    ws.on("close", () => {
      clearTimeout(handshakeTimer);
      if (appSocket === ws) {
        appSocket = null;
        // Fail in-flight calls now rather than letting each sit out its full
        // timeout after the app has plainly gone away.
        for (const [id, entry] of pending) {
          clearTimeout(entry.timer);
          entry.reject(new Error("CharacterBinder disconnected before answering."));
          pending.delete(id);
        }
        console.error("[characterbinder-mcp] CharacterBinder disconnected");
      }
    });
  });

  console.error(`[characterbinder-mcp] bridge listening on 127.0.0.1:${BRIDGE_PORT}`);
  console.error(`[characterbinder-mcp] pairing token: ${token}`);
  console.error(`[characterbinder-mcp] (also at ${tokenPath()} — paste it into the app's Settings once)`);
}

export function isAppConnected(): boolean {
  return !!appSocket && appSocket.readyState === 1;
}

export function bridgeStatus(): { connected: boolean; port: number; error: string | null; tokenPath: string } {
  return { connected: isAppConnected(), port: BRIDGE_PORT, error: listenError, tokenPath: tokenPath() };
}

const NOT_CONNECTED =
  "CharacterBinder isn't connected. Open the app (npm start, then http://localhost:3737), paste the pairing token into Settings → MCP bridge, and click the MCP light in the sidebar footer.";

/** Ask the app to do something and wait for its answer. */
export function callApp<T = unknown>(method: BridgeMethod, params?: unknown): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (!isAppConnected()) {
      reject(new Error(NOT_CONNECTED));
      return;
    }

    const id = randomUUID();
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`The app didn't answer ${method} within ${CALL_TIMEOUT_MS / 1000}s.`));
    }, CALL_TIMEOUT_MS);

    pending.set(id, { resolve: resolve as (v: unknown) => void, reject, timer });
    appSocket!.send(JSON.stringify({ id, method, params }));
  });
}
