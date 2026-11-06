import { freeze } from 'immer';

import type { CruiseMeta, MobLog } from '../model/types.ts';
import {
  setStorageBackend,
  setStoreFullHandler,
  store,
} from '../storage/store.ts';

import { loadBoats } from './boats.ts';
import { loadChecklistLibrary } from './checklistLibrary.ts';
import { loadCrewSets } from './crewSets.ts';
import { openCruise } from './cruise.ts';
import { data } from './data.ts';
import { purgeExamples } from './examples.ts';
import { examplesWanted } from './examplesWanted.ts';
import { loadSosLogs } from './logs.ts';
import { loadMarks } from './marks.ts';
import { loadMembers } from './members.ts';
import { loadSettings, preferences } from './preferences.ts';
import { loadPrep } from './prep.ts';
import { loadTaskTpl, loadUiEdits } from './templates.ts';
import { toast } from './toast.ts';
import { resetView } from './view.ts';

/**
 * Load every entity from storage, running the one-shot migrations in the
 * legacy script order (app, lake, ui-edit, marks, prep), then open the
 * current cruise like the legacy `boot` (the stored current one, else the last
 * of the index). Called automatically when `src/state/index.ts` is imported in
 * a browser; tests call it with an in-memory storage.
 * @param backend - Storage to use (`undefined` keeps the current one, i.e. localStorage).
 */
export function initState(backend?: Storage | null): void {
  if (backend !== undefined) setStorageBackend(backend);
  setStoreFullHandler((message) => toast(message));
  resetView();
  loadSettings();
  data.index.value = store.get<CruiseMeta[]>('ldb.index', []);
  data.cruise.value = null;
  data.draft.value = null;
  loadChecklistLibrary();
  loadBoats();
  loadMembers();
  loadTaskTpl();
  loadUiEdits();
  loadMarks();
  loadPrep();
  loadCrewSets();
  loadSosLogs();
  data.mobLogs.value = store.get<MobLog[]>('ldb.mobLogs', []);
  if (!examplesWanted()) purgeExamples();
  for (const record of Object.values(data)) freeze(record.value, true);
  freeze(preferences.settings.value, true);
  const current = store.get<string | null>('ldb.current', null);
  if (!(current && openCruise(current)) && data.index.value.length > 0) {
    openCruise((data.index.value.at(-1) as CruiseMeta).id);
  }
}
