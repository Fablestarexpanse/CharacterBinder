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

/** Bumped when the shape below changes incompatibly. */
export const BRIDGE_PROTOCOL_VERSION = 1;

export type CardType = "character" | "lorebook" | "script" | "scenario" | "persona";

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

/** Sent by the app immediately after connecting. */
export interface BridgeHello {
  type: "hello";
  protocol: number;
  app: string;
  version: string;
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
