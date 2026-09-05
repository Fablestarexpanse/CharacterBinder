import { randomBytes } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";
import { mkdirSync, readFileSync, writeFileSync, chmodSync } from "node:fs";

/**
 * The shared secret that pairs the app with this server.
 *
 * Kept in a file only the user can read, and persisted rather than regenerated,
 * so pairing survives a server restart. The app never reads this file — the
 * user copies the value across once — which is precisely why it can double as
 * proof that whoever holds the port is the real server.
 */

/**
 * Where the token lives, resolved per call rather than at import.
 *
 * `baseDir` exists so a test can point this somewhere disposable. With the path
 * fixed at import time the only way to redirect it was to mock node:os, and a
 * mock that fails to take writes over the user's real pairing token — which is
 * exactly what happened while writing these tests.
 */
function tokenDir(baseDir?: string): string {
  return join(baseDir ?? homedir(), ".characterbinder");
}

export function tokenPath(baseDir?: string): string {
  return join(tokenDir(baseDir), "bridge-token");
}

/**
 * @returns the token, and whether it had to be minted — the caller prints a
 * freshly minted one so the user can copy it, but not one that already exists:
 * an agent's stdout log is not a good place for a standing secret.
 */
export function loadOrCreateToken(baseDir?: string): { token: string; created: boolean } {
  const file = tokenPath(baseDir);
  try {
    const existing = readFileSync(file, "utf8").trim();
    if (existing.length >= 32) return { token: existing, created: false };
  } catch {
    /* first run, or unreadable — fall through and mint a new one */
  }

  const token = randomBytes(32).toString("hex");
  mkdirSync(tokenDir(baseDir), { recursive: true });
  writeFileSync(file, `${token}\n`, { encoding: "utf8", mode: 0o600 });
  try {
    // mkdir/writeFile modes are advisory on some platforms; assert it after.
    chmodSync(file, 0o600);
  } catch {
    /* best effort — Windows ACLs don't map cleanly onto POSIX modes */
  }
  return { token, created: true };
}
