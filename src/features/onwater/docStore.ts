/** A document kept in the app (database `ldb-docs`, store `d`). */
export interface StoredDocument {
  /** File name. */
  name: string;
  /** Media type. */
  type: string;
  blob: Blob;
  /** ISO time. */
  at: string;
}

let database: Promise<IDBDatabase> | null = null;

/**
 * Object store of the documents, also used for the map data (legacy `docStore`).
 * @param mode - Transaction mode.
 * @returns The store.
 */
export function docStore(mode: IDBTransactionMode): Promise<IDBObjectStore> {
  database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('ldb-docs', 1);
    request.addEventListener('upgradeneeded', () =>
      request.result.createObjectStore('d'),
    );
    request.addEventListener('success', () => resolve(request.result));
    request.addEventListener('error', () =>
      reject(request.error ?? new Error('IndexedDB unavailable')),
    );
  });
  return database.then((opened) =>
    opened.transaction('d', mode).objectStore('d'),
  );
}

/**
 * Keep a document (legacy `putDoc`).
 * @param id - Document id.
 * @param document - The document.
 */
export async function putDoc(
  id: string,
  document: StoredDocument,
): Promise<void> {
  const store = await docStore('readwrite');
  await request(store.put(document, id));
}

/**
 * Read a document (legacy `getDoc`).
 * @param id - Document id.
 * @returns The document, null when absent or unreadable.
 */
export async function getDoc(id: string): Promise<StoredDocument | null> {
  try {
    const store = await docStore('readonly');
    return (
      ((await request(store.get(id))) as StoredDocument | undefined) ?? null
    );
  } catch {
    return null;
  }
}

/**
 * Remove a document (legacy `delDoc`).
 * @param id - Document id.
 */
export async function delDoc(id: string): Promise<void> {
  try {
    const store = await docStore('readwrite');
    await request(store.delete(id));
  } catch {
    // Nothing to remove.
  }
}

/**
 * Open a kept document in a new tab (legacy `openDocBlob`).
 * @param document - The document.
 */
export function openDocBlob(document: StoredDocument): void {
  const url = URL.createObjectURL(document.blob);
  const opened = globalThis.open(url, '_blank');
  if (!opened) globalThis.location.href = url;
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function request<T>(pending: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    pending.addEventListener('success', () => resolve(pending.result));
    pending.addEventListener('error', () =>
      reject(pending.error ?? new Error('IndexedDB request failed')),
    );
  });
}
