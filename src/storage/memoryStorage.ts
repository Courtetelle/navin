/** Options of {@link createMemoryStorage}. */
export interface MemoryStorageOptions {
  /**
   * Maximum total size (sum of key and value lengths); a write beyond it throws like a full localStorage.
   * @default Infinity
   */
  quota?: number;
}

/**
 * An in-memory `Storage` (localStorage stand-in for tests and node scripts).
 * @param seed - Initial content: key → value (strings stored as-is, anything else JSON-stringified).
 * @param options - Size limit.
 * @returns A Storage implementation.
 */
export function createMemoryStorage(
  seed: Record<string, unknown> = {},
  options: MemoryStorageOptions = {},
): Storage {
  const quota = options.quota ?? Number.POSITIVE_INFINITY;
  const map = new Map<string, string>();
  for (const [key, value] of Object.entries(seed)) {
    map.set(key, typeof value === 'string' ? value : JSON.stringify(value));
  }
  const size = () => {
    let total = 0;
    for (const [key, value] of map) total += key.length + value.length;
    return total;
  };
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.get(key) ?? null;
    },
    key(position: number) {
      return [...map.keys()][position] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      const previous = map.get(key);
      const next =
        size() - (previous === undefined ? 0 : key.length + previous.length);
      if (next + key.length + value.length > quota) {
        throw new DOMException('quota exceeded', 'QuotaExceededError');
      }
      map.set(key, value);
    },
  };
}
