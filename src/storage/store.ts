/** A plain JSON object read from storage. */
type StoredObject = Record<string, unknown>;

/** Called when a write fails (quota exceeded, storage blocked). */
type StoreFullHandler = (message: string) => void;

/** Message shown when localStorage refuses a write. */
export const STORE_FULL_MESSAGE =
  '⚠ Mémoire pleine : exportez puis supprimez une ancienne croisière';

let backend: Storage | null | undefined;
let fullHandler: StoreFullHandler | null = null;

/**
 * Replace the storage backend (an in-memory `Storage` in tests, `null` to
 * simulate a blocked storage). Without a call, `globalThis.localStorage` is used.
 * @param storage - The storage to use, or `undefined` to go back to localStorage.
 */
export function setStorageBackend(storage: Storage | null | undefined): void {
  backend = storage;
}

/**
 * Register the function called when a write fails (the state layer plugs its toast here).
 * @param handler - Receives the "memory full" message.
 */
export function setStoreFullHandler(handler: StoreFullHandler | null): void {
  fullHandler = handler;
}

/**
 * The active storage backend.
 * @returns The storage, or throws when none is available (callers catch).
 */
export function storage(): Storage {
  if (backend === null) throw new Error('storage unavailable');
  if (backend) return backend;
  return globalThis.localStorage;
}

/**
 * The `ldb.*` localStorage layer: reads never throw (a damaged value gives the
 * fallback), writes report a full memory through the registered handler.
 */
export const store = {
  /**
   * Read and parse a JSON value.
   * @param key - Storage key.
   * @param fallback - Returned when the key is absent or unreadable.
   * @returns The parsed value or the fallback.
   */
  get<T>(key: string, fallback: T): T {
    try {
      const value = storage().getItem(key);
      return value === null ? fallback : (JSON.parse(value) as T);
    } catch {
      return fallback;
    }
  },
  /**
   * Write a value as JSON.
   * @param key - Storage key.
   * @param value - Any JSON-serializable value.
   * @returns `true` when written, `false` when the storage refused it.
   */
  set(key: string, value: unknown): boolean {
    try {
      storage().setItem(key, JSON.stringify(value));
      return true;
    } catch {
      fullHandler?.(STORE_FULL_MESSAGE);
      return false;
    }
  },
  /**
   * Remove a key, silently.
   * @param key - Storage key.
   */
  del(key: string): void {
    try {
      storage().removeItem(key);
    } catch {
      // Storage blocked: nothing to remove.
    }
  },
  /**
   * Read a list that is always an array of plain objects, whatever is stored.
   * @param key - Storage key.
   * @param fix - Optional normalizer applied to each item; its errors are ignored.
   * @returns The objects of the stored array (others dropped).
   */
  arr<T extends object = StoredObject>(
    key: string,
    fix?: (item: T) => T | undefined | void,
  ): T[] {
    const value = store.get<unknown>(key, []);
    const list: T[] = [];
    if (!Array.isArray(value)) return list;
    for (const item of value as unknown[]) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
      const object = item as T;
      if (!fix) {
        list.push(object);
        continue;
      }
      try {
        list.push(fix(object) || object);
      } catch {
        list.push(object);
      }
    }
    return list;
  },
  /**
   * Read a raw string (no JSON parsing), like `localStorage.getItem`.
   * @param key - Storage key.
   * @returns The string, or `null` when absent or unreadable.
   */
  raw(key: string): string | null {
    try {
      return storage().getItem(key);
    } catch {
      return null;
    }
  },
  /**
   * Write a raw string silently (no JSON, no "memory full" alert).
   * @param key - Storage key.
   * @param value - The string to store.
   * @returns `true` when written.
   */
  setRaw(key: string, value: string): boolean {
    try {
      storage().setItem(key, value);
      return true;
    } catch {
      return false;
    }
  },
  /**
   * List every key currently in storage.
   * @returns The keys, in storage order (empty when unavailable).
   */
  keys(): string[] {
    try {
      const all = storage();
      const keys: string[] = [];
      for (let position = 0; position < all.length; position++) {
        const key = all.key(position);
        if (key !== null) keys.push(key);
      }
      return keys;
    } catch {
      return [];
    }
  },
};
