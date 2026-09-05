/**
 * Wire protocol between the MCP server and the running app.
 *
 * The app owns the card library (IndexedDB in the browser), so the MCP server
 * cannot touch storage directly. Instead the server exposes a WebSocket that
 * the app dials, and any storage-backed tool call becomes an RPC the app
 * fulfils. Pure functions — validation, platform compatibility, text parsing —
 * run in the server and never reach here.
 *
 * This file is imported by both sides. Keep it dependency-free.
 */

export const BRIDGE_PORT = 8787;
export const BRIDGE_URL = `ws://127.0.0.1:${BRIDGE_PORT}`;



/** Bumped when the shape below changes incompatibly. v2 added the handshake. */
export const BRIDGE_PROTOCOL_VERSION = 2;

/**
 * Mutual challenge-response over a shared token.
 *
 * Loopback is not an authentication boundary — any local process can bind the
 * port first and impersonate the server, so the app must not hand its token to
 * an unverified peer, and the server must not serve the library to an
 * unverified client. Neither side ever transmits the token: each proves
 * knowledge of it by HMAC-ing the other's nonce.
 *
 *   app    → hello      { clientNonce }
 *   server → challenge  { serverNonce, proof = HMAC(token, "server:" + clientNonce) }
 *   app    → auth       { proof = HMAC(token, "client:" + serverNonce) }
 *   server → ready      {}                                        // RPCs begin
 *
 * The two proofs carry different domain labels on purpose. Without them both
 * sides compute HMAC(token, nonce) over the same construction, so a value
 * obtained from one direction is a valid proof in the other and a peer can be
 * induced to generate the answer it will later be asked to verify.
 */

/** Domain labels — never reuse one for the other direction. */
export const PROOF_SERVER = "characterbinder-bridge/server:";
export const PROOF_CLIENT = "characterbinder-bridge/client:";

export interface HelloFrame {
  type: "hello";
  protocol: number;
  app: string;
  version: string;
  clientNonce: string;
}

export interface ChallengeFrame {
  type: "challenge";
  serverNonce: string;
  proof: string;
}

export interface AuthFrame {
  type: "auth";
  proof: string;
}

export interface ReadyFrame {
  type: "ready";
}

export interface AuthFailedFrame {
  type: "auth_failed";
  reason: string;
}

export type HandshakeFrame = HelloFrame | ChallengeFrame | AuthFrame | ReadyFrame | AuthFailedFrame;

/**
 * A frame from the other side of the handshake, before anything is trusted.
 *
 * Only the discriminant is checked here — narrowing on `frame.type` is what
 * gives each branch its own fields, and both sides then read them without
 * restating the shape or defaulting a value the union says is a string.
 */
export function isHandshakeFrame(msg: unknown): msg is HandshakeFrame {
  if (!msg || typeof msg !== "object") return false;
  const type = (msg as { type?: unknown }).type;
  return (
    type === "hello" ||
    type === "challenge" ||
    type === "auth" ||
    type === "ready" ||
    type === "auth_failed"
  );
}

/** Close codes, so each side can explain itself rather than dropping silently. */
export const CLOSE_BAD_TOKEN = 4001;
export const CLOSE_ALREADY_CONNECTED = 4002;
export const CLOSE_BAD_ORIGIN = 4003;
export const CLOSE_PROTOCOL = 4004;

/**
 * HMAC-SHA256 of `message` under `token`, lowercase hex — the app's half.
 *
 * The server computes the same value with node:crypto, in mcp/src/bridge.ts:
 * `hmac()` here, `proofsMatch()` for safeEqual, `randomNonce()` for the nonce.
 * It keeps its own copies deliberately: timingSafeEqual is a real constant-time
 * comparison, and the synchronous API keeps the handshake path free of awaits.
 * The two sets have to change together, and bridgeProtocol.test.ts pins this
 * function against a value produced by the server side.
 */
export async function proveToken(token: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(token),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Comparison that doesn't leak position via early exit. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function randomNonce(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

import type { LibraryCardType } from "../types";

// The wire uses the app's own card vocabulary; there is no separate wire type.



/** Methods the app implements and the server calls. */
export type BridgeMethod =
  | "ping"
  | "cards.list"
  | "cards.get"
  | "cards.create"
  | "cards.update"
  | "cards.delete"
  | "app.open";

/** Where the app is served from; the server refuses browser origins outside it. */
export const APP_PORT = 3737;
export const ALLOWED_APP_ORIGINS: readonly string[] = [
  `http://localhost:${APP_PORT}`,
  `http://127.0.0.1:${APP_PORT}`,
  `http://[::1]:${APP_PORT}`,
];

/**
 * Methods the app answers only after asking the user. Declared with the
 * protocol because both sides need to agree: the app raises a confirmation, and
 * the server has to allow time for a person to read it.
 */
export const USER_GATED_METHODS: readonly BridgeMethod[] = ["cards.update", "cards.delete"];

export interface BridgeRequest {
  id: string;
  method: BridgeMethod;
  params?: unknown;
}

export interface BridgeResponse {
  id: string;
  result?: unknown;
  error?: string;
}

export function isBridgeRequest(msg: unknown): msg is BridgeRequest {
  return (
    !!msg &&
    typeof msg === "object" &&
    typeof (msg as BridgeRequest).id === "string" &&
    typeof (msg as BridgeRequest).method === "string"
  );
}

// ── Params / results ────────────────────────────────────────────────────────

export interface ListParams {
  type?: LibraryCardType;
}

/** Summary shape — deliberately excludes image bytes, which are large. */
export interface CardSummary {
  id: string;
  name: string;
  cardType: LibraryCardType;
  tags: string[];
  hasImage: boolean;
  updatedAt: number;
  version?: string;
}

export interface GetParams {
  id: string;
}

export interface GetResult {
  id: string;
  name: string;
  cardType: LibraryCardType;
  tags: string[];
  /** Tavern V2 object for characters; the card's own shape for everything else. */
  data: unknown;
  hasImage: boolean;
  updatedAt: number;
}

export interface CreateParams {
  cardType: LibraryCardType;
  /** Tavern V2 `data` fields for characters, or the card body for other types. */
  data: Record<string, unknown>;
  /** Optional cover art as a data: URL. */
  imageSrc?: string | null;
  /** Bring the card up in the editor once it's saved. */
  open?: boolean;
}

export interface UpdateParams {
  id: string;
  /** Shallow merge over the existing card body. */
  patch: Record<string, unknown>;
  open?: boolean;
}

export interface DeleteParams {
  id: string;
}

export interface OpenParams {
  id: string;
}

/**
 * What each method takes and returns — the one place the pairing is stated, so
 * a call cannot name a result type its method does not produce.
 */
export interface BridgeCalls {
  ping: { params?: undefined; result: { ok: boolean; app: string; version: string } };
  "cards.list": { params: ListParams; result: { cards: CardSummary[] } };
  "cards.get": { params: GetParams; result: GetResult };
  "cards.create": { params: CreateParams; result: MutationResult };
  "cards.update": { params: UpdateParams; result: MutationResult };
  "cards.delete": { params: DeleteParams; result: { id: string } };
  "app.open": { params: OpenParams; result: { id: string; opened: boolean } };
}

export interface MutationResult {
  id: string;
  name: string;
  cardType: LibraryCardType;
  /** Whether the card was actually brought up in the editor, when asked. */
  opened?: boolean;
}
