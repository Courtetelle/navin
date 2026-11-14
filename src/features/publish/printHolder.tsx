import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';

import { PdfSheet } from './PdfSheet.tsx';
import { PrintDrawn } from './PrintDrawn.tsx';

/**
 * The rules of every PDF: no margin left to the browser (so no web address,
 * date or page title printed in it), our own margin on every page instead,
 * and no card, section, table row or picture cut in two: it goes whole to
 * the next page.
 */
export const PDF_RULES = `@media print {
  @page { margin: 0 !important }
  body > *:not(.print-only) { display: none !important }
  table.pdf-sheet { width: 100%; border: 0; border-collapse: collapse }
  table.pdf-sheet > thead > tr > td, table.pdf-sheet > tfoot > tr > td,
  table.pdf-sheet > tbody > tr > td { border: 0; padding: 0; background: none }
  table.pdf-sheet > thead > tr > td, table.pdf-sheet > tfoot > tr > td { height: 10mm }
  table.pdf-sheet > tbody > tr > td.pdf-body { padding: 0 10mm }
  section, article, figure, img, svg, canvas, tr, li, details,
  .lx-card, .card, .section, .pdf-keep { break-inside: avoid; page-break-inside: avoid }
  h1, h2, h3, h4, summary { break-after: avoid; page-break-after: avoid }
}`;

/** Print stylesheet of the A4 portrait documents. */
export const PRINT_CSS_A4_PORTRAIT =
  '@media print { main { display:none } @page { size: A4 portrait; margin: 10mm } }';

/** What {@link printInHolder} prints. */
export interface PrintInHolderOptions {
  /** Class of the holder `<div>` appended to `<body>`, e.g. `print-only book lx-print`. */
  className: string;
  /** Content of the holder. */
  content: ReactNode;
  /** Document title while printing: the file name the browser suggests. */
  title: string;
  /**
   * Milliseconds before `window.print()`.
   * @default 50
   */
  delay?: number;
  /**
   * Stylesheet added to `<head>` while printing.
   * @default PRINT_CSS_A4_PORTRAIT
   */
  css?: string;
  /**
   * Remove `.lx-print` holders left by a print that never got `afterprint`.
   * @default false
   */
  removeStale?: boolean;
}

/**
 * Print a document the way every legacy print did: a `.print-only` holder at
 * the end of `<body>`, a temporary print stylesheet and document title, all
 * removed after printing.
 * @param options - Holder class, content, title, delay and stylesheet.
 */
export function printInHolder({
  className,
  content,
  title,
  delay = 50,
  css = PRINT_CSS_A4_PORTRAIT,
  removeStale = false,
}: PrintInHolderOptions): void {
  if (removeStale) {
    for (const stale of document.querySelectorAll('.lx-print')) stale.remove();
  }
  const holder = document.createElement('div');
  holder.className = className;
  const root = createRoot(holder);
  document.body.append(holder);
  const style = document.createElement('style');
  style.textContent = `${css}\n${PDF_RULES}`;
  document.head.append(style);
  const oldTitle = document.title;
  document.title = title;
  const cleanup = () => {
    root.unmount();
    holder.remove();
    style.remove();
    document.title = oldTitle;
    globalThis.removeEventListener('afterprint', cleanup);
  };
  globalThis.addEventListener('afterprint', cleanup);
  root.render(
    <PrintDrawn
      onDrawn={() => {
        setTimeout(() => {
          globalThis.print();
        }, delay);
      }}
    >
      <PdfSheet>{content}</PdfSheet>
    </PrintDrawn>,
  );
}
