import { fileName, state, toast } from '../../state/index.ts';
import { printInHolder } from '../publish/index.ts';

import { PrepReport } from './PrepReport.tsx';
import {
  cachedPrepReport,
  prepReportDocument,
  reportKey,
  reportPhotos,
  reportTheme,
} from './prepReportData.ts';

/**
 * Print the PréP + check-in report (legacy `prepReportPrint`), from the
 * prepared report when it matches the current choices.
 * @returns Resolves when the print is scheduled.
 */
export async function prepReportPrint(): Promise<void> {
  if (!state.data.cruise.value) {
    toast('Choisissez d’abord le bateau');
    return;
  }
  const report = cachedPrepReport();
  const document =
    report?.key === reportKey() && report.document
      ? report.document
      : await prepReportDocument(reportPhotos());
  printInHolder({
    className: 'print-only book lx-print',
    content: document ? (
      <PrepReport document={document} theme={reportTheme()} />
    ) : null,
    title: fileName('-prep', 'pdf').replace(/\.pdf$/, ''),
    delay: 80,
    removeStale: true,
  });
}
