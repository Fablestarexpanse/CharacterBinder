import { useSyncExternalStore } from "react";
import { getEngineState, subscribeEngineState, type EngineState } from "../lib/cardTextSorter/engine";

/**
 * Live view of the AI sorter's engine. Kept in the module rather than component
 * state because the model can be loaded from the import panel or the sidebar
 * light, and both need to show the same thing.
 */
export function useEngineState(): EngineState {
  return useSyncExternalStore(subscribeEngineState, getEngineState, getEngineState);
}
