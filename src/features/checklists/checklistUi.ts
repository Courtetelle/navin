import { signal } from '@preact/signals-react';

import { dayKey } from '../../lib/format.ts';
import { ensureDay, state } from '../../state/index.ts';

import { ckDefs } from './checklistOwner.ts';
import { ckCurrent } from './checklistProgress.ts';
import { ensureChecklistOwner } from './ownerUpdates.ts';

/**
 * What the checklist screen remembers between two visits (module globals of
 * legacy lake.js: `ckList`, `ckEditing`, `ckObsOpen`, `ckShowPh`).
 */
export const checklistUi = {
  /** List shown. */
  list: signal<string | null>(null),
  /** In-place edit mode (✎). */
  editing: signal(false),
  /** Observations panel open. */
  observationsOpen: signal(false),
  /** Green items whose photos are shown. */
  shownPhotos: signal<ReadonlySet<string>>(new Set()),
};

/**
 * Prepare the list screen: the list asked for, otherwise the one remembered,
 * otherwise the one to do; in the PréP flow always the arrival list (first
 * lines of legacy `VIEWS.checklist`).
 * @param list - List asked for.
 */
export function selectChecklist(list?: string | null): void {
  if (typeof list === 'string') checklistUi.list.value = list;
  if (state.data.prep.value?.step === 4) checklistUi.list.value = 'dep';
  ensureChecklistOwner();
  const current = checklistUi.list.value;
  if (!current || !ckDefs().some((slot) => slot[0] === current)) {
    checklistUi.list.value = ckCurrent();
  }
  ensureDay(dayKey(new Date()));
}

/**
 * Show or hide the photos of a green item.
 * @param id - Item id.
 */
export function toggleShownPhotos(id: string): void {
  const shown = new Set(checklistUi.shownPhotos.value);
  if (!shown.delete(id)) shown.add(id);
  checklistUi.shownPhotos.value = shown;
}
