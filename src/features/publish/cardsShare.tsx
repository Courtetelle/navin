import type { ShareFormat } from '../../components/shared/shareFormat.ts';
import { deliver, toast } from '../../state/index.ts';

import { cardsCuts, cardsPng } from './cardsPng.ts';
import { PRINT_CSS_A4_PORTRAIT, printInHolder } from './printHolder.tsx';
import type { CardsDocument } from './types.ts';

/**
 * Read a picture as a data URL, so that it outlives the print.
 * @param blob - The picture.
 * @returns The data URL.
 */
function dataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      resolve(typeof reader.result === 'string' ? reader.result : '');
    });
    reader.addEventListener('error', () =>
      reject(reader.error ?? new Error('unreadable')),
    );
    reader.readAsDataURL(blob);
  });
}

/**
 * Make a PDF of a picture: the print window of the device, where « Save as
 * PDF » or a mail is chosen. The picture fills the width of A4 pages.
 * @param blob - The picture.
 * @param title - Name of the file the device suggests.
 */
export async function printImage(blob: Blob, title: string): Promise<void> {
  const url = await dataUrl(blob);
  const picture = new Image();
  picture.src = url;
  await picture.decode().catch(() => undefined);
  // One picture per section: a section that does not fit goes whole to the
  // next page.
  const pieces = slices(picture, cardsCuts(blob)) ?? [url];
  printInHolder({
    className: 'print-only book img-print',
    content: (
      <>
        {pieces.map((piece, index) => (
          <img
            // eslint-disable-next-line react/no-array-index-key -- the pieces never move
            key={index}
            className="img-print-pic"
            src={piece}
            alt={index === 0 ? title : ''}
          />
        ))}
      </>
    ),
    title,
    css: `${PRINT_CSS_A4_PORTRAIT} @media print { .img-print-pic { display:block; max-width:100%; max-height:277mm; width:auto; height:auto; margin:0 auto; break-inside:avoid; page-break-inside:avoid } }`,
  });
}

/**
 * Cut a picture at the given heights.
 * @param picture - The decoded picture.
 * @param cuts - Heights in pixels, top to bottom.
 * @returns One data URL per piece, or null when it stays whole.
 */
function slices(
  picture: HTMLImageElement,
  cuts: readonly number[],
): string[] | null {
  const width = picture.naturalWidth;
  const height = picture.naturalHeight;
  if (cuts.length === 0 || !width || !height) return null;
  const edges = [0, ...cuts.filter((cut) => cut > 0 && cut < height), height];
  const pieces: string[] = [];
  for (let index = 1; index < edges.length; index++) {
    const top = edges[index - 1] ?? 0;
    const bottom = edges[index] ?? height;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = Math.max(1, Math.round(bottom - top));
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.drawImage(picture, 0, -top);
    pieces.push(canvas.toDataURL('image/png'));
  }
  return pieces;
}

/**
 * Share a document drawn in the layout of Réglages: the image to the share
 * sheet, or the same image as a PDF.
 * @param document - What to draw.
 * @param name - File name without extension.
 * @param format - Image or PDF.
 */
export async function shareCards(
  document: CardsDocument,
  name: string,
  format: ShareFormat,
): Promise<void> {
  try {
    const blob = await cardsPng(document);
    if (format === 'pdf') await printImage(blob, name);
    else await deliver(blob, `${name}.png`, 'image/png');
  } catch {
    toast('Image impossible : faites une capture d’écran');
  }
}
