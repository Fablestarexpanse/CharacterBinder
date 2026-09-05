import { useSyncExternalStore } from "react";
import { getSorterSettings, subscribeSorterSettings, type SorterSettings } from "../lib/cardTextSorter/settings";

/**
 * Live view of the AI sorter settings, the same way useBridgeState and
 * useEngineState consume their stores.
 *
 * These settings are edited in the Quick Import panel and also read by the
 * sidebar light. One consumer subscribed and the other kept a snapshot taken at
 * mount, which was correct only while the subscriber was the sole writer — the
 * kind of arrangement that stops being true without anyone noticing.
 */
export function useSorterSettings(): SorterSettings {
  return useSyncExternalStore(subscribeSorterSettings, getSorterSettings, getSorterSettings);
}
