import { useState, useRef, useEffect } from "react";

export interface StatusMessage {
  msg: string;
  ok: boolean;
}

/**
 * Provides a timed status banner that clears itself after `delay` ms.
 * Cleans up the pending timer on unmount so there's no stale-state warning.
 */
export function useStatusMessage(delay = 3000) {
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  function setMsg(msg: string, ok: boolean) {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    setStatus({ msg, ok });
    timerRef.current = setTimeout(() => {
      setStatus(null);
      timerRef.current = null;
    }, delay);
  }

  return { status, setMsg };
}
