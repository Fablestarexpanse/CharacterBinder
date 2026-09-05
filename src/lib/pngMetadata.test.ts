import { describe, it, expect } from "vitest";
import { encodeCharaToPng, decodeCharaFromPng, isPng, getPngDimensions } from "./pngMetadata";
import { MINIMAL_PNG } from "./minimalPng";

/**
 * This module is the product: it writes the tEXt chunk that carries a card and
 * rebuilds the PNG byte stream around it. A regression here produces files that
 * look fine in the app and are silently rejected days later by SillyTavern, so
 * the structural assertions below matter more than the round-trip ones.
 */

// ── An independent PNG reader, deliberately not sharing code with the module ──
// under test. If both used the same parser, a bug in the parser would hide a
// bug in the writer.

function crc32(data: Uint8Array): number {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const b of data) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

interface Parsed {
  type: string;
  length: number;
  crcValid: boolean;
  data: Uint8Array;
}

/** Walks the stream strictly; throws rather than tolerating anything malformed. */
function strictParse(bytes: Uint8Array): { chunks: Parsed[]; endedAt: number } {
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < 8; i++) {
    if (bytes[i] !== sig[i]) throw new Error("bad PNG signature");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const chunks: Parsed[] = [];
  let offset = 8;

  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) throw new Error(`truncated chunk header at ${offset}`);
    const length = view.getUint32(offset, false);
    if (offset + 12 + length > bytes.length) {
      throw new Error(`chunk at ${offset} declares ${length} bytes but the file ends first`);
    }
    const type = String.fromCharCode(...bytes.slice(offset + 4, offset + 8));
    const data = bytes.slice(offset + 8, offset + 8 + length);
    const stored = view.getUint32(offset + 8 + length, false);
    const calc = crc32(bytes.slice(offset + 4, offset + 8 + length));
    chunks.push({ type, length, crcValid: stored === calc, data });
    offset += 12 + length;
    if (type === "IEND") break;
  }
  return { chunks, endedAt: offset };
}

/** Every structural invariant a conformant PNG reader relies on. */
function expectStructurallyValid(bytes: Uint8Array) {
  const { chunks, endedAt } = strictParse(bytes);
  expect(chunks.length).toBeGreaterThan(0);
  for (const c of chunks) {
    expect(`${c.type} crc`).toBe(c.crcValid ? `${c.type} crc` : "INVALID");
  }
  expect(chunks[0].type).toBe("IHDR");
  expect(chunks[chunks.length - 1].type).toBe("IEND");
  expect(chunks.filter((c) => c.type === "IEND")).toHaveLength(1);
  // The cursor must land exactly on the end — no trailing bytes, no overrun.
  expect(endedAt).toBe(bytes.length);
}

const card = (name: string, extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    spec: "chara_card_v2",
    spec_version: "2.0",
    data: { name, description: "A dockhand.", ...extra },
  });

describe("MINIMAL_PNG (the fallback carrier)", () => {
  // Regression: this constant declared an IDAT length of 12 with 11 bytes of
  // data, so every export without cover art was corrupt.
  it("is a structurally valid PNG", () => {
    expectStructurallyValid(MINIMAL_PNG);
  });

  it("is a 1x1 image", () => {
    expect(getPngDimensions(MINIMAL_PNG)).toEqual({ width: 1, height: 1 });
  });

  it("passes the signature check", () => {
    expect(isPng(MINIMAL_PNG)).toBe(true);
  });
});

