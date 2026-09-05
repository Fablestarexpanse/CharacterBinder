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
  isBridgeRequest,
  proveToken,
  randomNonce,
  safeEqual,
  PROOF_SERVER,
  PROOF_CLIENT,
  type BridgeRequest,
  type BridgeResponse,
  type CardType,
  type CardSummary,
  type CreateParams,
  type DeleteParams,
  type GetParams,
  type GetResult,
  type ListParams,
  type MutationResult,
  type OpenParams,
  type UpdateParams,
} from "./protocol";
import { getAllCards, getCard as readCard, saveLibraryCard, deleteCard } from "../library";
import { createBlankTavernCard } from "../tavernCard";
import { coerceCardBody } from "../blankCards";
import { CARD_TYPES, type LibraryCard, type TavernCardV2 } from "../../types";

const ENABLED_KEY = "cb_bridge_enabled";
const TOKEN_KEY = "cb_bridge_token";

export function getBridgeToken(): string {
  return localStorage.getItem(TOKEN_KEY) ?? "";
}

export function setBridgeToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token.trim());
}

export type BridgeStatus = "off" | "connecting" | "connected" | "error";

export interface BridgeState {
  status: BridgeStatus;
  error: string | null;
  /** Rolling count of RPCs served, so the UI can show that something happened. */
  served: number;
  lastMethod: string | null;
}

let state: BridgeState = { status: "off", error: null, served: 0, lastMethod: null };
const listeners = new Set<(s: BridgeState) => void>();

function setState(patch: Partial<BridgeState>) {
  state = { ...state, ...patch };
  for (const l of listeners) l(state);
}

export function getBridgeState(): BridgeState {
  return state;
}

export function subscribeBridgeState(fn: (s: BridgeState) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

// ── Host hooks ──────────────────────────────────────────────────────────────
// App.tsx registers these so the bridge can open a card in the right editor and
// refresh views after a mutation. Kept as callbacks rather than imports to avoid
// this module reaching up into component state.

export interface BridgeHost {
  openCard: (card: LibraryCard) => void;
  onLibraryChanged?: () => void;
}

let host: BridgeHost | null = null;

export function registerBridgeHost(h: BridgeHost) {
  host = h;
}

// ── Connection ──────────────────────────────────────────────────────────────

let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let manualDisconnect = false;

export function isBridgeEnabled(): boolean {
  return localStorage.getItem(ENABLED_KEY) === "1";
}

export function connectBridge() {
  localStorage.setItem(ENABLED_KEY, "1");
  manualDisconnect = false;
  open();
}

export function disconnectBridge() {
  localStorage.setItem(ENABLED_KEY, "0");
  manualDisconnect = true;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = null;
  socket?.close();
  socket = null;
  setState({ status: "off", error: null });
}

/** Reconnect on load if the user left it on. */
export function initBridge() {
  if (isBridgeEnabled()) open();
}

function scheduleReconnect() {
  if (manualDisconnect || reconnectTimer) return;
  // Fixed, unhurried retry: the MCP server appears when an agent starts it, and
  // a tight loop against a closed port is just noise.
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    open();
  }, 4000);
}

