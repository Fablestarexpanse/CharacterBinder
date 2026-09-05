/**
 * A module-level observable: one value, a patch-based setter, and subscribers.
 *
 * The bridge's connection state and the AI engine's load state are both a
 * single object that the UI watches through useSyncExternalStore, and both had
 * hand-written the same fifteen lines. The snapshot is replaced rather than
 * mutated, because useSyncExternalStore compares by identity.
 *
 * For a value that also has to survive a reload, use createPersistedSettings.
 */
export interface Observable<T> {
  get: () => T;
  /** Merge a patch into the current value and notify every subscriber. */
  set: (patch: Partial<T>) => void;
  subscribe: (fn: (value: T) => void) => () => void;
}

export function createObservable<T extends object>(initial: T): Observable<T> {
  let value = initial;
  const listeners = new Set<(value: T) => void>();

  return {
    get: () => value,
    set: (patch) => {
      value = { ...value, ...patch };
      for (const fn of listeners) fn(value);
    },
    subscribe: (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
  };
}
