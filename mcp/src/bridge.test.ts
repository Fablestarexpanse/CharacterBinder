import { describe, it, expect, afterEach } from "vitest";
import WebSocket from "ws";
import {
  BRIDGE_PROTOCOL_VERSION,
  CLOSE_BAD_TOKEN,
  CLOSE_PROTOCOL,
  CLOSE_ALREADY_CONNECTED,
  PROOF_CLIENT,
  PROOF_SERVER,
  proveToken,
  randomNonce,
} from "../../src/shared/bridgeProtocol.js";
import { startBridge, isAppConnected, bridgeStatus } from "./bridge.js";

/**
 * Drives the real server over a real socket. The handshake is what stands
 * between any local process and the user's card library, so it is worth
 * testing as it actually runs rather than as a set of pure functions.
 */

const TOKEN = "d3adb33f".repeat(8);
let server: { close: () => void } | null = null;
const sockets: WebSocket[] = [];

/**
 * The OS picks the port: a fixed one made these tests fight each other and any
 * bridge already running on the machine.
 */
async function start(): Promise<{ close: () => void }> {
  const handle = startBridge({ port: 0, token: TOKEN });
  // The port is assigned on the 'listening' event, which is a tick away.
  for (let i = 0; i < 200 && bridgeStatus().port === 0; i++) {
    await new Promise((r) => setTimeout(r, 5));
  }
  return handle;
}

afterEach(() => {
  for (const s of sockets.splice(0)) s.terminate();
  server?.close();
  server = null;
});

function connect(): Promise<WebSocket> {
  const ws = new WebSocket(`ws://127.0.0.1:${bridgeStatus().port}`);
  sockets.push(ws);
  return new Promise((resolve, reject) => {
    ws.once("open", () => resolve(ws));
    ws.once("error", reject);
  });
}

function nextMessage(ws: WebSocket): Promise<Record<string, unknown>> {
  return new Promise((resolve) => ws.once("message", (raw) => resolve(JSON.parse(String(raw)))));
}

function nextClose(ws: WebSocket): Promise<number> {
  return new Promise((resolve) => ws.once("close", (code) => resolve(code)));
}

async function hello(ws: WebSocket, protocol = BRIDGE_PROTOCOL_VERSION) {
  const clientNonce = randomNonce();
  ws.send(JSON.stringify({ type: "hello", protocol, app: "test", version: "0", clientNonce }));
  return clientNonce;
}

describe("bridge handshake", () => {
  it("completes when both sides prove the same token", async () => {
    server = await start();
    const ws = await connect();

    const clientNonce = await hello(ws);
    const challenge = await nextMessage(ws);
    expect(challenge.type).toBe("challenge");
    // The server proves itself first, so a squatter cannot harvest the token.
    expect(challenge.proof).toBe(await proveToken(TOKEN, PROOF_SERVER + clientNonce));

    ws.send(JSON.stringify({ type: "auth", proof: await proveToken(TOKEN, PROOF_CLIENT + String(challenge.serverNonce)) }));
    expect((await nextMessage(ws)).type).toBe("ready");
    expect(isAppConnected()).toBe(true);
  });

  it("rejects a peer that does not hold the token", async () => {
    server = await start();
    const ws = await connect();
    await hello(ws);
    await nextMessage(ws);

    ws.send(JSON.stringify({ type: "auth", proof: "0".repeat(64) }));
    expect(await nextClose(ws)).toBe(CLOSE_BAD_TOKEN);
    expect(isAppConnected()).toBe(false);
  });

  it("rejects a proof reflected from the other direction", async () => {
    // Without domain separation the server's own challenge proof would answer
    // its own auth check, and holding the token would not be required at all.
    server = await start();
    const ws = await connect();
    await hello(ws);
    const challenge = await nextMessage(ws);

    ws.send(JSON.stringify({ type: "auth", proof: challenge.proof }));
    expect(await nextClose(ws)).toBe(CLOSE_BAD_TOKEN);
  });

  it("rejects a proof carrying the wrong domain label", async () => {
    server = await start();
    const ws = await connect();
    await hello(ws);
    const challenge = await nextMessage(ws);

    ws.send(JSON.stringify({ type: "auth", proof: await proveToken(TOKEN, PROOF_SERVER + String(challenge.serverNonce)) }));
    expect(await nextClose(ws)).toBe(CLOSE_BAD_TOKEN);
  });

  it("refuses a mismatched protocol version before any proof is exchanged", async () => {
    server = await start();
    const ws = await connect();
    await hello(ws, BRIDGE_PROTOCOL_VERSION + 1);
    expect(await nextClose(ws)).toBe(CLOSE_PROTOCOL);
  });

  it("refuses anything sent before the handshake", async () => {
    server = await start();
    const ws = await connect();
    ws.send(JSON.stringify({ id: "1", result: { anything: true } }));
    expect(await nextClose(ws)).toBe(CLOSE_PROTOCOL);
  });

  it("refuses a hello with no usable client nonce", async () => {
    server = await start();
    const ws = await connect();
    ws.send(JSON.stringify({ type: "hello", protocol: BRIDGE_PROTOCOL_VERSION, clientNonce: "short" }));
    expect(await nextClose(ws)).toBe(CLOSE_PROTOCOL);
  });

  it("keeps the incumbent when a second peer connects", async () => {
    server = await start();
    const first = await connect();
    const clientNonce = await hello(first);
    const challenge = await nextMessage(first);
    first.send(JSON.stringify({ type: "auth", proof: await proveToken(TOKEN, PROOF_CLIENT + String(challenge.serverNonce)) }));
    await nextMessage(first);
    expect(clientNonce.length).toBeGreaterThan(15);

    const second = await connect();
    expect(await nextClose(second)).toBe(CLOSE_ALREADY_CONNECTED);
    // The live session is untouched.
    expect(isAppConnected()).toBe(true);
  });

  it("refuses a second client that finishes its handshake while the first holds the socket", async () => {
    server = await start();

    // Both connect before either authenticates, so both pass the connect-time
    // incumbent check. Only the one that gets there first may be promoted.
    const first = await connect();
    const second = await connect();

    const firstNonce = await hello(first);
    const firstChallenge = await nextMessage(first);
    expect(firstNonce.length).toBeGreaterThan(15);
    first.send(JSON.stringify({ type: "auth", proof: await proveToken(TOKEN, PROOF_CLIENT + String(firstChallenge.serverNonce)) }));
    expect((await nextMessage(first)).type).toBe("ready");

    await hello(second);
    const secondChallenge = await nextMessage(second);
    second.send(JSON.stringify({ type: "auth", proof: await proveToken(TOKEN, PROOF_CLIENT + String(secondChallenge.serverNonce)) }));

    expect(await nextClose(second)).toBe(CLOSE_ALREADY_CONNECTED);
    // The first client is still the app, still connected, still answering.
    expect(isAppConnected()).toBe(true);
    expect(first.readyState).toBe(WebSocket.OPEN);
  });
});

