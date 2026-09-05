import type { AppSettings } from "../types";
import { createPersistedSettings } from "./persistedSettings";

export const DEFAULT_SETTINGS: AppSettings = {
  autoValidateBeforeExport: true,
  preserveUnknownChunks: true,
  prettyPrintJson: true,
};

const store = createPersistedSettings("cb_settings_v1", DEFAULT_SETTINGS);

// Cached and replaced only on a save: useSyncExternalStore compares snapshots
// by identity, so a fresh object per read would re-render forever.
let snapshot: AppSettings = store.get();
store.subscribe((next) => {
  snapshot = next;
});

/** Stored settings merged over the defaults, so a new key picks up its default. */
export function getAppSettings(): AppSettings {
  return snapshot;
}
/** Merge a patch into the stored settings and return the result. */
export const saveAppSettings = store.save;
export const subscribeAppSettings = store.subscribe;
