/**
 * The three localStorage-backed stores together: app settings, sorter settings
 * and custom templates. They share one contract, and the cases that matter are
 * mostly about how they behave when storage misbehaves, so they read better
 * side by side than in three files repeating the same stub.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
});

let settings: typeof import("./settings");
let sorter: typeof import("./cardTextSorter/settings");
let templates: typeof import("./customTemplates");

beforeEach(async () => {
  store.clear();
  vi.resetModules();
  settings = await import("./settings");
  sorter = await import("./cardTextSorter/settings");
  templates = await import("./customTemplates");
});

describe("app settings", () => {
  it("starts from the defaults", () => {
    expect(settings.getAppSettings()).toEqual(settings.DEFAULT_SETTINGS);
  });

  it("keeps a saved change and leaves the rest at their defaults", () => {
    settings.saveAppSettings({ prettyPrintJson: false });
    expect(settings.getAppSettings()).toEqual({ ...settings.DEFAULT_SETTINGS, prettyPrintJson: false });
  });
});

describe("sorter settings", () => {
  it("reads an unrecognised backend back to the in-browser one", () => {
    store.set("cb_sorter_settings", JSON.stringify({ backend: "carrier pigeon" }));
    // Anything but "endpoint" must land on webllm; falling through to the
    // WebLLM branch by accident would start a multi-gigabyte download.
    expect(sorter.getSorterSettings().backend).toBe("webllm");
  });

  it("keeps the endpoint backend when that is what is stored", () => {
    sorter.saveSorterSettings({ backend: "endpoint" });
    expect(sorter.getSorterSettings().backend).toBe("endpoint");
  });

  it("notifies subscribers so the sidebar light cannot go stale", () => {
    const seen: string[] = [];
    sorter.subscribeSorterSettings((s) => seen.push(s.backend));
    sorter.saveSorterSettings({ backend: "endpoint" });
    expect(seen).toEqual(["endpoint"]);
  });

  it("treats only true as an acknowledgement of sending text off-machine", () => {
    store.set("cb_sorter_settings", JSON.stringify({ remoteAcknowledged: "yes" }));
    expect(sorter.getSorterSettings().remoteAcknowledged).toBe(false);
  });
});

describe("isRemoteUrl", () => {
  it("treats this machine's own addresses as local", async () => {
    for (const url of [
      "http://localhost:11434/v1",
      "http://127.0.0.1:11434/v1",
      "http://[::1]:11434/v1",
      "http://ollama.localhost/v1",
    ]) {
      expect(sorter.isRemoteUrl(url)).toBe(false);
    }
  });

  it("treats anything else, including an unparseable URL, as remote", () => {
    expect(sorter.isRemoteUrl("https://api.openai.com/v1")).toBe(true);
    expect(sorter.isRemoteUrl("http://192.168.1.20:11434/v1")).toBe(true);
    // Unparseable is treated as remote: the safer assumption of the two.
    expect(sorter.isRemoteUrl("not a url")).toBe(true);
  });
});

describe("custom templates", () => {
  it("saves a template and reads it back", () => {
    const card = { spec: "chara_card_v2", spec_version: "2.0", data: { name: "Rook", description: "A dockhand." } };
    const saved = templates.saveCustomTemplate(card as never);

    expect(saved.name).toBe("Rook");
    expect(templates.getCustomTemplates().map((t) => t.id)).toEqual([saved.id]);
  });

  it("deletes only the template asked for", () => {
    const card = (name: string) => ({ spec: "chara_card_v2", spec_version: "2.0", data: { name, description: "d" } });
    const keep = templates.saveCustomTemplate(card("Keep") as never);
    const drop = templates.saveCustomTemplate(card("Drop") as never);

    templates.deleteCustomTemplate(drop.id);
    expect(templates.getCustomTemplates().map((t) => t.id)).toEqual([keep.id]);
  });

  it("ignores stored junk rather than taking the Templates page down", () => {
    store.set("cb_custom_templates", JSON.stringify({ not: "an array" }));
    expect(templates.getCustomTemplates()).toEqual([]);

    store.set("cb_custom_templates", JSON.stringify([{ id: "ok", card: {} }, { junk: true }, null]));
    expect(templates.getCustomTemplates().map((t) => t.id)).toEqual(["ok"]);
  });

  it("says so when the browser refuses to store a template", () => {
    const setItem = localStorage.setItem;
    vi.spyOn(localStorage, "setItem").mockImplementation(() => { throw new Error("QuotaExceededError"); });
    try {
      expect(() => templates.saveCustomTemplate({ data: { name: "X", description: "" } } as never)).toThrow(/storage/i);
    } finally {
      vi.mocked(localStorage.setItem).mockImplementation(setItem);
    }
  });
});
