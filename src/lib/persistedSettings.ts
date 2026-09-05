/**
 * One contract for settings kept in localStorage.
 *
 * There were three, one per module: `loadStoredSettings()` returning the whole
 * object and `saveSettings(whole)` replacing it; `getSorterSettings()` with
 * `saveSorterSettings(patch)` returning the merged result and notifying
 * subscribers; and bare `getBridgeToken`/`setBridgeToken` string accessors.
 * Three read verbs and three write contracts for the same job meant every
 * caller had to remember which one it was talking to, and only one of the three
 * notified anything when a value changed.
 *
 * A store here always merges over its defaults on read (so a key added in a
 * later version picks up its default rather than arriving undefined), takes a
 * patch on write, and notifies subscribers.
 */

export interface PersistedSettings<T extends object> {
  /** Stored values merged over the defaults. Never throws. */
  get: () => T;
  /** Merge a patch, persist it, notify subscribers, and return the result. */
  save: (patch: Partial<T>) => T;
  /** Called after every save. Returns an unsubscribe function. */
  subscribe: (fn: (value: T) => void) => () => void;
}

export function createPersistedSettings<T extends object>(
  key: string,
  defaults: T
): PersistedSettings<T> {
  const listeners = new Set<(value: T) => void>();

  // Reads are guarded because localStorage throws outright in a browser set to
  // block site data, and the stored JSON can be anything if a user or another
  // tool has edited it.
  const get = (): T => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return { ...defaults };
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { ...defaults };
      return { ...defaults, ...(parsed as Partial<T>) };
    } catch {
      return { ...defaults };
    }
  };

  const save = (patch: Partial<T>): T => {
    const next = { ...get(), ...patch };
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // Out of quota or storage blocked: the value still applies for this
      // session, it just will not survive a reload.
    }
    for (const fn of listeners) fn(next);
    return next;
  };

  const subscribe = (fn: (value: T) => void) => {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  };

  return { get, save, subscribe };
}
