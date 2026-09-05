// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { downloadJson, downloadPng, downloadBlob } from "./download";

/**
 * Every export path ends here, and a download that silently does nothing is
 * indistinguishable from one the browser blocked.
 */

let created: string[] = [];
let revoked: string[] = [];
let clicked: HTMLAnchorElement[] = [];

beforeEach(() => {
  created = [];
  revoked = [];
  clicked = [];
  vi.stubGlobal("URL", {
    ...URL,
    createObjectURL: vi.fn(() => {
      const url = `blob:test/${created.length}`;
      created.push(url);
      return url;
    }),
    revokeObjectURL: vi.fn((url: string) => void revoked.push(url)),
  });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    clicked.push(this);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  // Anchors are removed on a timer that these tests mostly do not run out.
  document.querySelectorAll("a[download]").forEach((a) => a.remove());
});

describe("downloadBlob", () => {
  it("clicks an anchor that is in the document, so Firefox honours it too", () => {
    // The bug this pins: a detached anchor's click is a no-op in Firefox, and
    // the export appeared to work while producing no file.
    downloadBlob(new Blob(["x"]), "card.png");

    expect(clicked).toHaveLength(1);
    expect(clicked[0].download).toBe("card.png");
    expect(clicked[0].href).toBe(created[0]);
  });

  it("cleans up the anchor and the URL, but only after the download has started", () => {
    vi.useFakeTimers();
    try {
      downloadBlob(new Blob(["x"]), "card.png");
      // Revoking synchronously can cancel a large archive mid-write, so both
      // the anchor and the URL outlive the click.
      expect(document.querySelectorAll("a[download]")).toHaveLength(1);
      expect(revoked).toEqual([]);

      vi.advanceTimersByTime(1000);
      expect(document.querySelectorAll("a[download]")).toHaveLength(0);
      expect(revoked).toEqual(created);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("downloadJson", () => {
  it("writes pretty JSON under a .json name", () => {
    downloadJson({ name: "Rook" }, "Rook", true);
    expect(clicked[0].download).toBe("Rook.json");
  });

  it("keeps a .json extension the caller already supplied", () => {
    downloadJson({ name: "Rook" }, "Rook.json", false);
    expect(clicked[0].download).toBe("Rook.json");
  });
});

describe("downloadPng", () => {
  it("writes bytes under a .png name", () => {
    downloadPng(new Uint8Array([1, 2, 3]), "Rook");
    expect(clicked[0].download).toBe("Rook.png");
  });

  it("keeps a .png extension the caller already supplied", () => {
    downloadPng(new Uint8Array([1, 2, 3]), "Rook.png");
    expect(clicked[0].download).toBe("Rook.png");
  });
});
