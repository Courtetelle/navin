import { fmtShortDate } from '../../lib/format.ts';
import type { Boat } from '../../model/types.ts';
import { deliver, state, toast } from '../../state/index.ts';
import { getPhoto } from '../../storage/photos.ts';
import { cardsPng, listTheme, printInHolder } from '../publish/index.ts';

import type { DocumentPicture } from './DossierPrint.tsx';
import { DossierPrint } from './DossierPrint.tsx';
import { boatDocs, docKindName } from './boatDocs.ts';
import { boatInfoRows } from './boatInfoRows.ts';

/**
 * Send a boat sheet as an image, with the photos of its documents (legacy
 * `shareBoatDossier`).
 * @param boat - Boat.
 */
export async function shareBoatDossier(boat: Boat): Promise<void> {
  try {
    const pictures = await documentPictures(boat);
    const blob = await cardsPng({
      title: boat.info.boat || 'Bateau',
      kicker: 'Fiche bateau',
      sub: `Fiche bateau · ${fmtShortDate(new Date())}`,
      theme: listTheme('boats'),
      sections: boatInfoRows(boat).map((section) => ({
        title: section.title,
        rows: section.rows.filter(([label]) => label !== 'Nom du bateau'),
      })),
      photosTitle: 'Documents',
      photos: pictures.map(({ document, url }) => ({
        url,
        cap: document.cap || docKindName(document.kind),
      })),
    });
    const name = (boat.info.boat || 'bateau')
      .normalize('NFD')
      .replaceAll(/[̀-ͯ]/g, '')
      .replaceAll(/[^a-z0-9]+/gi, '-')
      .toLowerCase();
    await deliver(blob, `fiche-bateau-${name}.png`, 'image/png');
  } catch {
    toast('Image impossible : faites une capture d’écran');
  }
}

/**
 * Print a boat sheet and the photos of its documents (legacy `printBoatDossier`).
 * @param boat - Boat.
 * @returns Resolves when the print is scheduled.
 */
export async function printBoatDossier(boat: Boat): Promise<void> {
  const pictures = await documentPictures(boat);
  const name = (boat.info.boat || 'bateau').replaceAll(/\s+/g, '-');
  printInHolder({
    className: 'print-only book dos-print',
    content: <DossierPrint boat={boat} pictures={pictures} />,
    title: `fiche-bateau-${name}`,
    delay: 150,
  });
}

/**
 * Photos of the boats, members and crews, which travel in a full backup (legacy
 * `boatDocPhotos`).
 * @returns Photo ids and data.
 */
export async function boatDocPhotos(): Promise<
  Array<{ id: string; url: unknown }>
> {
  const ids: string[] = [];
  for (const boat of state.data.boats.value) {
    for (const document of boatDocs(boat)) ids.push(document.id);
  }
  for (const member of state.data.members.value) {
    const photos = (member.photos ?? []) as ReadonlyArray<{ id: string }>;
    for (const photo of photos) ids.push(photo.id);
  }
  for (const crew of state.data.crewSets.value) {
    if (crew.photo) ids.push(crew.photo as string);
  }
  const out: Array<{ id: string; url: unknown }> = [];
  /* eslint-disable no-await-in-loop -- one photo in memory at a time on a phone */
  for (const id of ids) {
    const url = await getPhoto(id);
    if (url) out.push({ id, url });
  }
  /* eslint-enable no-await-in-loop */
  return out;
}

async function documentPictures(boat: Boat): Promise<DocumentPicture[]> {
  const pictures: DocumentPicture[] = [];
  /* eslint-disable no-await-in-loop -- one photo in memory at a time on a phone */
  for (const document of boatDocs(boat)) {
    if (document.pdf) continue;
    const url = await getPhoto(document.id);
    if (typeof url === 'string' && url) pictures.push({ document, url });
  }
  /* eslint-enable no-await-in-loop */
  return pictures;
}
