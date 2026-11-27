/*
 * Photos and PDF documents in IndexedDB (database `ldb-photos`, object store
 * `p`, key = photo id, value = data URL), as in legacy.
 */

import { store } from './store.ts';

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
  const db = await photoStore('readwrite');
  const key = await idbRequest(db.put(value, id));
  keepPhotos([id]);
  return key;
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
    const db = await photoStore('readonly');
    return await idbRequest<PhotoData | undefined>(db.get(id));
  } catch {
    return null;
  }
}

/** Photos deleted, kept this long for the Poubelle, then freed. */
export const PHOTO_BIN_MS = 30 * 24 * 3600 * 1000;
const BIN_KEY = 'ldb.photoBin';

/**
 * Delete a photo or document; never rejects. It stays 30 days in the bin, so
 * that a record taken back from the Poubelle finds its photos again.
 * @param id - Photo id.
 * @returns Resolves when done.
 */
export function delPhoto(id: string): Promise<void> {
  if (!id.startsWith(TRASH_PREFIX)) {
    store.set(BIN_KEY, {
      ...store.get<Record<string, number>>(BIN_KEY, {}),
      [id]: Date.now(),
    });
  }
  return Promise.resolve();
}

/**
 * Photos taken back from the bin (a record restored): kept again.
 * @param ids - Their ids.
 */
export function keepPhotos(ids: Iterable<string>): void {
  const bin = { ...store.get<Record<string, number>>(BIN_KEY, {}) };
  let changed = false;
  for (const id of ids) {
    if (id in bin) {
      Reflect.deleteProperty(bin, id);
      changed = true;
    }
  }
  if (changed) store.set(BIN_KEY, bin);
}

/**
 * The ids in the bin, to know which ones a restored record holds.
 * @returns The ids.
 */
export function binnedPhotos(): string[] {
  return Object.keys(store.get<Record<string, number>>(BIN_KEY, {}));
}

/**
 * Free the photos deleted more than 30 days ago.
 * @param now - Current time.
 * @returns When done.
 */
export async function emptyPhotoBin(now = Date.now()): Promise<void> {
  const bin = { ...store.get<Record<string, number>>(BIN_KEY, {}) };
  const old = Object.entries(bin).filter(([, at]) => now - at > PHOTO_BIN_MS);
  if (old.length === 0) return;
  /* eslint-disable no-await-in-loop -- one IndexedDB delete at a time */
  for (const [id] of old) {
    await dropPhoto(id);
    Reflect.deleteProperty(bin, id);
  }
  /* eslint-enable no-await-in-loop */
  store.set(BIN_KEY, bin);
}

/** Records of the Poubelle are kept in the photo database under this prefix. */
export const TRASH_PREFIX = 'trash:';

/**
 * Delete at once from IndexedDB; never rejects.
 * @param id - Photo id.
 * @returns Resolves when done.
 */
export async function dropPhoto(id: string): Promise<void> {
  try {
    const db = await photoStore('readwrite');
    await idbRequest(db.delete(id));
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
