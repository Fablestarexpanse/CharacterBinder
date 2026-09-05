import { useSyncExternalStore } from "react";
import { getSorterSettings, subscribeSorterSettings, type SorterSettings } from "../lib/cardTextSorter/settings";

/**
 * Live view of the AI sorter settings, the same way useBridgeState and
 * useEngineState consume their stores.
 *
 * A subscription rather than a snapshot, because these settings are edited in
 * the Quick Import panel and read by the sidebar light at the same time.
 *
 * @returns the current settings, re-rendering the caller when they are saved.
 */
export function useSorterSettings(): SorterSettings {
  return useSyncExternalStore(subscribeSorterSettings, getSorterSettings, getSorterSettings);
}
