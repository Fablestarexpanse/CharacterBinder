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
  proveToken,
  randomNonce,
  safeEqual,
  PROOF_SERVER,
  PROOF_CLIENT,
  type BridgeMethod,
  type BridgeCalls,
  type BridgeRequest,
  type BridgeResponse,
  type CardSummary,
  type CreateParams,
  type DeleteParams,
  type GetParams,
  type ListParams,
  type OpenParams,
  type UpdateParams,
} from "../shared/bridgeProtocol";
import { getAllCards, getCard as readCard, saveCardInput, saveLibraryCard, deleteCard } from "./library";
import { createBlankTavernCard } from "../shared/tavernCard";
import { coerceCardBody, coerceCharacterData } from "./blankCards";
import { createPersistedSettings } from "./persistedSettings";
import { CARD_TYPES, isCardType, type LibraryCard, type LibraryCardType, type TavernCardV2 } from "../types";
import { errorMessage } from "../shared/errorMessage";

/** Same read/patch contract as the app's other persisted settings. */
const bridgeStore = createPersistedSettings("cb_bridge", { token: "", enabled: false });

/**
 * The token and the on/off flag used to be two bare localStorage keys. Carry
 * them into the store once, so an existing user is not silently logged out of
 * their own bridge and left retyping a token they already pasted.
 */
(function migrateLegacyBridgeKeys() {
  try {
    const token = localStorage.getItem("cb_bridge_token");
    const enabled = localStorage.getItem("cb_bridge_enabled");
    if (token === null && enabled === null) return;
    bridgeStore.save({
      ...(token !== null ? { token } : {}),
      ...(enabled !== null ? { enabled: enabled === "1" } : {}),
    });
    localStorage.removeItem("cb_bridge_token");
    localStorage.removeItem("cb_bridge_enabled");
  } catch {
    // Storage blocked; the user pastes the token again, which is the same
    // position they would be in with no storage at all.
  }
})();

export function getBridgeToken(): string {
  return bridgeStore.get().token;
}

export function setBridgeToken(token: string) {
  bridgeStore.save({ token: token.trim() });
}

export type BridgeStatus = "off" | "connecting" | "connected" | "error";

/** One served call, for the activity list the user can look at after the fact. */
export interface BridgeActivity {
  at: number;
  method: BridgeMethod;
  /** The card the call touched, when it named one. */
  cardId?: string;
  cardName?: string;
  /** Set when the user was asked and said no. */
  refused?: boolean;
}

/** Most recent calls kept in memory. Enough to answer "what did it just do?". */
const ACTIVITY_LIMIT = 50;

export interface BridgeState {
  status: BridgeStatus;
  error: string | null;
  /** Rolling count of RPCs served, so the UI can show that something happened. */
  served: number;
  lastMethod: string | null;
  /** Newest first. A counter alone could not tell the user what was changed. */
  activity: BridgeActivity[];
}

let state: BridgeState = { status: "off", error: null, served: 0, lastMethod: null, activity: [] };

function recordActivity(entry: BridgeActivity) {
  setState({ activity: [entry, ...state.activity].slice(0, ACTIVITY_LIMIT) });
}
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
  /** @returns false when there was nothing to open — a record with no body. */
  openCard: (card: LibraryCard) => boolean;
  onLibraryChanged?: () => void;
  /**
   * Ask the user to approve a destructive call before it happens.
   *
   * A paired agent is trusted to write cards, but deleting one and overwriting
   * an existing one are irreversible — the library has no undo — and every
   * equivalent path in the UI confirms first. Without this the bridge was the
   * one way to destroy a card silently. Absent host: the call is refused rather
   * than allowed, so a missing hook cannot quietly widen what an agent may do.
   */
  confirmDestructive?: (request: { action: "delete" | "overwrite"; card: LibraryCard }) => Promise<boolean>;
}

let host: BridgeHost | null = null;

// ── Connection ──────────────────────────────────────────────────────────────

let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let manualDisconnect = false;

export function isBridgeEnabled(): boolean {
  return bridgeStore.get().enabled;
}

export function connectBridge() {
  bridgeStore.save({ enabled: true });
  manualDisconnect = false;
  openSocket();
}

