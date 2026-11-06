import { state } from '../../state/index.ts';

import { selectChecklist } from './checklistUi.ts';
import { ensureChecklistOwner } from './ownerUpdates.ts';

/** Screens showing the checklist progress: their first display seeds the lists. */
const PROGRESS_VIEWS: ReadonlySet<string> = new Set([
  'new',
  'more',
  'prep',
  'sheet',
]);

/**
 * What legacy did at the start of a screen render, before anything is drawn:
 * seeding the lists of the owner, choosing the list to show.
 * @param view - Screen about to open.
 * @param arg - Its argument.
 */
export function prepareChecklists(view: string, arg: unknown): void {
  if (view === 'ckbases') {
    if (typeof arg === 'string' && arg) return;
    for (const boat of state.data.boats.value) ensureChecklistOwner(boat.id);
  } else if (view === 'checklist') {
    prepareChecklistPage(arg);
  } else if (PROGRESS_VIEWS.has(view) && readsProgress(view)) {
    ensureChecklistOwner();
  }
}

function readsProgress(view: string): boolean {
  if (!state.data.cruise.value) return false;
  // Editing an entry shows no checklist banner, so nothing reads the lists.
  if (view === 'new') return !state.data.draft.value?.id;
  return view !== 'prep' || !state.data.prep.value?.fresh;
}

function prepareChecklistPage(arg: unknown): void {
  const options = (arg && typeof arg === 'object' ? arg : {}) as {
    edit?: boolean;
    boatId?: string;
  };
  if (options.boatId) return;
  if (options.edit) ensureChecklistOwner();
  else selectChecklist(typeof arg === 'string' ? arg : null);
}