describe("callApp", () => {
  it("says the app is not connected, and how to connect it, rather than hanging", async () => {
    server = await start();
    const { callApp } = await import("./bridge.js");
    // Nothing has dialled in. The agent hears that at once, with the steps the
    // user has to take — a bare "failed" leaves both of them stuck.
    await expect(callApp("cards.list", {})).rejects.toThrow(/isn't connected/i);
    await expect(callApp("cards.list", {})).rejects.toThrow(/pairing token/i);
  });

  it("gives a call the user has to approve minutes rather than seconds", async () => {
    const { USER_GATED_METHODS } = await import("../../src/shared/bridgeProtocol.js");
    // The wait is chosen from this set: a person reading a confirmation dialog
    // routinely takes longer than the ordinary 20s, and timing out early told
    // the agent the write had failed while the prompt was still on screen.
    expect([...USER_GATED_METHODS]).toEqual(expect.arrayContaining(["cards.update", "cards.delete"]));
  });
});

describe("startBridge", () => {
  it("fails in-flight calls when it is shut down, rather than leaving them to time out", async () => {
    const { callApp } = await import("./bridge.js");
    const handle = await start();
    server = handle;

    const ws = await connect();
    const clientNonce = await hello(ws);
    const challenge = await nextMessage(ws);
    expect(clientNonce.length).toBeGreaterThan(15);
    ws.send(JSON.stringify({ type: "auth", proof: await proveToken(TOKEN, PROOF_CLIENT + String(challenge.serverNonce)) }));
    await nextMessage(ws);

    // The client never answers. Terminating a socket fires no close handler, so
    // without close() clearing them this call would sit out its full timeout.
    const call = callApp("cards.list", {});
    await nextMessage(ws);
    handle.close();
    server = null;

    await expect(call).rejects.toThrow(/shut down/i);
  });


  it("reports the port it actually bound, not the one it was asked for", async () => {
    server = await start();
    // Asked for 0; the OS assigned a real one, and status has to say which.
    expect(bridgeStatus().port).toBeGreaterThan(0);
  });

  it("says so when the port is already taken, rather than looking started", async () => {
    server = await start();
    const second = startBridge({ port: bridgeStatus().port, token: TOKEN });
    // ws reports EADDRINUSE asynchronously, so the failure shows up in status.
    await new Promise((r) => setTimeout(r, 50));
    expect(bridgeStatus().error).toMatch(/already in use/i);
    second.close();
  });
});
