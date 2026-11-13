import { fmtTime } from '../../lib/format.ts';
import { PHOTO_CTX, getPhoto } from '../../storage/photos.ts';
import type { CruisePhoto } from '../onwater/index.ts';
import { traceImage } from '../onwater/index.ts';
import type {
  CardsDocument,
  CardsPhoto,
  CardsRow,
  CardsSection,
} from '../publish/index.ts';
import { cardsPng } from '../publish/index.ts';

import type { SheetImageContent } from './sheetTypes.ts';

function pictureCaption(photo: CruisePhoto): string {
  if (typeof photo.cap === 'string' && photo.cap) return photo.cap;
  const moment = (PHOTO_CTX[photo.ctx] ?? '').replace('📷 ', '');
  return `${moment} · ${fmtTime(new Date(photo.t))}`;
}

/* eslint-disable no-await-in-loop -- photos are read one by one to keep memory low on a phone */
async function pictures(sheet: SheetImageContent): Promise<CardsPhoto[]> {
  const out: CardsPhoto[] = [];
  const trace = sheet.traceK ? await traceImage(sheet.traceK) : null;
  if (trace) out.push({ url: trace, cap: 'Trace du jour' });
  for (const photo of sheet.photos ?? []) {
    const url = await getPhoto(photo.id).catch(() => null);
    if (typeof url === 'string' && url) {
      out.push({ url, cap: pictureCaption(photo) });
    }
  }
  if (sheet.sig) {
    out.push({
      url: sheet.sig,
      cap: `Signature${sheet.sigName ? ` · ${sheet.sigName}` : ''}`,
    });
  }
  return out;
}
/* eslint-enable no-await-in-loop */

/**
 * A sheet (a day, the crew list) as a document of the layout chosen in
 * Réglages: its tables, checklists, observations, journal lines, then the
 * trace, the photos and the signature.
 * @param sheet - Sheet content.
 * @returns The document.
 */
export async function sheetDocument(
  sheet: SheetImageContent,
): Promise<CardsDocument> {
  const sections: CardsSection[] = sheet.sections.map((section) => ({
    title: section.title,
    rows: section.rows.map(([label, value]): CardsRow => [label, value]),
  }));
  for (const [index, list] of sheet.checks.entries()) {
    sections.push({
      title: `${index || sheet.noNum ? '' : '3 · '}${list.name}`,
      rows: list.items.map((item): CardsRow => [
        item.label,
        item.ok ? '✓' : '✗',
      ]),
    });
  }
  if ((sheet.showObs ?? true) && sheet.obs) {
    sections.push({
      title: 'Observations',
      rows: [['Observations', sheet.obs]],
    });
  }
  if (sheet.extract?.length) {
    sections.push({
      title: sheet.extractTitle ?? 'Extrait du journal',
      rows: sheet.extract.map((line): CardsRow => [
        line.time,
        line.more ? `${line.what} · ${line.more}` : line.what,
      ]),
    });
  }
  return {
    title: sheet.title,
    kicker: 'Fiche',
    sections,
    photos: await pictures(sheet),
    photosTitle: sheet.photosTitle ?? 'Trace, photos et signature',
  };
}

/**
 * Draw a sheet as a PNG in the layout chosen in Réglages (legacy `sheetPng`).
 * @param sheet - Sheet content.
 * @returns The PNG blob.
 */
export async function sheetPng(sheet: SheetImageContent): Promise<Blob> {
  return cardsPng(await sheetDocument(sheet));
}
