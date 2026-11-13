import type { ShareFormat } from '../../components/shared/shareFormat.ts';
import { deliver, toast } from '../../state/index.ts';

import { cardsPng } from './cardsPng.ts';
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
  printInHolder({
    className: 'print-only book img-print',
    content: <img className="img-print-pic" src={url} alt={title} />,
    title,
    css: `${PRINT_CSS_A4_PORTRAIT} @media print { .img-print-pic { display:block; width:100%; height:auto } }`,
  });
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