export function disconnectBridge() {
  bridgeStore.save({ enabled: false });
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
  host = h;
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
  const frame = msg as { type?: string; serverNonce?: string; proof?: string; reason?: string };

  const refuse = (error: string, code?: number, reason?: string) => {
    manualDisconnect = true;
    setState({ status: "error", error });
    if (code) ws.close(code, reason);
    else ws.close();
  };

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
    if (!safeEqual(String(frame.proof ?? ""), expected)) {
      // Whatever is on that port does not hold the token. Say nothing more.
      refuse("The server on that port failed to prove it holds your pairing token. Not sending anything to it.");
      return false;
    }

    ctx.prove();
    ws.send(JSON.stringify({ type: "auth", proof: await proveToken(token, PROOF_CLIENT + String(frame.serverNonce ?? "")) }));
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
    setState({ status: "error", error: `Pairing rejected: ${frame.reason ?? "bad token"}. Check the token in Settings.` });
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
      setState({ served: state.served + 1, lastMethod: msg.method });
    } catch (err) {
      response.error = errorMessage(err);
    }
    ws.send(JSON.stringify(response));
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

// ── RPC handlers ────────────────────────────────────────────────────────────

/**
 * Params arrive as whatever the peer sent. Each accessor below states what the
 * method needs and fails with a message the agent can act on, rather than the
 * handler casting and discovering the problem as a TypeError halfway through a
 * save.
 */
function paramsObject(params: unknown): Record<string, unknown> {
  return params && typeof params === "object" && !Array.isArray(params)
    ? (params as Record<string, unknown>)
    : {};
}

function requiredId(params: unknown, method: string): string {
  const id = paramsObject(params).id;
  if (typeof id !== "string" || !id) {
    throw new Error(`${method} needs an "id" string. Call list_cards to see what exists.`);
  }
  return id;
}

