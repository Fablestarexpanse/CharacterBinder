import { WebSocketServer, type WebSocket } from "ws";
import { randomUUID } from "node:crypto";
import { BRIDGE_PORT, type BridgeMethod, type BridgeResponse } from "../../src/lib/bridge/protocol.js";

/**
 * The server half of the bridge.
 *
 * The card library lives in the browser's IndexedDB, so anything that touches
 * storage has to be asked of the running app rather than done here. This holds
 * the socket the app dials in on and turns method calls into request/response
 * round trips over it.
 *
 * Only one app is connected at a time — a second connection replaces the first,
 * which is what you want when someone reloads the page.
 */

let appSocket: WebSocket | null = null;
let listenError: string | null = null;

interface Pending {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
}
const pending = new Map<string, Pending>();

const CALL_TIMEOUT_MS = 20_000;

export function startBridge(): void {
  let wss: WebSocketServer;
  try {
    // Loopback only. This exposes the user's card library, so it must never be
    // reachable from off the machine.
    wss = new WebSocketServer({ host: "127.0.0.1", port: BRIDGE_PORT });
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

  wss.on("connection", (ws) => {
    if (appSocket && appSocket !== ws) {
      try {
        appSocket.close();
      } catch {
        /* replacing a stale connection */
      }
    }
    appSocket = ws;
    console.error("[characterbinder-mcp] CharacterBinder connected");

    ws.on("message", (raw) => {
      let msg: BridgeResponse & { type?: string };
      try {
        msg = JSON.parse(String(raw));
      } catch {
        return;
      }
      if (msg.type === "hello") return; // handshake, nothing to resolve

      const entry = msg.id ? pending.get(msg.id) : undefined;
      if (!entry) return;
      pending.delete(msg.id);
      clearTimeout(entry.timer);
      if (msg.error) entry.reject(new Error(msg.error));
      else entry.resolve(msg.result);
    });

    ws.on("close", () => {
      if (appSocket === ws) appSocket = null;
      console.error("[characterbinder-mcp] CharacterBinder disconnected");
    });
  });

  console.error(`[characterbinder-mcp] bridge listening on 127.0.0.1:${BRIDGE_PORT}`);
}

export function isAppConnected(): boolean {
  return !!appSocket && appSocket.readyState === 1;
}

export function bridgeStatus(): { connected: boolean; port: number; error: string | null } {
  return { connected: isAppConnected(), port: BRIDGE_PORT, error: listenError };
}

const NOT_CONNECTED =
  "CharacterBinder isn't connected. Open the app (npm start, then http://localhost:3737) and click the MCP light in the sidebar footer to switch the bridge on.";

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
