// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PROOF_SERVER, BRIDGE_PROTOCOL_VERSION, proveToken } from "../../shared/bridgeProtocol";

/**
 * The app's side of the handshake, against a stand-in for whatever is on the
 * port. Loopback is not an authentication boundary: any local process can bind
 * 8787 first, so what the app refuses to talk to is the security property.
 */

const TOKEN = "d3adb33f".repeat(8);
const store = new Map<string, string>([["cb_bridge", JSON.stringify({ token: TOKEN, enabled: true })]]);
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
});

/** A socket the test drives: it records what the app sends and injects frames. */
class FakeSocket {
  static last: FakeSocket | null = null;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: ((e: { code: number }) => void) | null = null;
  onerror: (() => void) | null = null;
  readyState = 1;
  sent: Record<string, unknown>[] = [];
  closedWith: number | null = null;

  constructor(public url: string) {
    FakeSocket.last = this;
  }
  send(data: string) {
    this.sent.push(JSON.parse(data));
  }
  close(code?: number) {
    this.closedWith = code ?? 1000;
    this.readyState = 3;
  }
  /**
   * Deliver a frame from the "server" and wait for the app to react.
   *
   * The app's handler awaits WebCrypto, so a single tick is not enough — this
   * waits until it either sends something or settles.
   */
  async deliver(frame: unknown) {
    const before = this.sent.length;
    this.onmessage?.({ data: JSON.stringify(frame) });
    for (let i = 0; i < 50; i++) {
      await new Promise((r) => setTimeout(r, 2));
      if (this.sent.length > before || this.closedWith !== null) return;
    }
  }
}

let client: typeof import("./client");

beforeEach(async () => {
  vi.resetModules();
  vi.stubGlobal("WebSocket", FakeSocket);
  client = await import("./client");
  client.initBridge({ openCard: () => {} });
  client.connectBridge();
  FakeSocket.last!.onopen?.();
});

describe("app-side handshake", () => {
  it("opens with a hello carrying a nonce and the protocol version", () => {
    const hello = FakeSocket.last!.sent[0];
    expect(hello.type).toBe("hello");
    expect(hello.protocol).toBe(BRIDGE_PROTOCOL_VERSION);
    expect(String(hello.clientNonce).length).toBeGreaterThanOrEqual(16);
  });

  it("answers a correct challenge and connects when the server says ready", async () => {
    const socket = FakeSocket.last!;
    const clientNonce = String(socket.sent[0].clientNonce);

    await socket.deliver({
      type: "challenge",
      serverNonce: "abcdef0123456789",
      proof: await proveToken(TOKEN, PROOF_SERVER + clientNonce),
    });
    expect(socket.sent[1].type).toBe("auth");

    await socket.deliver({ type: "ready" });
    expect(client.getBridgeState().status).toBe("connected");
  });

  it("refuses a server that skips the challenge and just claims ready", async () => {
    const socket = FakeSocket.last!;

    await socket.deliver({ type: "ready" });

    // A process that grabbed the port must not be served the card library for
    // saying the magic word.
    expect(client.getBridgeState().status).toBe("error");
    expect(client.getBridgeState().error).toMatch(/skipped the pairing check/i);
    expect(socket.closedWith).toBe(4004);
  });

  it("refuses a server whose proof does not match the stored token", async () => {
    const socket = FakeSocket.last!;

    await socket.deliver({ type: "challenge", serverNonce: "abcdef0123456789", proof: "0".repeat(64) });

    expect(socket.sent.some((f) => f.type === "auth")).toBe(false);
    expect(client.getBridgeState().error).toMatch(/failed to prove/i);
  });

  it("never sends anything when no token is stored", async () => {
    store.set("cb_bridge", JSON.stringify({ token: "", enabled: true }));
    vi.resetModules();
    const fresh = await import("./client");
    fresh.initBridge({ openCard: () => {} });
    fresh.connectBridge();
    const socket = FakeSocket.last!;
    socket.onopen?.();

    await socket.deliver({ type: "challenge", serverNonce: "abcdef0123456789", proof: "0".repeat(64) });

    expect(socket.sent.some((f) => f.type === "auth")).toBe(false);
    // Without the token check ahead of proveToken, WebCrypto's rejection on an
    // empty key left this stuck on "connecting" and said nothing.
    expect(String(fresh.getBridgeState().error)).toMatch(/no pairing token/i);
  });
});
