/*
 * Photos and PDF documents in IndexedDB (database `ldb-photos`, object store
 * `p`, key = photo id, value = data URL), as in legacy.
 */

/** Photo moments of an outing: context → label (legacy `PHOTO_CTX`). */
export const PHOTO_CTX: Readonly<Record<string, string>> = {
  dep: '📷 Prise du bateau',
  nav: '📷 En navigation',
  quit: '📷 Fin de sortie',
};

/** A stored photo or document: a data URL (legacy) or a Blob. */
type PhotoData = string | Blob;

let photoDb: Promise<IDBDatabase> | null = null;

function photoStore(mode: IDBTransactionMode): Promise<IDBObjectStore> {
  photoDb ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('ldb-photos', 1);
    request.addEventListener('upgradeneeded', () =>
      request.result.createObjectStore('p'),
    );
    request.addEventListener('success', () => resolve(request.result));
    request.addEventListener('error', () =>
      reject(request.error ?? new Error('IndexedDB unavailable')),
    );
  });
  return photoDb.then((database) =>
    database.transaction('p', mode).objectStore('p'),
  );
}

function idbRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result));
    request.addEventListener('error', () =>
      reject(request.error ?? new Error('IndexedDB request failed')),
    );
  });
}

/**
 * Store a photo or document (legacy `putPhoto`). Rejects when IndexedDB fails
 * (callers show « Photo impossible à enregistrer »).
 * @param id - Photo id.
 * @param value - Data URL (or Blob).
 * @returns The stored key.
 */
export async function putPhoto(
  id: string,
  value: PhotoData,
): Promise<IDBValidKey> {
  const store = await photoStore('readwrite');
  return idbRequest(store.put(value, id));
}

/**
 * Read a photo or document (legacy `getPhoto`).
 * @param id - Photo id.
 * @returns The value, `undefined` when absent, `null` when IndexedDB fails.
 */
export async function getPhoto(
  id: string,
): Promise<PhotoData | undefined | null> {
  try {
    const store = await photoStore('readonly');
    return await idbRequest<PhotoData | undefined>(store.get(id));
  } catch {
    return null;
  }
}

/**
 * Delete a photo or document (legacy `delPhoto`); never rejects.
 * @param id - Photo id.
 * @returns Resolves when done.
 */
export async function delPhoto(id: string): Promise<void> {
  try {
    const store = await photoStore('readwrite');
    await idbRequest(store.delete(id));
  } catch {
    // IndexedDB unavailable: nothing to delete.
  }
}

/**
 * Reduce a picture to 1280 px at most, as a JPEG data URL of quality 0.7
 * (legacy `shrinkPhoto`, browser only).
 * @param file - Image file or blob.
 * @returns The data URL.
 */
export async function shrinkPhoto(file: Blob): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    const scale = Math.min(1, 1280 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    canvas
      .getContext('2d')
      ?.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.7);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => {
      resolve(image);
    });
    image.addEventListener('error', () => {
      reject(new Error('Unreadable image'));
    });
    image.src = url;
  });
}
