import { MINIMAL_PNG } from "./minimalPng";

/**
 * Resolves the PNG bytes that card metadata gets embedded into.
 *
 * Card art arrives as a data URL from an `<input type="file" accept="image/*">`,
 * so it is routinely a JPEG or WebP — but PNG metadata chunks can only be
 * written into a PNG. Anything that isn't already a PNG is re-encoded through a
 * canvas first; without that step `encodeCharaToPng` throws "Invalid PNG data"
 * and the export fails with nothing useful to show the user.
 */

/** Re-encode any browser-decodable image data URL as PNG bytes. */
export function imageSrcToPngBytes(dataUrl: string): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas is not available"));
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        if (!blob) return reject(new Error("Could not convert the image to PNG"));
        blob.arrayBuffer().then((buf) => resolve(new Uint8Array(buf)), reject);
      }, "image/png");
    };
    img.onerror = () => reject(new Error("Could not read the image"));
    img.src = dataUrl;
  });
}

/**
 * PNG bytes as a data: URL, for showing a decoded card's own artwork.
 *
 * Chunked because String.fromCharCode(...bytes) blows the argument limit on a
 * card-sized image, which is exactly the case this is used for.
 */
export function pngBytesToDataUrl(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return "data:image/png;base64," + btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * PNG bytes for the given cover image.
 *
 * Falls back to a 1×1 transparent PNG when there is no image at all, or when
 * the source is not a data: URL we can read. A data:image/* URL that cannot be
 * decoded rejects rather than silently exporting a card with no art: the caller
 * shows the reason, which is the only chance the user has to learn that the
 * image they picked did not make it into the file.
 */
export async function getCarrierPng(imageSrc: string | null): Promise<Uint8Array> {
  if (!imageSrc) return MINIMAL_PNG;
  if (imageSrc.startsWith("data:image/png")) {
    return base64ToBytes(imageSrc.split(",")[1] ?? "");
  }
  if (imageSrc.startsWith("data:image/")) {
    return imageSrcToPngBytes(imageSrc);
  }
  return MINIMAL_PNG;
}
