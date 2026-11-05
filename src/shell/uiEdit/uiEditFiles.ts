import { buzz } from '../../lib/dom.ts';
import { pad } from '../../lib/format.ts';
import { APP_VERSION } from '../../model/taskTemplate.ts';
import { deliver, mergeUiEdits, state, toast } from '../../state/index.ts';
import { go } from '../router.ts';

/**
 * The export file of the edits (legacy `uiEditExportData`).
 * @returns The JSON object.
 */
export function uiEditExportData(): Record<string, unknown> {
  return {
    app: 'livre-de-bord',
    kind: 'ui-edits',
    version: 1,
    saved: new Date().toISOString(),
    sw: APP_VERSION,
    edits: state.data.uiEdits.value,
  };
}

/** Download the edits file (settings › ⇪ Exporter les modifications). */
export function exportEdits(): void {
  buzz();
  const date = new Date();
  void deliver(
    JSON.stringify(uiEditExportData(), null, 2),
    `navin-boutons-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}.json`,
    'application/json',
  );
}

/**
 * Merge an edits file chosen by the user (settings › ⇩ Importer).
 * @param input - The file input.
 */
export async function importEdits(input: HTMLInputElement): Promise<void> {
  try {
    const chosen = input.files?.[0];
    if (!chosen) throw new Error('no file');
    const parsed = JSON.parse(await chosen.text()) as {
      edits?: Record<string, unknown>;
      data?: { uiEdits?: Record<string, unknown> };
    };
    const taken = mergeUiEdits(parsed.edits || parsed.data?.uiEdits || {});
    toast(`${taken} bouton(s) importé(s)`);
    go('settings');
  } catch {
    toast('Fichier illisible');
  }
}
