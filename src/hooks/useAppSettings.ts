import { useSyncExternalStore } from "react";
import { getAppSettings, subscribeAppSettings } from "../lib/settings";
import type { AppSettings } from "../types";

/** Live view of the app settings, the same way the other stores are consumed. */
export function useAppSettings(): AppSettings {
  return useSyncExternalStore(subscribeAppSettings, getAppSettings, getAppSettings);
}
