import {
  buildSheetData,
  pickSheet,
  prepReportPng,
  prepareSheet,
  sheetPng,
} from '../../features/boats/index.ts';
import { crewListPng } from '../../features/onwater/index.ts';
import { sendFiles } from '../../features/publish/index.ts';
import { fileName, state, toast } from '../../state/index.ts';

/** Pages that have an image of their own; the others exist in PDF only. */
const PICTURED = new Set(['crew', 'prep']);

/**
 * The log book as images, for WhatsApp: each day, the crew list and the
 * PréP report checked. The other pages (title, boat, safety, radio, blank)
 * are made for A4 and come with the PDF.
 * @param ids - Pages checked, in order.
 */
export async function shareLogbookImages(
  ids: readonly string[],
): Promise<void> {
  const pictured = ids.filter(
    (id) => id.startsWith('day:') || PICTURED.has(id),
  );
  if (pictured.length === 0) {
    toast('Ces pages existent en PDF seulement : choisissez 🖨');
    return;
  }
  toast('Préparation des images…');
  const files: File[] = [];
  /* eslint-disable no-await-in-loop -- one image at a time keeps the memory of a phone */
  for (const id of pictured) {
    try {
      let blob: Blob | null = null;
      if (id === 'crew') {
        blob = await crewListPng();
      } else if (id === 'prep') {
        blob = await prepReportPng();
      } else {
        const key = id.slice(4);
        prepareSheet(key);
        blob = await sheetPng(pickSheet(buildSheetData(key), key));
      }
      if (blob) {
        const name = id.replace(':', '-');
        files.push(
          new File([blob], fileName(`-${name}`, 'png'), { type: 'image/png' }),
        );
      }
    } catch {
      // The next page.
    }
  }
  /* eslint-enable no-await-in-loop */
  if (files.length === 0) {
    toast('Image impossible : faites une capture d’écran');
    return;
  }
  await sendFiles(files, state.data.cruise.value?.info.name ?? 'Livre de bord');
  if (pictured.length < ids.length) {
    toast('Pages titre, bateau, sécurité, radio : en PDF seulement (🖨)');
  }
}
