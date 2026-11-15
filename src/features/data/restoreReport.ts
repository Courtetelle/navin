import { signal } from '@preact/signals-react';

import type { RestoreReport } from './restoreBackup.ts';

/** The report of the last restoration, shown until « OK ». */
export const restoreReport = signal<RestoreReport | null>(null);

const plural = (count: number, one: string, many: string) =>
  `${count} ${count > 1 ? many : one}`;

/**
 * The lines of a report: the navigations added, completed (the duplicates
 * merged) and identical, then the records added.
 * @param report - What the restoration did.
 * @returns The lines, in French.
 */
export function reportLines(report: RestoreReport): string[] {
  const lines: string[] = [];
  if (report.added.length > 0) {
    lines.push(
      `➕ ${plural(report.added.length, 'navigation ajoutée', 'navigations ajoutées')} : ${report.added.join(', ')}`,
    );
  }
  if (report.completed.length > 0) {
    lines.push(
      `🔁 ${plural(report.completed.length, 'navigation déjà là, complétée', 'navigations déjà là, complétées')} (doublons fusionnés, rien d’effacé) : ${report.completed.join(', ')}`,
    );
  }
  if (report.same.length > 0) {
    lines.push(
      `✔︎ ${plural(report.same.length, 'navigation déjà identique', 'navigations déjà identiques')} : ${report.same.join(', ')}`,
    );
  }
  const records = [
    report.boats > 0 ? plural(report.boats, 'bateau', 'bateaux') : '',
    report.members > 0 ? plural(report.members, 'équipier', 'équipiers') : '',
    report.marks > 0 ? plural(report.marks, 'marque', 'marques') : '',
    report.crews > 0 ? plural(report.crews, 'équipage', 'équipages') : '',
  ].filter(Boolean);
  lines.push(
    records.length > 0
      ? `➕ Fiches ajoutées : ${records.join(', ')}`
      : '✔︎ Bateaux, équipiers, marques et équipages : déjà à jour',
  );
  return lines;
}
