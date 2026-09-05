import type { AppSettings, TavernCardV2 } from "../types";
import type { PlatformId } from "../shared/platforms/registry";
import { PLATFORMS } from "../shared/platforms/registry";
import { convertCardTo } from "../shared/platforms/converters";
import { encodeCharaToPng } from "./pngMetadata";
import { getCarrierPng } from "./carrierImage";

/**
 * A character card encoded into its PNG, for the target platform.
 *
 * Exporting and saving to the library both need exactly this: the card
 * converted for its platform, serialised to the user's JSON preference, and
 * embedded under that platform's metadata key. The library stores the encoded
 * PNG rather than the bare cover art, because that is what an archive export
 * writes into the ZIP.
 */

/** Platforms that cannot read card PNGs still get a valid, importable file. */
export const FALLBACK_METADATA_KEY = "chara" as const;

/** The chunk keyword a card exported for this platform is written under. */
export function metadataKeyFor(platformId: PlatformId): string {
  return PLATFORMS[platformId].metadataKey ?? FALLBACK_METADATA_KEY;
}

export async function encodeCharacterCardPng(
  card: TavernCardV2,
  imageSrc: string | null | undefined,
  platformId: PlatformId,
  settings: Pick<AppSettings, "prettyPrintJson" | "preserveUnknownChunks">
): Promise<Uint8Array> {
  const carrier = await getCarrierPng(imageSrc);
  const converted = convertCardTo(card, platformId);
  const json = JSON.stringify(converted, null, settings.prettyPrintJson ? 2 : 0);
  return encodeCharaToPng(
    carrier,
    json,
    metadataKeyFor(platformId) as Parameters<typeof encodeCharaToPng>[2],
    settings.preserveUnknownChunks
  );
}