function open() {
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
    // ── Handshake ────────────────────────────────────────────────────────
    if (!authed) {
      const frame = msg as { type?: string; serverNonce?: string; proof?: string; reason?: string };

      if (frame.type === "challenge") {
        const token = getBridgeToken();
        const expected = await proveToken(token, PROOF_SERVER + clientNonce);
        if (!token || !safeEqual(String(frame.proof ?? ""), expected)) {
          // Whatever is on that port does not hold the token. Say nothing more.
          manualDisconnect = true;
          setState({
            status: "error",
            error: token
              ? "The server on that port failed to prove it holds your pairing token. Not sending anything to it."
              : "No pairing token set. Copy it from the MCP server output into Settings → MCP bridge.",
          });
          ws.close();
          return;
        }
        ws.send(JSON.stringify({ type: "auth", proof: await proveToken(token, PROOF_CLIENT + String(frame.serverNonce ?? "")) }));
        return;
      }

      if (frame.type === "ready") {
        authed = true;
        setState({ status: "connected", error: null });
        return;
      }

      if (frame.type === "auth_failed") {
        manualDisconnect = true;
        setState({ status: "error", error: `Pairing rejected: ${frame.reason ?? "bad token"}. Check the token in Settings.` });
        return;
      }
      return;
    }

    if (!isBridgeRequest(msg)) return;

    const response: BridgeResponse = { id: msg.id };
    try {
      response.result = await handle(msg);
      setState({ served: state.served + 1, lastMethod: msg.method });
    } catch (err) {
      response.error = err instanceof Error ? err.message : String(err);
    }
    ws.send(JSON.stringify(response));
  };

  ws.onerror = () => {
    // The close handler does the reporting; onerror carries no useful detail.
  };

  ws.onclose = (event) => {
    socket = null;
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

// ── RPC handlers ────────────────────────────────────────────────────────────

async function handle(req: BridgeRequest): Promise<unknown> {
  switch (req.method) {
    case "ping":
      return { ok: true, app: "CharacterBinder", version: __APP_VERSION__ };
    case "cards.list":
      return listCards(req.params as ListParams);
    case "cards.get":
      return getCard(req.params as GetParams);
    case "cards.create":
      return createCard(req.params as CreateParams);
    case "cards.update":
      return updateCard(req.params as UpdateParams);
    case "cards.delete":
      return removeCard(req.params as DeleteParams);
    case "app.open":
      return openCard(req.params as OpenParams);
    default:
      throw new Error(`Unknown bridge method: ${req.method}`);
  }
}

function summarise(c: LibraryCard): CardSummary {
  return {
    id: c.id,
    name: c.name,
    cardType: c.cardType,
    tags: c.tags ?? [],
    hasImage: !!c.imageSrc,
    updatedAt: c.updatedAt,
    version: stringField(bodyOf(c), "character_version") ?? stringField(bodyOf(c), "version"),
  };
}

/** The editable body of a card, whichever slot it lives in. */
function bodyOf(c: LibraryCard): Record<string, unknown> {
  return c.cardType === "character" ? { ...c.cardData.data } : { ...c.rawData };
}

/** A body field, when it holds a string. Card bodies come from disk and agents. */
function stringField(body: Record<string, unknown>, key: string): string | undefined {
  const v = body[key];
  return typeof v === "string" ? v : undefined;
}

async function listCards(params: ListParams = {}): Promise<{ cards: CardSummary[] }> {
  const all = await getAllCards();
  const filtered = params.type ? all.filter((c) => c.cardType === params.type) : all;
  return { cards: filtered.map(summarise) };
}

async function findCard(id: string): Promise<LibraryCard> {
  const card = await readCard(id);
  if (!card) throw new Error(`No card with id ${id}. Call list_cards to see what exists.`);
  return card;
}

async function getCard(params: GetParams): Promise<GetResult> {
  const c = await findCard(params.id);
  return {
    id: c.id,
    name: c.name,
    cardType: c.cardType,
    tags: c.tags ?? [],
    data: c.cardType === "character" ? c.cardData : c.rawData,
    hasImage: !!c.imageSrc,
    updatedAt: c.updatedAt,
  };
}

async function persist(
  cardType: CardType,
  body: Record<string, unknown>,
  imageSrc: string | null,
  existing?: LibraryCard
): Promise<LibraryCard> {
  const existingId = existing?.id;

  if (cardType === "character") {
    const blank = createBlankTavernCard();
    const card: TavernCardV2 = { ...blank, data: { ...blank.data, ...(body as object) } };
    // Carry the embedded card PNG and target platform across an edit. Passing
    // null/"sillytavern" unconditionally meant an agent editing one field threw
    // away the encoded PNG the archive exports, and silently retargeted the card.
    return saveLibraryCard({
      cardType: "character",
      body: card,
      pngData: existing?.pngData ?? null,
      imageSrc,
      platform: existing?.platform ?? "sillytavern",
      existingId,
    });
  }

  const name = String(body.name ?? "") || `Unnamed ${cardType}`;
  const tags = Array.isArray(body.tags) ? body.tags.filter((t): t is string => typeof t === "string") : [];
  const common = { name, imageSrc, tags, existingId };

  // Each kind is spelled out so the body a peer sent is checked against the
  // shape that kind stores, rather than cast into it.
  switch (cardType) {
    case "lorebook": return saveLibraryCard({ ...common, cardType, body: coerceCardBody(cardType, body) });
    case "script":   return saveLibraryCard({ ...common, cardType, body: coerceCardBody(cardType, body) });
    case "scenario": return saveLibraryCard({ ...common, cardType, body: coerceCardBody(cardType, body) });
    case "persona":  return saveLibraryCard({ ...common, cardType, body: coerceCardBody(cardType, body) });
  }
}

/**
 * Cover art arriving over the bridge must be inline data. A remote URL would be
 * rendered into an <img src> on every Library paint, turning the user's card
 * collection into a beacon for whoever supplied it.
 */
function safeImageSrc(src: unknown): string | null {
  if (typeof src !== "string" || !src) return null;
  if (!/^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(src)) {
    throw new Error("imageSrc must be an inline data:image/* URL, not a remote address.");
  }
  return src;
}



async function createCard(params: CreateParams): Promise<MutationResult> {
  if (!params?.cardType) throw new Error("cardType is required.");
  if (!CARD_TYPES.includes(params.cardType)) {
    throw new Error(`Unknown cardType "${params.cardType}". Expected one of: ${CARD_TYPES.join(", ")}.`);
  }
  const saved = await persist(params.cardType, params.data ?? {}, safeImageSrc(params.imageSrc));
  host?.onLibraryChanged?.();
  if (params.open) host?.openCard(saved);
  return { id: saved.id, name: saved.name, cardType: saved.cardType as CardType };
}

async function updateCard(params: UpdateParams): Promise<MutationResult> {
  const existing = await findCard(params.id);
  const merged = { ...(bodyOf(existing) ?? {}), ...(params.patch ?? {}) };
  const saved = await persist(
    existing.cardType as CardType,
    merged as Record<string, unknown>,
    existing.imageSrc,
    existing
  );
  host?.onLibraryChanged?.();
  if (params.open) host?.openCard(saved);
  return { id: saved.id, name: saved.name, cardType: saved.cardType as CardType };
}

async function removeCard(params: DeleteParams): Promise<{ id: string }> {
  await findCard(params.id); // 404 with a useful message rather than silently succeeding
  await deleteCard(params.id);
  host?.onLibraryChanged?.();
  return { id: params.id };
}

async function openCard(params: OpenParams): Promise<{ id: string }> {
  const card = await findCard(params.id);
  host?.openCard(card);
  return { id: card.id };
}
