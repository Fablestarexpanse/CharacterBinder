import { useEffect } from "react";

/**
 * Warns before the tab closes while there is unsaved editor content.
 *
 * The card library is IndexedDB, but whatever is in an editor is plain React
 * state until you hit Save to Library or export — so closing the tab threw it
 * away with no prompt at all.
 *
 * Browsers only honour this if the user has interacted with the page, and they
 * show their own generic wording rather than ours, so the message is advisory.
 */
export function useUnsavedWarning(hasUnsavedWork: boolean) {
  useEffect(() => {
    if (!hasUnsavedWork) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Legacy browsers keyed off a returned string; harmless to set both.
      e.returnValue = "";
      return "";
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedWork]);
}
