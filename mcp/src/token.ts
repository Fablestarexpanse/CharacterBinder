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

const DIR = join(homedir(), ".characterbinder");
const FILE = join(DIR, "bridge-token");

export function loadOrCreateToken(): string {
  try {
    const existing = readFileSync(FILE, "utf8").trim();
    if (existing.length >= 32) return existing;
  } catch {
    /* first run, or unreadable — fall through and mint a new one */
  }

  const token = randomBytes(32).toString("hex");
  mkdirSync(DIR, { recursive: true });
  writeFileSync(FILE, token + "\n", { encoding: "utf8", mode: 0o600 });
  try {
    // mkdir/writeFile modes are advisory on some platforms; assert it after.
    chmodSync(FILE, 0o600);
  } catch {
    /* best effort — Windows ACLs don't map cleanly onto POSIX modes */
  }
  return token;
}

export function tokenPath(): string {
  return FILE;
}
