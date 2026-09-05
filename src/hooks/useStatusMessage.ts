import { useState, useRef, useEffect, useCallback } from "react";

export interface StatusMessage {
  msg: string;
  ok: boolean;
}

/**
 * A status banner for a panel.
 *
 * A success clears itself after `delay` — it is confirmation, and confirmation
 * that lingers becomes furniture. A failure stays until it is replaced or
 * cleared: it is something the user has to read, and panels that auto-cleared
 * their errors could hide the reason a save or an import did not work before
 * anyone saw it.
 */
export function useStatusMessage(delay = 3000) {
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelTimer = () => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  useEffect(() => cancelTimer, []);

  // Stable identity so callers can safely list it in useCallback/useMemo deps.
  const setMsg = useCallback((msg: string, ok: boolean) => {
    cancelTimer();
    setStatus({ msg, ok });
    if (!ok) return;
    timerRef.current = setTimeout(() => {
      setStatus(null);
      timerRef.current = null;
    }, delay);
  }, [delay]);

  /** Drop the current message, e.g. when the panel starts a fresh attempt. */
  const clearMsg = useCallback(() => {
    cancelTimer();
    setStatus(null);
  }, []);

  return { status, setMsg, clearMsg };
}