function requiredBody(params: unknown, field: string, method: string): Record<string, unknown> {
  const value = paramsObject(params)[field];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${method} needs "${field}" to be an object of card fields.`);
  }
  return value as Record<string, unknown>;
}

/**
 * Carry out one RPC from the connected agent.
 *
 * Exported so the handlers can be driven directly: the socket and handshake are
 * covered from the server side, and what a call does to the library is what
 * matters here.
 */
export async function handleBridgeRequest(req: BridgeRequest): Promise<unknown> {
  const p = paramsObject(req.params);
  switch (req.method) {
    case "ping":
      return { ok: true, app: "CharacterBinder", version: __APP_VERSION__ };
    case "cards.list": {
      const type = p.type;
      if (type !== undefined && !isCardType(type)) {
        throw new Error(`Unknown card type "${String(type)}". Expected one of: ${CARD_TYPES.join(", ")}.`);
      }
      return listCards({ type });
    }
    case "cards.get":
      return getCard({ id: requiredId(req.params, "get_card") });
    case "cards.create":
      if (!isCardType(p.cardType)) {
        throw new Error(`Unknown cardType "${String(p.cardType)}". Expected one of: ${CARD_TYPES.join(", ")}.`);
      }
      return createCard({
        cardType: p.cardType,
        // Named for the tool the agent actually called: cards.create serves
        // one create_* tool per kind, and "create" is not a tool at all.
        data: requiredBody(req.params, "data", `create_${p.cardType}`),
        imageSrc: p.imageSrc as string | null | undefined,
        open: p.open === true,
      });
    case "cards.update":
      return updateCard({
        id: requiredId(req.params, "update_card"),
        patch: requiredBody(req.params, "patch", "update_card"),
        open: p.open === true,
      });
    case "cards.delete":
      return removeCard({ id: requiredId(req.params, "delete_card") });
    case "app.open":
      return openCard({ id: requiredId(req.params, "open_card") });
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

async function listCards(params: ListParams = {}): Promise<BridgeCalls["cards.list"]["result"]> {
  const all = await getAllCards();
  const filtered = params.type ? all.filter((c) => c.cardType === params.type) : all;
  return { cards: filtered.map(summarise) };
}

async function findCard(id: string): Promise<LibraryCard> {
  const card = await readCard(id);
  if (!card) throw new Error(`No card with id ${id}. Call list_cards to see what exists.`);
  return card;
}

async function getCard(params: GetParams): Promise<BridgeCalls["cards.get"]["result"]> {
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
  cardType: LibraryCardType,
  body: Record<string, unknown>,
  imageSrc: string | null,
  existing?: LibraryCard
): Promise<LibraryCard> {
  const existingId = existing?.id;

  if (cardType === "character") {
    const blank = createBlankTavernCard();
    const card: TavernCardV2 = { ...blank, data: coerceCharacterData(body) };
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

  // coerceCardBody returns that kind's own shape, and saveCardInput proves the
  // two line up — so a peer's body is checked against the type it will be
  // stored as, not cast into it.
  return saveLibraryCard(saveCardInput(cardType, coerceCardBody(cardType, body), common));
}

/**
 * Cover art arriving over the bridge must be inline data. A remote URL would be
 * rendered into an <img src> on every Library paint, turning the user's card
 * collection into a beacon for whoever supplied it.
 *
 * Returns null when no image was supplied, and *throws* when one was supplied
 * that is not inline data — a card silently saved without the art an agent
 * thought it set is the worse outcome, and refusing a remote URL loudly is the
 * whole point.
 */
function requireInlineImageSrc(src: unknown): string | null {
  if (typeof src !== "string" || !src) return null;
  if (!/^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(src)) {
    throw new Error("imageSrc must be an inline data:image/* URL, not a remote address.");
  }
  return src;
}



async function createCard(params: CreateParams): Promise<BridgeCalls["cards.create"]["result"]> {
  if (!params?.cardType) throw new Error("cardType is required.");
  if (!CARD_TYPES.includes(params.cardType)) {
    throw new Error(`Unknown cardType "${params.cardType}". Expected one of: ${CARD_TYPES.join(", ")}.`);
  }
  const saved = await persist(params.cardType, params.data ?? {}, requireInlineImageSrc(params.imageSrc));
  host?.onLibraryChanged?.();
  recordActivity({ at: Date.now(), method: "cards.create", cardId: saved.id, cardName: saved.name });
  // Reported rather than assumed: `open: true` with no host, or a card the
  // editor cannot show, would otherwise be answered "opened in the app".
  const opened = params.open ? host?.openCard(saved) ?? false : false;
  return { id: saved.id, name: saved.name, cardType: saved.cardType, opened };
}

/**
 * Approvals still waiting on the user. If the bridge drops while a prompt is
 * open, they are refused: the agent is gone, so applying the change afterwards
 * would destroy a card on behalf of nobody.
 */
const pendingApprovals = new Set<(approved: boolean) => void>();

function cancelPendingApprovals() {
  for (const decide of pendingApprovals) decide(false);
  pendingApprovals.clear();
}

/** Throws unless the user approves; the agent sees the refusal as an error. */
async function requireApproval(action: "delete" | "overwrite", card: LibraryCard): Promise<void> {
  const ask = host?.confirmDestructive;
  if (!ask) {
    throw new Error(
      `Refusing to ${action} "${card.name}": the app cannot ask the user to confirm right now. Try again with the app window in focus.`
    );
  }
  let settle: (approved: boolean) => void = () => {};
  const cancelled = new Promise<boolean>((resolve) => {
    settle = resolve;
    pendingApprovals.add(resolve);
  });
  let approved: boolean;
  try {
    approved = await Promise.race([ask({ action, card }), cancelled]);
  } finally {
    pendingApprovals.delete(settle);
  }
  if (!approved) {
    recordActivity({ at: Date.now(), method: action === "delete" ? "cards.delete" : "cards.update", cardId: card.id, cardName: card.name, refused: true });
    throw new Error(`The user declined to ${action} "${card.name}".`);
  }
}

async function updateCard(params: UpdateParams): Promise<BridgeCalls["cards.update"]["result"]> {
  const existing = await findCard(params.id);
  await requireApproval("overwrite", existing);
  const merged = { ...(bodyOf(existing) ?? {}), ...(params.patch ?? {}) };
  const saved = await persist(
    existing.cardType,
    merged,
    existing.imageSrc,
    existing
  );
  host?.onLibraryChanged?.();
  recordActivity({ at: Date.now(), method: "cards.update", cardId: saved.id, cardName: saved.name });
  const opened = params.open ? host?.openCard(saved) ?? false : false;
  return { id: saved.id, name: saved.name, cardType: saved.cardType, opened };
}

async function removeCard(params: DeleteParams): Promise<BridgeCalls["cards.delete"]["result"]> {
  // Look it up first: a 404 with a useful message rather than silently
  // succeeding, and the confirmation can name the card being destroyed.
  const card = await findCard(params.id);
  await requireApproval("delete", card);
  await deleteCard(params.id);
  host?.onLibraryChanged?.();
  recordActivity({ at: Date.now(), method: "cards.delete", cardId: card.id, cardName: card.name });
  return { id: params.id };
}

async function openCard(params: OpenParams): Promise<BridgeCalls["app.open"]["result"]> {
  const card = await findCard(params.id);
  if (!host) {
    throw new Error("CharacterBinder is connected but has no editor to open cards in. Reload the app tab.");
  }
  const opened = host.openCard(card);
  // Recorded like the others: opening a card replaces whatever the user was
  // editing, so it belongs in the list of what the agent did.
  recordActivity({ at: Date.now(), method: "app.open", cardId: card.id, cardName: card.name });
  if (!opened) {
    throw new Error(`"${card.name}" has no editable data, so nothing was opened.`);
  }
  return { id: card.id, opened };
}
