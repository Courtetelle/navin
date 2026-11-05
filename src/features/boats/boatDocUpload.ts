import { uid } from '../../lib/format.ts';
import { toast, updateBoat } from '../../state/index.ts';
import { getPhoto, putPhoto, shrinkPhoto } from '../../storage/photos.ts';

import type { BoatDocument } from './boatDocs.ts';

/**
 * Ask for photos or PDF scans and keep them with the boat (legacy `addBoatDoc`).
 * @param id - Boat id.
 * @param kind - Document kind.
 * @param done - Runs once the documents are saved.
 */
export function addBoatDoc(id: string, kind: string, done: () => void): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*,application/pdf';
  input.multiple = true;
  input.addEventListener('change', () => {
    void storeFiles(id, kind, [...(input.files ?? [])]).then((count) => {
      if (count > 0) done();
    });
  });
  input.click();
}

/* eslint-disable no-await-in-loop -- one file at a time: each is checked in the store before the next */
async function storeFiles(
  id: string,
  kind: string,
  files: readonly File[],
): Promise<number> {
  const added: BoatDocument[] = [];
  void navigator.storage?.persist?.().catch(() => undefined);
  for (const file of files) {
    try {
      added.push(await storeFile(kind, file));
    } catch {
      toast('Fichier impossible à enregistrer');
    }
  }
  if (added.length === 0) return 0;
  updateBoat(id, (boat) => {
    boat.docs = [
      ...((boat.docs as BoatDocument[] | undefined) ?? []),
      ...added,
    ];
  });
  toast(
    added.length > 1
      ? `✓ ${added.length} documents enregistrés dans l’appli`
      : '✓ Enregistré dans l’appli · écrivez son libellé',
  );
  return added.length;
}
/* eslint-enable no-await-in-loop */

async function storeFile(kind: string, file: File): Promise<BoatDocument> {
  const documentId = uid();
  const pdf =
    file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
  const data = pdf ? await readDataUrl(file) : await shrinkPhoto(file);
  await putPhoto(documentId, data);
  if (!(await getPhoto(documentId))) throw new Error('not saved');
  const added: BoatDocument = {
    id: documentId,
    kind,
    t: new Date().toISOString(),
  };
  if (pdf) {
    added.pdf = true;
    const caption = (file.name || '').replace(/\.pdf$/i, '');
    if (caption) added.cap = caption;
  }
  return added;
}

function readDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(reader.result as string));
    reader.addEventListener('error', () => reject(new Error('read')));
    reader.readAsDataURL(file);
  });
}
