/**
 * Read a record of an object store.
 * @param objectStore - The store.
 * @param key - Record key.
 * @returns The record, or `null` when absent or unreadable.
 */
export function readRecord<T>(
  objectStore: IDBObjectStore,
  key: string,
): Promise<T | null> {
  return new Promise((resolve) => {
    const request = objectStore.get(key);
    request.addEventListener('success', () =>
      resolve((request.result as T | undefined) ?? null),
    );
    request.addEventListener('error', () => resolve(null));
  });
}

/**
 * Write a record of an object store.
 * @param objectStore - The store.
 * @param key - Record key.
 * @param record - The value.
 * @returns Resolves once written.
 */
export function writeRecord(
  objectStore: IDBObjectStore,
  key: string,
  record: unknown,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = objectStore.put(record, key);
    request.addEventListener('success', () => resolve());
    request.addEventListener('error', () =>
      reject(request.error ?? new Error(key)),
    );
  });
}
