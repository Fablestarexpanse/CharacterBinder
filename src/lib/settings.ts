import type { AppSettings } from "../types";
import { createPersistedSettings } from "./persistedSettings";

export const DEFAULT_SETTINGS: AppSettings = {
  autoValidateBeforeExport: true,
  preserveUnknownChunks: true,
  prettyPrintJson: true,
};

const store = createPersistedSettings("cb_settings_v1", DEFAULT_SETTINGS);

/** Stored settings merged over the defaults, so a new key picks up its default. */
export const getAppSettings = store.get;
/** Merge a patch into the stored settings and return the result. */
export const saveAppSettings = store.save;
export const subscribeAppSettings = store.subscribe;
