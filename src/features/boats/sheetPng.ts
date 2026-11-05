import { getPhoto } from '../../storage/photos.ts';
import { traceImage } from '../onwater/index.ts';

import { loadImage } from './boatThumb.ts';
import type { SheetImages, SheetPicture } from './sheetLayout.ts';
import { SHEET_WIDTH, sheetLayout } from './sheetLayout.ts';
import type { SheetImageContent } from './sheetTypes.ts';

/**
 * Draw a sheet as a PNG, black on white, readable on a phone (legacy `sheetPng`).
 * @param sheet - Sheet content.
 * @returns The PNG blob.
 */
export async function sheetPng(sheet: SheetImageContent): Promise<Blob> {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d') as CanvasRenderingContext2D;
  const images = await readImages(sheet);
  canvas.width = SHEET_WIDTH;
  canvas.height = sheetLayout(context, sheet, images, false);
  context.fillStyle = '#fff';
  context.fillRect(0, 0, SHEET_WIDTH, canvas.height);
  sheetLayout(context, sheet, images, true);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('png'));
    }, 'image/png');
  });
}

/* eslint-disable no-await-in-loop -- photos are read one by one to keep memory low on a phone */
async function readImages(sheet: SheetImageContent): Promise<SheetImages> {
  const signature = sheet.sig ? await loadImage(sheet.sig) : null;
  const traceUrl = sheet.traceK ? await traceImage(sheet.traceK) : null;
  const trace = traceUrl ? await loadImage(traceUrl) : null;
  const pictures: SheetPicture[] = [];
  for (const photo of sheet.photos ?? []) {
    const url = await getPhoto(photo.id);
    if (typeof url !== 'string' || !url) continue;
    const image = await loadImage(url);
    if (image) pictures.push({ photo, image });
  }
  return { signature, trace, pictures };
}
/* eslint-enable no-await-in-loop */
