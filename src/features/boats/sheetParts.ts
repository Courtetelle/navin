import { curMode, state, updateSettings } from '../../state/index.ts';
import type { CruisePhoto } from '../onwater/index.ts';
import { journalExtract, journalFull, photosFor } from '../onwater/index.ts';

import { hasTrace } from './outing.ts';
import type { PickedSheet, SheetContent } from './sheetTypes.ts';

/** Parts of the sheet the user can send: key and button label. */
export const SHEET_PARTS: ReadonlyArray<readonly [SheetPart, string]> = [
  ['info', 'ℹ️ Informations'],
  ['trace', '🗺 Trace'],
  ['journal', '📍 Extrait du journal'],
  ['journalFull', '📜 Journal complet'],
  ['obs', '📝 Observations'],
  ['photos', '📷 Photos'],
  ['checks', '✅ Check-lists'],
  ['tarifs', '💶 Tarifs'],
];

/** A part of the sheet. */
export type SheetPart =
  | 'info'
  | 'trace'
  | 'journal'
  | 'journalFull'
  | 'obs'
  | 'photos'
  | 'checks'
  | 'tarifs';

/**
 * The parts chosen by the user (legacy `sheetParts`, remembered in the settings).
 * @returns The state of every part.
 */
export function sheetParts(): Record<SheetPart, boolean> {
  return {
    info: true,
    trace: true,
    journal: true,
    journalFull: false,
    obs: true,
    photos: true,
    checks: true,
    tarifs: true,
    ...(state.preferences.settings.value.sheetParts as
      Partial<Record<SheetPart, boolean>> | undefined),
  };
}

/**
 * Toggle a part; the journal extract and the full journal exclude each other.
 * @param part - Part touched.
 */
export function toggleSheetPart(part: SheetPart): void {
  const parts = sheetParts();
  const next = { ...parts, [part]: !parts[part] };
  if (next[part] && part === 'journal') next.journalFull = false;
  if (next[part] && part === 'journalFull') next.journal = false;
  updateSettings((settings) => {
    settings.sheetParts = next;
  });
}

/**
 * Reduce a sheet to the chosen parts (legacy `pickSheet`).
 * @param sheet - Sheet content.
 * @param key - Day key.
 * @returns The sheet to show or send.
 */
export function pickSheet(sheet: SheetContent, key: string): PickedSheet {
  const parts = sheetParts();
  let extract: PickedSheet['extract'] = [];
  if (parts.journalFull) extract = journalFull(key);
  else if (parts.journal) extract = journalExtract(key);
  return {
    ...sheet,
    sections: sheet.sections.filter((section) =>
      section.title === 'Tarifs de location' ? parts.tarifs : parts.info,
    ),
    showObs: parts.obs,
    sig: parts.obs ? sheet.sig : null,
    checks: parts.checks ? sheet.checks : [],
    extract,
    extractTitle: parts.journalFull ? 'Journal complet' : 'Extrait du journal',
    photos: parts.photos ? sheetPhotos(key) : [],
    traceK: parts.trace && hasTrace(key) ? key : null,
  };
}

function sheetPhotos(key: string): CruisePhoto[] {
  if (curMode() === 'lacj') return photosFor(null, key);
  return [...photosFor('dep'), ...photosFor('nav', key), ...photosFor('quit')];
}
