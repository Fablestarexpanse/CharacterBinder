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

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * PNG bytes for the given cover image, falling back to a 1×1 transparent PNG
 * when there is no usable image. Never throws for a merely-unsupported format.
 */
export async function getCarrierPng(imageSrc?: string | null): Promise<Uint8Array> {
  if (!imageSrc) return MINIMAL_PNG;
  if (imageSrc.startsWith("data:image/png")) {
    return base64ToBytes(imageSrc.split(",")[1] ?? "");
  }
  if (imageSrc.startsWith("data:image/")) {
    return imageSrcToPngBytes(imageSrc);
  }
  return MINIMAL_PNG;
}
