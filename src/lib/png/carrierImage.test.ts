// @vitest-environment jsdom
// FileReader, atob and <img> come from the DOM; src/lib otherwise runs on node.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCarrierPng, pngBytesToDataUrl } from "./carrierImage";
import { readImageFile } from "./readImageFile";
import { MINIMAL_PNG } from "./minimalPng";
import { isPng } from "./pngMetadata";

beforeEach(() => vi.restoreAllMocks());

describe("pngBytesToDataUrl", () => {
  it("round-trips bytes through a data URL", () => {
    const url = pngBytesToDataUrl(MINIMAL_PNG);
    expect(url.startsWith("data:image/png;base64,")).toBe(true);

    const back = Uint8Array.from(atob(url.split(",")[1]), (c) => c.charCodeAt(0));
    expect(back).toEqual(MINIMAL_PNG);
  });

  it("handles an image larger than the argument limit of String.fromCharCode", () => {
    // The unchunked version threw on anything this size, which is every real
    // card image.
    const big = new Uint8Array(300_000).fill(65);
    expect(() => pngBytesToDataUrl(big)).not.toThrow();
  });
});

describe("getCarrierPng", () => {
  it("falls back to the 1x1 PNG when there is no image", async () => {
    expect(await getCarrierPng(null)).toEqual(MINIMAL_PNG);
    expect(await getCarrierPng(undefined)).toEqual(MINIMAL_PNG);
    expect(await getCarrierPng("")).toEqual(MINIMAL_PNG);
  });

  it("falls back for a source that is not a data URL at all", async () => {
    expect(await getCarrierPng("https://example.com/art.png")).toEqual(MINIMAL_PNG);
  });

  it("returns the bytes of a PNG data URL untouched", async () => {
    const bytes = await getCarrierPng(pngBytesToDataUrl(MINIMAL_PNG));
    expect(bytes).toEqual(MINIMAL_PNG);
    expect(isPng(bytes)).toBe(true);
  });

  it("rejects when a data:image/* URL cannot be decoded, rather than exporting art-less", async () => {
    // jsdom decodes nothing, so the <img> is stood in for: this asserts the
    // path where the browser reports the image as unreadable.
    class FailingImage {
      onerror: (() => void) | null = null;
      onload: (() => void) | null = null;
      set src(_value: string) {
        queueMicrotask(() => this.onerror?.());
      }
    }
    vi.stubGlobal("Image", FailingImage);
    try {
      await expect(getCarrierPng("data:image/jpeg;base64,bm90YW5pbWFnZQ==")).rejects.toThrow(/could not read the image/i);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("readImageFile", () => {
  it("resolves with a data URL for a file it can read", async () => {
    const file = new File(["art-bytes"], "art.png", { type: "image/png" });
    await expect(readImageFile(file)).resolves.toMatch(/^data:image\/png/);
  });

  it("rejects when the file cannot be read", async () => {
    const file = new File(["x"], "art.png", { type: "image/png" });
    vi.spyOn(FileReader.prototype, "readAsDataURL").mockImplementation(function (this: FileReader) {
      Object.defineProperty(this, "error", { value: new DOMException("NotReadableError"), configurable: true });
      this.dispatchEvent(new Event("error"));
    });

    await expect(readImageFile(file)).rejects.toBeTruthy();
  });
});
