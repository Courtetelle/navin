import { signal } from '@preact/signals-react';

import type { VoyageDoc } from '../../model/voyages.ts';
import { toast } from '../../state/index.ts';

import { voyageFile } from './voyageFiles.ts';

/** The document shown in the viewer of the app, if any. */
export interface ShownDoc {
  id: string;
  title: string;
  /** Object URL of the file, revoked when the viewer closes. */
  url: string;
  image: boolean;
}

/** The document open in the viewer (Corban, 26/11/2026: PDF inside the app). */
export const docShown = signal<ShownDoc | null>(null);

/**
 * Show a document in the viewer of the app, over the page.
 * @param doc - The document.
 */
export async function showVoyageDoc(doc: VoyageDoc): Promise<void> {
  const file = await voyageFile(doc);
  if (!file) {
    toast('Fichier absent de cet appareil');
    return;
  }
  closeVoyageDoc();
  docShown.value = {
    id: doc.id,
    title: doc.title || doc.name,
    url: URL.createObjectURL(file),
    image: file.type.startsWith('image/'),
  };
}

/** Close the viewer and free its file. */
export function closeVoyageDoc(): void {
  const shown = docShown.value;
  if (!shown) return;
  URL.revokeObjectURL(shown.url);
  docShown.value = null;
}
