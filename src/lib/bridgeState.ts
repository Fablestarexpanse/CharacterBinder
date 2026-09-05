/**
 * What the app knows about the bridge: the pairing token, the connection state
 * the UI renders, the log of what an agent has done, and the host callbacks the
 * RPC handlers reach back through.
 *
 * Kept apart from the socket and from the handlers so both can depend on it
 * without depending on each other.
 */

import { createPersistedSettings } from "./persistedSettings";
import type { BridgeMethod } from "../shared/bridgeProtocol";
import type { LibraryCard } from "../types";

const bridgeStore = createPersistedSettings("cb_bridge", { token: "", enabled: false });

/**
 * The token and the on/off flag used to be two bare localStorage keys. Carry
 * them into the store once, so an existing user is not silently logged out of
 * their own bridge and left retyping a token they already pasted.
 *
 * Run on the first read rather than at import: importing a module should not
 * write to storage, and a lazy shim can't lose a race with whoever imports
 * first. Added 2026-09; delete it — and this flag — after 2027-09, by which
 * point any install still on the old keys has been unused for a year.
 */
let migrated = false;

function ensureMigrated(): void {
  if (migrated) return;
  migrated = true;
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
}

export function getBridgeToken(): string {
  ensureMigrated();
  return bridgeStore.get().token;
}

/** Whether the user left the bridge switched on. */
export function isBridgeEnabled(): boolean {
  ensureMigrated();
  return bridgeStore.get().enabled;
}

export function setBridgeEnabled(enabled: boolean): void {
  ensureMigrated();
  bridgeStore.save({ enabled });
}

export function setBridgeToken(token: string) {
  ensureMigrated();
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

export let state: BridgeState = { status: "off", error: null, served: 0, lastMethod: null, activity: [] };

export function recordActivity(entry: BridgeActivity) {
  setState({ activity: [entry, ...state.activity].slice(0, ACTIVITY_LIMIT) });
}
const listeners = new Set<(s: BridgeState) => void>();

export function setState(patch: Partial<BridgeState>) {
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

/** The registered host, or null before the app has wired one up. */
export function getHost(): BridgeHost | null {
  return host;
}

export function setHost(next: BridgeHost): void {
  host = next;
}
