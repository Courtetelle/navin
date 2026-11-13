import { fmtShortDate } from '../../lib/format.ts';

import { layOutHeader } from './cardsHeader.ts';
import { CardsPen } from './cardsPen.ts';
import { layOutPhotos } from './cardsPhotos.ts';
import { layOutFooter, layOutSection } from './cardsSections.ts';
import { CARDS_STYLES, CARD_WIDTH } from './cardsStyle.ts';
import type { LoadedPhoto, LoadedSection } from './cardsTypes.ts';
import { shareTheme } from './shareTheme.ts';
import type { CardsDocument, CardsPhoto, LxTheme } from './types.ts';

/**
 * Draw a document as one PNG image, to send through WhatsApp or another app.
 * Pictures that fail to load are left out.
 * @param sheet - Title, sections, pictures and layout.
 * @returns The PNG file.
 */
export async function cardsPng(sheet: CardsDocument): Promise<Blob> {
  const theme: LxTheme = sheet.theme ?? shareTheme();
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d') as CanvasRenderingContext2D;
  const photos = await loadPhotos(sheet.photos ?? []);
  const avatar = sheet.avatar ? await loadImage(sheet.avatar) : null;
  const sections = await loadSections(sheet);
  const pen = new CardsPen(
    context,
    theme,
    avatar ? { image: avatar, rectangle: Boolean(sheet.avatarRect) } : null,
  );
  const layOut = (drawing: boolean) => {
    pen.drawing = drawing;
    return layOutCard(pen, sheet, sections, photos);
  };
  canvas.width = CARD_WIDTH;
  canvas.height = layOut(false);
  context.fillStyle = CARDS_STYLES[theme].background;
  context.fillRect(0, 0, canvas.width, canvas.height);
  layOut(true);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('png'));
    }, 'image/png');
  });
}

/**
 * Lay out a whole card from top to bottom.
 * @param pen - Pen.
 * @param sheet - Document.
 * @param sections - Its sections, pictures decoded.
 * @param photos - Its full-width pictures, decoded.
 * @returns The height of the card.
 */
export function layOutCard(
  pen: CardsPen,
  sheet: CardsDocument,
  sections: readonly LoadedSection[],
  photos: readonly LoadedPhoto[],
): number {
  layOutHeader(pen, {
    title: sheet.title,
    sub: sheet.sub ?? '',
    kicker: sheet.kicker ?? '',
  });
  for (const section of sections) layOutSection(pen, section);
  layOutPhotos(pen, photos, sheet.photosTitle || 'Photos');
  return layOutFooter(pen, fmtShortDate(new Date()));
}

function loadImage(source: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.addEventListener('load', () => {
      resolve(image);
    });
    image.addEventListener('error', () => {
      resolve(null);
    });
    image.src = source;
  });
}

/* eslint-disable no-await-in-loop -- pictures are decoded one at a time to limit the memory used on phones */
async function loadPhotos(
  photos: readonly CardsPhoto[],
): Promise<LoadedPhoto[]> {
  const loaded: LoadedPhoto[] = [];
  for (const photo of photos) {
    const image = await loadImage(photo.url);
    if (image) loaded.push({ image, caption: photo.cap });
  }
  return loaded;
}

async function loadSections(sheet: CardsDocument): Promise<LoadedSection[]> {
  const sections: LoadedSection[] = [];
  for (const section of sheet.sections ?? []) {
    const rows = [];
    for (const [label, value, photos] of section.rows) {
      rows.push({ label, value, photos: await loadPhotos(photos ?? []) });
    }
    sections.push({ title: section.title ?? '', rows });
  }
  return sections;
}
/* eslint-enable no-await-in-loop */
