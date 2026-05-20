import type { TavernCardV2, ExportFormat, AppSettings } from "../../types";
import {
  tavernToJanitor,
  tavernToRPBuddy,
  tavernToAgnai,
  tavernToGeneric,
} from "../cardFormats";

export function serializeCard(
  card: TavernCardV2,
  format: ExportFormat,
  settings: AppSettings
): string {
  const indent = settings.prettyPrintJson ? 2 : 0;
  let data: unknown = card;

  switch (format) {
    case "tavern_v2":
      data = card;
      break;
    case "janitor_ai":
      data = tavernToJanitor(card);
      break;
    case "rpbuddy":
      data = tavernToRPBuddy(card);
      break;
    case "agnai":
      data = tavernToAgnai(card);
      break;
    case "generic":
      data = tavernToGeneric(card);
      break;
  }

  return JSON.stringify(data, null, indent);
}

export function downloadJson(
  card: TavernCardV2,
  format: ExportFormat,
  settings: AppSettings,
  filename: string
): void {
  const json = serializeCard(card, format, settings);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.replace(/\.png$/, "") + ".json";
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadPng(pngBytes: Uint8Array, filename: string): void {
  const blob = new Blob([pngBytes.buffer as ArrayBuffer], { type: "image/png" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".png") ? filename : filename + ".png";
  a.click();
  URL.revokeObjectURL(url);
}
