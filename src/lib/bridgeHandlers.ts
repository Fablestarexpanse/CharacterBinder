/**
 * What each bridge method does once a peer is authenticated.
 *
 * The socket, the handshake and the reconnect policy live in bridgeClient; this
 * is only the library work, so it can be driven directly by tests.
 */

import {
  type BridgeCalls,
  type BridgeMethod,
  type BridgeRequest,
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
import { coerceCardBody, coerceCharacterData } from "../shared/blankCards";
import { CARD_TYPES, isCardType, type LibraryCard, type LibraryCardType, type TavernCardV2 } from "../types";
import { getHost, recordActivity } from "./bridgeState";

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
/**
 * One place a bad card type is rejected, with one message. Both the list filter
 * and the create call take a kind from the agent, and each used to test it
 * again with wording of its own.
 */
function requireCardType(value: unknown): LibraryCardType {
  if (!isCardType(value)) {
    throw new Error(`Unknown cardType "${String(value)}". Expected one of: ${CARD_TYPES.join(", ")}.`);
  }
  return value;
}

export async function handleBridgeRequest(
  req: BridgeRequest
): Promise<BridgeCalls[BridgeMethod]["result"]> {
  const p = paramsObject(req.params);
  switch (req.method) {
    case "ping":
      return { ok: true, app: "CharacterBinder", version: __APP_VERSION__ };
    case "cards.list":
      return listCards({ type: p.type === undefined ? undefined : requireCardType(p.type) });
    case "cards.get":
      return getCard({ id: requiredId(req.params, "get_card") });
    case "cards.create": {
      const cardType = requireCardType(p.cardType);
      return createCard({
        cardType,
        // Named for the tool the agent actually called: cards.create serves
        // one create_* tool per kind, and "create" is not a tool at all.
        data: requiredBody(req.params, "data", `create_${cardType}`),
        imageSrc: p.imageSrc as string | null | undefined,
        open: p.open === true,
      });
    }
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
  const saved = await persist(params.cardType, params.data ?? {}, requireInlineImageSrc(params.imageSrc));
  getHost()?.onLibraryChanged?.();
  recordActivity({ at: Date.now(), method: "cards.create", cardId: saved.id, cardName: saved.name });
  const opened = params.open ? tryOpen(saved) : false;
  return { id: saved.id, name: saved.name, cardType: saved.cardType, opened };
}

/**
 * Open a card the agent asked to be shown, alongside a write.
 *
 * The write itself succeeded, so a failure to open is not an error for the
 * call — but it is not silence either: the reason goes into the activity list
 * the user can read, and the agent is answered `opened: false` rather than
 * being told the card is on screen.
 */
function tryOpen(card: LibraryCard): boolean {
  const host = getHost();
  if (!host) return false;
  const reason = host.openCard(card);
  if (reason) {
    recordActivity({ at: Date.now(), method: "app.open", cardId: card.id, cardName: card.name, refused: true });
    return false;
  }
  return true;
}

/**
 * Approvals still waiting on the user. If the bridge drops while a prompt is
 * open, they are refused: the agent is gone, so applying the change afterwards
 * would destroy a card on behalf of nobody.
 */
const pendingApprovals = new Set<(approved: boolean) => void>();

export function cancelPendingApprovals() {
  for (const decide of pendingApprovals) decide(false);
  pendingApprovals.clear();
}

/** Throws unless the user approves; the agent sees the refusal as an error. */
async function requireApproval(action: "delete" | "overwrite", card: LibraryCard): Promise<void> {
  const ask = getHost()?.confirmDestructive;
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
  // Both sides are already objects: bodyOf returns the record's own body, and
  // the protocol schema rejects a call whose patch is missing.
  const merged = { ...bodyOf(existing), ...params.patch };
  const saved = await persist(
    existing.cardType,
    merged,
    existing.imageSrc,
    existing
  );
  getHost()?.onLibraryChanged?.();
  recordActivity({ at: Date.now(), method: "cards.update", cardId: saved.id, cardName: saved.name });
  const opened = params.open ? tryOpen(saved) : false;
  return { id: saved.id, name: saved.name, cardType: saved.cardType, opened };
}

async function removeCard(params: DeleteParams): Promise<BridgeCalls["cards.delete"]["result"]> {
  // Look it up first: a 404 with a useful message rather than silently
  // succeeding, and the confirmation can name the card being destroyed.
  const card = await findCard(params.id);
  await requireApproval("delete", card);
  await deleteCard(params.id);
  getHost()?.onLibraryChanged?.();
  recordActivity({ at: Date.now(), method: "cards.delete", cardId: card.id, cardName: card.name });
  return { id: params.id };
}

async function openCard(params: OpenParams): Promise<BridgeCalls["app.open"]["result"]> {
  const card = await findCard(params.id);
  const host = getHost();
  if (!host) {
    throw new Error("CharacterBinder is connected but has no editor to open cards in. Reload the app tab.");
  }
  const reason = host.openCard(card);
  // Recorded like the others: opening a card replaces whatever the user was
  // editing, so it belongs in the list of what the agent did — and a refusal
  // belongs there too.
  recordActivity({ at: Date.now(), method: "app.open", cardId: card.id, cardName: card.name, refused: !!reason });
  if (reason) throw new Error(reason);
  return { id: card.id, opened: true };
}
