import { describe, it, expect } from "vitest";
import { webcrypto } from "node:crypto";
import { createHmac } from "node:crypto";
import { proveToken, safeEqual, randomNonce, PROOF_SERVER, PROOF_CLIENT } from "./bridgeProtocol";

// proveToken uses WebCrypto, which Node exposes under a different global name
// in older releases. The app runs it in a browser; this makes it available here.
if (!globalThis.crypto) Object.defineProperty(globalThis, "crypto", { value: webcrypto });

const TOKEN = "56d09ad247c51af4118575ab9a569cdfdf262b2ccf69743d0cd819b51a44b970";

describe("proveToken", () => {
  it("is deterministic and 64 lowercase hex characters", async () => {
    const a = await proveToken(TOKEN, "hello");
    const b = await proveToken(TOKEN, "hello");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("changes when the message changes", async () => {
    expect(await proveToken(TOKEN, "a")).not.toBe(await proveToken(TOKEN, "b"));
  });

  it("changes when the token changes", async () => {
    expect(await proveToken(TOKEN, "a")).not.toBe(await proveToken(TOKEN + "0", "a"));
  });

  it("agrees with the server's node:crypto HMAC, byte for byte", async () => {
    // The two sides of the bridge compute proofs with different crypto APIs;
    // if they ever disagreed, no client could authenticate at all.
    const message = PROOF_SERVER + "abcdef0123456789";
    const server = createHmac("sha256", TOKEN).update(message).digest("hex");
    expect(await proveToken(TOKEN, message)).toBe(server);
  });

  it("gives different proofs for the two directions of the handshake", async () => {
    // Domain separation: without it a proof harvested from one direction is a
    // valid answer in the other, and either peer can be induced to generate the
    // answer it will later be asked to verify.
    const nonce = "0123456789abcdef";
    expect(await proveToken(TOKEN, PROOF_SERVER + nonce)).not.toBe(
      await proveToken(TOKEN, PROOF_CLIENT + nonce)
    );
  });
});

describe("safeEqual", () => {
  it("is true only for identical strings", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("", "")).toBe(true);
  });

  it("is false for a single differing character of the same length", () => {
    expect(safeEqual("abc", "abd")).toBe(false);
    // One bit apart: 'a' is 0x61, '`' is 0x60.
    expect(safeEqual("a", "`")).toBe(false);
  });

  it("is false for differing lengths", () => {
    expect(safeEqual("abc", "abcd")).toBe(false);
    expect(safeEqual("", "a")).toBe(false);
  });
});

describe("randomNonce", () => {
  it("is 32 hex characters and does not repeat", () => {
    const nonces = new Set(Array.from({ length: 100 }, () => randomNonce()));
    expect(nonces.size).toBe(100);
    for (const n of nonces) expect(n).toMatch(/^[0-9a-f]{32}$/);
  });
});
