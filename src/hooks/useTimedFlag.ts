import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A boolean that turns itself back off — the "Copied!" / "Saved!" pattern.
 *
 * Written once here because the hand-rolled versions all shared the same two
 * faults: the timer was never cleared on unmount (so React warned about a state
 * update on an unmounted component if you navigated away within the window),
 * and firing twice in quick succession left the first timer running, so the
 * flag could clear early.
 */
export function useTimedFlag(duration = 1500): [boolean, () => void] {
  const [on, setOn] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  const trigger = useCallback(() => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    setOn(true);
    timerRef.current = setTimeout(() => {
      setOn(false);
      timerRef.current = null;
    }, duration);
  }, [duration]);

  return [on, trigger];
}
