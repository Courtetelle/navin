import { uid } from '../../lib/format.ts';
import type { VoyageDoc } from '../../model/voyages.ts';
import { docCategoryOf } from '../../model/voyages.ts';
import { deliver, state, toast, updateVoyages } from '../../state/index.ts';
import { delPhoto, getPhoto, putPhoto } from '../../storage/photos.ts';

import { fileStem } from './voyageShare.ts';

/** Photos are kept up to this size, sharp enough to read a contract. */
const PHOTO_MAX_PX = 2200;

/**
 * Read a file as a data URL (it then goes into the backups as text).
 * @param file - The file.
 * @returns The data URL.
 */
function dataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () =>
      resolve(typeof reader.result === 'string' ? reader.result : ''),
    );
    reader.addEventListener('error', () =>
      reject(reader.error ?? new Error('Unreadable file')),
    );
    reader.readAsDataURL(file);
  });
}

/**
 * A photo reduced to {@link PHOTO_MAX_PX}, as a JPEG; the file itself when it
 * cannot be drawn.
 * @param file - The image.
 * @returns The data URL.
 */
async function photoUrl(file: Blob): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.addEventListener('load', () => resolve(element));
      element.addEventListener('error', () =>
        reject(new Error('Unreadable image')),
      );
      element.src = url;
    });
    const scale = Math.min(
      1,
      PHOTO_MAX_PX / Math.max(image.width, image.height),
    );
    if (scale === 1 && file.type === 'image/jpeg') return await dataUrl(file);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    canvas
      .getContext('2d')
      ?.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85);
  } catch {
    return await dataUrl(file);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * The title proposed for an imported file: its name without extension.
 * @param name - File name.
 * @returns The title.
 */
export function titleFromName(name: string): string {
  return name
    .replace(/\.[a-z0-9]{2,5}$/iu, '')
    .replaceAll(/[_]+/gu, ' ')
    .trim();
}

/**
 * Keep an imported PDF or photo with its category and title.
 * @param file - The file chosen.
 * @param cat - Its category.
 * @param title - Its title.
 * @returns True when kept.
 */
export async function importVoyageDoc(
  file: File,
  cat: string,
  title: string,
): Promise<boolean> {
  const image = file.type.startsWith('image/');
  try {
    const url = image ? await photoUrl(file) : await dataUrl(file);
    const id = `voy-${uid()}`;
    await putPhoto(id, url);
    const doc: VoyageDoc = {
      id,
      cat,
      title: title.trim() || titleFromName(file.name) || 'Document',
      name: file.name,
      type: image ? 'image/jpeg' : file.type || 'application/pdf',
      at: new Date().toISOString(),
    };
    updateVoyages((voyages) => {
      voyages.docs.push(doc);
    });
    toast('Document gardé dans l’appli');
    return true;
  } catch {
    toast('Document impossible à enregistrer : mémoire pleine ?');
    return false;
  }
}

/**
 * A data URL back to its bytes.
 * @param url - The data URL.
 * @returns The blob.
 */
async function dataBlob(url: string): Promise<Blob> {
  const reply = await fetch(url);
  return reply.blob();
}

/**
 * The stored content of a document as a file.
 * @param doc - The document.
 * @returns The file, or null when it is not on this device.
 */
export async function voyageFile(doc: VoyageDoc): Promise<File | null> {
  const stored = await getPhoto(doc.id);
  if (!stored) return null;
  const blob = typeof stored === 'string' ? await dataBlob(stored) : stored;
  const pdf = doc.type === 'application/pdf';
  let extension = 'jpg';
  if (pdf) {
    extension = 'pdf';
  } else if (!doc.type.startsWith('image/')) {
    extension = doc.name.split('.').pop() ?? 'bin';
  }
  return new File([blob], `${fileStem(doc.title)}.${extension}`, {
    type: doc.type || blob.type,
  });
}

/**
 * Open a document in a new tab.
 * @param doc - The document.
 */
export async function openVoyageDoc(doc: VoyageDoc): Promise<void> {
  const file = await voyageFile(doc);
  if (!file) {
    toast('Fichier absent de cet appareil');
    return;
  }
  const url = URL.createObjectURL(file);
  const opened = globalThis.open(url, '_blank');
  if (!opened) globalThis.location.href = url;
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Share one document (WhatsApp, mail…) or save it.
 * @param doc - The document.
 */
export async function shareVoyageDoc(doc: VoyageDoc): Promise<void> {
  const file = await voyageFile(doc);
  if (!file) {
    toast('Fichier absent de cet appareil');
    return;
  }
  await deliver(file, file.name, file.type);
}

/**
 * Share several documents at once, when the device can; one by one otherwise.
 * @param docs - The documents.
 * @param title - Title of the share.
 */
export async function shareVoyageDocs(
  docs: readonly VoyageDoc[],
  title: string,
): Promise<void> {
  if (docs.length === 0) {
    toast('Aucun document');
    return;
  }
  const files: File[] = [];
  /* eslint-disable no-await-in-loop -- one file in memory after the other */
  for (const doc of docs) {
    const file = await voyageFile(doc);
    if (file) files.push(file);
  }
  /* eslint-enable no-await-in-loop */
  if (files.length > 1 && navigator.canShare?.({ files })) {
    try {
      await navigator.share({ files, title });
      return;
    } catch (error) {
      if ((error as Error).name === 'AbortError') return;
    }
  }
  /* eslint-disable no-await-in-loop -- the saver takes one file at a time */
  for (const file of files) await deliver(file, file.name, file.type);
  /* eslint-enable no-await-in-loop */
}

/**
 * Remove a document and its file.
 * @param id - Document id.
 */
export function removeVoyageDoc(id: string): void {
  updateVoyages((voyages) => {
    voyages.docs = voyages.docs.filter((doc) => doc.id !== id);
  });
  void delPhoto(id);
}

/**
 * Change the title or the category of a document.
 * @param id - Document id.
 * @param patch - What changes.
 */
export function editVoyageDoc(
  id: string,
  patch: Partial<Pick<VoyageDoc, 'title' | 'cat'>>,
): void {
  updateVoyages((voyages) => {
    const doc = voyages.docs.find((item) => item.id === id);
    if (!doc) return;
    if (patch.title !== undefined) doc.title = patch.title;
    if (patch.cat !== undefined) doc.cat = patch.cat;
  });
}

/**
 * The documents of a category, oldest first.
 * @param cat - Category id.
 * @returns The documents.
 */
export function docsOf(cat: string): VoyageDoc[] {
  const voyages = state.data.voyages.value;
  return voyages.docs.filter((doc) => docCategoryOf(voyages, doc) === cat);
}
