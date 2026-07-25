/**
 * Single place that turns data into a browser download.
 *
 * Two details this gets right that hand-rolled copies usually don't:
 *  - the anchor is attached to the document before clicking (Firefox ignores
 *    clicks on detached anchors), and
 *  - the object URL is revoked on a later tick, not synchronously after
 *    `.click()`, which can cancel the download while it's still starting.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
}

/** Serialise `data` and download it as `<filename>.json`. */
export function downloadJson(data: unknown, filename: string, pretty = true): void {
  const json = JSON.stringify(data, null, pretty ? 2 : 0);
  const name = filename.replace(/\.(png|json)$/i, "") + ".json";
  downloadBlob(new Blob([json], { type: "application/json" }), name);
}

/** Download raw PNG bytes as `<filename>.png`. */
export function downloadPng(bytes: Uint8Array, filename: string): void {
  const name = filename.toLowerCase().endsWith(".png") ? filename : filename + ".png";
  downloadBlob(new Blob([bytes.buffer as ArrayBuffer], { type: "image/png" }), name);
}
