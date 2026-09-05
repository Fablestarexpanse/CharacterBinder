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

/** Close codes, so each side can explain itself rather than dropping silently. */
export const CLOSE_BAD_TOKEN = 4001;
export const CLOSE_ALREADY_CONNECTED = 4002;
export const CLOSE_BAD_ORIGIN = 4003;
export const CLOSE_PROTOCOL = 4004;

/** HMAC-SHA256 of `message` under `token`, lowercase hex. Same on both sides. */
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

import type { LibraryCardType } from "../../types";

/** The wire uses the app's own card vocabulary — no parallel union to cast across. */
export type CardType = LibraryCardType;

/** Methods the app implements and the server calls. */
export type BridgeMethod =
  | "ping"
  | "cards.list"
  | "cards.get"
  | "cards.create"
  | "cards.update"
  | "cards.delete"
  | "app.open";

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
  type?: CardType;
}

/** Summary shape — deliberately excludes image bytes, which are large. */
export interface CardSummary {
  id: string;
  name: string;
  cardType: CardType;
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
  cardType: CardType;
  tags: string[];
  /** Tavern V2 object for characters; the card's own shape for everything else. */
  data: unknown;
  hasImage: boolean;
  updatedAt: number;
}

export interface CreateParams {
  cardType: CardType;
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

export interface MutationResult {
  id: string;
  name: string;
  cardType: CardType;
}
