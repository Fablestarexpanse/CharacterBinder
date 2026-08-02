/**
 * A 1×1 fully transparent PNG — the fallback carrier image when a card has no
 * cover art of its own.
 *
 * Generated programmatically and verified byte-for-byte: every chunk's declared
 * length matches the bytes present, every CRC validates, and the stream ends
 * exactly on IEND. `minimalPng.test.ts` re-checks all of that.
 *
 * This matters more than it looks. The previous constant declared an IDAT
 * length of 12 with only 11 bytes of data, so a reader would over-run into the
 * IEND marker, mistake its tail for another chunk, and never emit a real IEND.
 * Every card exported without cover art came out structurally corrupt.
 */
export const MINIMAL_PNG = new Uint8Array([
  // signature
  137, 80, 78, 71, 13, 10, 26, 10,
  // IHDR — 1×1, 8-bit, colour type 6 (RGBA)
  0, 0, 0, 13, 73, 72, 68, 82,
  0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137,
  // IDAT — deflate of one filter byte + RGBA(0,0,0,0)
  0, 0, 0, 11, 73, 68, 65, 84,
  120, 218, 99, 96, 0, 2, 0, 0, 5, 0, 1, 233, 250, 220, 216,
  // IEND
  0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
]);
