import { useSyncExternalStore } from "react";
import { isTokenizerReady, subscribeTokenizer } from "../lib/tokenizer";

/**
 * Re-renders once the real tokenizer has loaded.
 *
 * Counts start as a character-based approximation while the BPE table is
 * fetched; without this the badges would keep showing the estimate until the
 * next keystroke.
 *
 * @returns whether the displayed counts are exact.
 */
export function useTokenizer(): boolean {
  return useSyncExternalStore(subscribeTokenizer, isTokenizerReady, isTokenizerReady);
}
