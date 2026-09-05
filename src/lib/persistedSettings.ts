/**
 * One contract for every setting kept in localStorage: reads merge over the
 * defaults, so a key added in a later version arrives with its default rather
 * than undefined; writes take a patch and notify subscribers.
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

/**
 * A getter that returns the same object until the store changes.
 *
 * useSyncExternalStore compares snapshots by identity, so a getter that read
 * and rebuilt the value per call would re-render forever. The first call does
 * the read and registers the listener — doing either at import time would make
 * importing the module a storage access, and would leave freshness resting on
 * this module's listener happening to be registered before the first save.
 *
 * @param read builds the snapshot; called once up front and again after every
 *   save, so it is the place to normalise what came out of storage.
 */
export function cachedSnapshot<T>(
  store: { subscribe: (fn: (value: T) => void) => () => void },
  read: () => T
): () => T {
  let snapshot: T | null = null;
  return () => {
    if (snapshot === null) {
      snapshot = read();
      store.subscribe(() => {
        snapshot = read();
      });
    }
    return snapshot;
  };
}
