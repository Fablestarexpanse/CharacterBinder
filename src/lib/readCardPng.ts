import type { LibraryCardType, MetadataKey, PngChunkInfo } from "../types";
import { decodeCharaFromPng, getPngDimensions, isPng } from "./pngMetadata";
import { pngBytesToDataUrl } from "./carrierImage";
import { effectiveShape } from "./cardShape";

/**
 * Read a card out of PNG bytes: decode, classify, and say what was found.
 *
 * Import PNG and Decode PNG both need this and assembled it separately, which
 * is how they came to disagree about what a file was — one routed by the
 * payload's shape, the other by the metadata keyword. The user-facing
 * distinction between "no card here" and "a card that will not decode" is also
 * stated once, because they call for opposite responses.
 */

export type CardPngResult =
  | { kind: "not-png" }
  /** A card chunk is present but its payload would not decode. */
  | { kind: "damaged"; corruptKey: string; chunks: PngChunkInfo[]; dimensions: { width: number; height: number } | null }
  | { kind: "no-card"; chunks: PngChunkInfo[]; dimensions: { width: number; height: number } | null }
  | {
      kind: "card";
      /** What the payload is, which need not be what the keyword claims. */
      shape: LibraryCardType | null;
      /** True when keyword and payload disagree; the payload wins. */
      mismatch: boolean;
      key: MetadataKey;
      json: string;
      /** The decoded payload. Its fields are whatever the file carried. */
      parsed: Record<string, unknown>;
      imageSrc: string;
      chunks: PngChunkInfo[];
      dimensions: { width: number; height: number } | null;
    };

export function readCardPng(bytes: Uint8Array): CardPngResult {
  if (!isPng(bytes)) return { kind: "not-png" };

  const dimensions = getPngDimensions(bytes);
  const { json, key, chunks, corruptKey } = decodeCharaFromPng(bytes);

  if (!json || !key) {
    return corruptKey
      ? { kind: "damaged", corruptKey, chunks, dimensions }
      : { kind: "no-card", chunks, dimensions };
  }

  const parsed = JSON.parse(json) as Record<string, unknown>;
  const { shape, mismatch } = effectiveShape(key, parsed);
  return {
    kind: "card",
    shape,
    mismatch,
    key,
    json,
    parsed,
    imageSrc: pngBytesToDataUrl(bytes),
    chunks,
    dimensions,
  };
}