describe("encode", () => {
  it("produces a structurally valid PNG from the fallback carrier", () => {
    const out = encodeCharaToPng(MINIMAL_PNG, card("Rook"), "chara", false);
    expectStructurallyValid(out);
  });

  it("round-trips the card JSON", () => {
    const out = encodeCharaToPng(MINIMAL_PNG, card("Rook"), "chara", false);
    const decoded = decodeCharaFromPng(out);
    expect(decoded.json).not.toBeNull();
    expect(JSON.parse(decoded.json!).data.name).toBe("Rook");
    expect(decoded.key).toBe("chara");
  });

  it("survives emoji and astral characters", () => {
    const name = "Zoë 🐉 Ünicode 𝔘";
    const out = encodeCharaToPng(MINIMAL_PNG, card(name), "chara", false);
    expectStructurallyValid(out);
    expect(JSON.parse(decodeCharaFromPng(out).json!).data.name).toBe(name);
  });

  it("places the card chunk before IDAT", () => {
    const { chunks } = strictParse(encodeCharaToPng(MINIMAL_PNG, card("Rook"), "chara", false));
    const types = chunks.map((c) => c.type);
    expect(types.indexOf("tEXt")).toBeLessThan(types.indexOf("IDAT"));
  });

  it("keeps exactly one card chunk when re-encoding", () => {
    let out = encodeCharaToPng(MINIMAL_PNG, card("Alice"), "chara", true);
    out = encodeCharaToPng(out, card("Bob"), "chara", true);
    out = encodeCharaToPng(out, card("Carol"), "chara", true);
    expectStructurallyValid(out);

    const { chunks } = strictParse(out);
    const chara = chunks.filter(
      (c) => c.type === "tEXt" && String.fromCharCode(...c.data.slice(0, 5)) === "chara"
    );
    expect(chara).toHaveLength(1);
    expect(JSON.parse(decodeCharaFromPng(out).json!).data.name).toBe("Carol");
  });

  it("does not accumulate stale name chunks across saves", () => {
    // Regression: "name" was missing from the known-keys list, so old copies
    // survived preserveUnknown and readers taking the first one showed the
    // original name forever.
    let out = encodeCharaToPng(MINIMAL_PNG, card("Alice"), "chara", true);
    out = encodeCharaToPng(out, card("Bob"), "chara", true);
    out = encodeCharaToPng(out, card("Carol"), "chara", true);

    const { chunks } = strictParse(out);
    const names = chunks.filter(
      (c) => c.type === "tEXt" && String.fromCharCode(...c.data.slice(0, 4)) === "name"
    );
    expect(names).toHaveLength(1);
    expect(String.fromCharCode(...names[0].data.slice(5))).toBe("Carol");
  });

  it("writes each card type under its own key", () => {
    for (const key of ["chara", "lorebook", "script", "scenario", "persona"] as const) {
      const out = encodeCharaToPng(MINIMAL_PNG, JSON.stringify({ name: "X" }), key, false);
      expectStructurallyValid(out);
      expect(decodeCharaFromPng(out).key).toBe(key);
    }
  });
});

describe("decode — malformed and hostile input", () => {
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];

  /** A file whose first chunk declares `length`, with `total` bytes overall. */
  const crafted = (length: number, total = 32) => {
    const b = new Uint8Array(total);
    b.set(sig);
    new DataView(b.buffer).setUint32(8, length >>> 0, false);
    b.set([73, 68, 65, 84], 12); // "IDAT"
    return b;
  };

  // Regression: `<<`/`|` produced a signed int32, so a high-bit length was
  // negative and the read cursor walked backwards forever, allocating each pass.
  it.each([
    ["0xFFFFFFF4 (-12 when signed)", 0xfffffff4],
    ["0xFFFFFFF8 (-8 when signed)", 0xfffffff8],
    ["0x80000000 (sign bit only)", 0x80000000],
    ["0x7FFFFFFF (max positive)", 0x7fffffff],
  ])("terminates on a chunk length of %s", (_label, length) => {
    // If this regresses the process hangs rather than failing, so the guard is
    // the test timeout.
    expect(() => decodeCharaFromPng(crafted(length))).not.toThrow();
  });

  it("terminates when a chunk length exceeds the remaining bytes", () => {
    expect(() => decodeCharaFromPng(crafted(1000, 32))).not.toThrow();
  });

  it("reports no card for a PNG that carries none", () => {
    expect(decodeCharaFromPng(MINIMAL_PNG).json).toBeNull();
  });

  it("rejects a non-PNG", () => {
    expect(isPng(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]))).toBe(false);
    expect(decodeCharaFromPng(new Uint8Array([1, 2, 3, 4])).json).toBeNull();
  });

  it("handles a truncated file without throwing", () => {
    const full = encodeCharaToPng(MINIMAL_PNG, card("Rook"), "chara", false);
    for (const cut of [10, 20, 40, full.length - 1]) {
      expect(() => decodeCharaFromPng(full.slice(0, cut))).not.toThrow();
    }
  });
});
