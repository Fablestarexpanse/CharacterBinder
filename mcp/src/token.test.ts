import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadOrCreateToken, tokenPath } from "./token.js";

// Every case passes an explicit base directory. Nothing here may reach the
// user's real ~/.characterbinder — overwriting that file unpairs their app.
let base = "";

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), "cb-token-"));
});

afterEach(() => {
  rmSync(base, { recursive: true, force: true });
});

describe("loadOrCreateToken", () => {
  it("mints a 64-character hex token on first run and writes it to the file", () => {
    const { token, created } = loadOrCreateToken(base);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(created).toBe(true);
    expect(readFileSync(tokenPath(base), "utf8").trim()).toBe(token);
  });

  it("returns the same token on a later run, so pairing survives a restart", () => {
    const first = loadOrCreateToken(base);
    const second = loadOrCreateToken(base);
    expect(second.token).toBe(first.token);
    // The caller prints only a freshly minted token, so this must say so.
    expect(second.created).toBe(false);
  });

  it("replaces a stored value too short to be a token", () => {
    mkdirSync(join(base, ".characterbinder"), { recursive: true });
    writeFileSync(tokenPath(base), "tooshort\n");

    const { token, created } = loadOrCreateToken(base);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(created).toBe(true);
    expect(readFileSync(tokenPath(base), "utf8").trim()).toBe(token);
  });

  it("mints a different token for a different home", () => {
    const other = mkdtempSync(join(tmpdir(), "cb-token-"));
    try {
      expect(loadOrCreateToken(other)).not.toBe(loadOrCreateToken(base));
    } finally {
      rmSync(other, { recursive: true, force: true });
    }
  });

  it.skipIf(process.platform === "win32")("writes the file readable only by its owner", () => {
    loadOrCreateToken(base);
    expect(statSync(tokenPath(base)).mode & 0o777).toBe(0o600);
  });
});
