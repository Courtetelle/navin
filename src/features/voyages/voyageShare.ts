import { createElement } from 'react';

import type { ShareFormat } from '../../components/shared/shareFormat.ts';
import type { VoyageSection } from '../../model/voyages.ts';
import { deliver, toast } from '../../state/index.ts';
import { sheetPng } from '../boats/index.ts';
import { printInHolder } from '../publish/index.ts';

import { VoyagePrintPage } from './VoyagePrintPage.tsx';

/** The A4 page of the shared tables. */
const VOYAGE_CSS = `@media print {
  main { display:none }
  @page { size: A4 portrait; margin: 12mm }
}
.voy-print { font: 400 10.5pt/1.35 system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; color: #14213d }
.voy-print h1 { font-size: 18pt; color: #0b3a6e; margin: 0 0 4mm }
.voy-print h2 { font-size: 12.5pt; color: #0b3a6e; border-bottom: 2px solid #0b3a6e; padding-bottom: 1mm; margin: 5mm 0 1.5mm; break-after: avoid }
.voy-print table { width: 100%; border-collapse: collapse; break-inside: avoid }
.voy-print td { border-bottom: 1px solid #e1e8f2; padding: 1.3mm 2mm; vertical-align: top; white-space: pre-wrap }
.voy-print td:first-child { width: 38%; font-weight: 700; color: #0b3a6e }
.voy-print .voy-foot { margin-top: 6mm; font-size: 9pt; color: #4a5a75 }`;

/**
 * A plain file name from a title.
 * @param title - The title.
 * @returns e.g. `Croisieres-Contrats`.
 */
export function fileStem(title: string): string {
  return (
    title
      .normalize('NFD')
      .replaceAll(/[̀-ͯ]/gu, '')
      .replaceAll(/[^a-z0-9]+/giu, '-')
      .replaceAll(/^-|-$/gu, '') || 'NavIn'
  );
}

/**
 * Share tables of data › Croisières: an image for WhatsApp, or a PDF.
 * @param title - Title of the image or page.
 * @param sections - The tables.
 * @param format - Image or PDF.
 */
export async function shareSections(
  title: string,
  sections: readonly VoyageSection[],
  format: ShareFormat,
): Promise<void> {
  if (sections.length === 0) {
    toast('Rien à partager pour l’instant');
    return;
  }
  const stem = fileStem(title);
  if (format === 'pdf') {
    printInHolder({
      className: 'print-only book lx-print voy-print',
      title: stem,
      delay: 150,
      css: VOYAGE_CSS,
      content: createElement(VoyagePrintPage, { title, sections }),
    });
    return;
  }
  try {
    const blob = await sheetPng({
      title,
      checks: [],
      showObs: false,
      sections,
    });
    await deliver(blob, `${stem}.png`, 'image/png');
  } catch {
    toast('Image impossible : partagez le PDF');
  }
}
