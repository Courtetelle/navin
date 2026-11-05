import { freeze, produce } from 'immer';

import { TASK_TPL_DEFAULT } from '../model/taskTemplate.ts';
import type { TaskTemplate, UiEdit } from '../model/types.ts';
import { store } from '../storage/store.ts';

import { data } from './data.ts';
import { curMode } from './mode.ts';

/** Load the aboard task template (`ldb.taskTpl`, the default when absent). */
export function loadTaskTpl(): void {
  data.taskTpl.value =
    store.get<TaskTemplate | null>('ldb.taskTpl', null) ||
    structuredClone(TASK_TPL_DEFAULT);
}

/**
 * Change the task template, stamp it and persist it (legacy `saveTaskTpl`).
 * @param recipe - Mutates the draft template.
 * @returns `true` when written.
 */
export function updateTaskTpl(
  recipe: (template: TaskTemplate) => void,
): boolean {
  const current = data.taskTpl.value ?? structuredClone(TASK_TPL_DEFAULT);
  data.taskTpl.value = produce(current, (template) => {
    recipe(template);
    template.at = new Date().toISOString();
  });
  return store.set('ldb.taskTpl', data.taskTpl.value);
}

/**
 * Replace the task template as received from a backup (no new stamp).
 * @param template - Received template.
 * @returns `true` when written.
 */
export function setTaskTpl(template: TaskTemplate): boolean {
  data.taskTpl.value = freeze(template, true);
  return store.set('ldb.taskTpl', template);
}

/**
 * Put back the original task template (stamped and saved).
 * @returns `true` when written.
 */
export function resetTaskTpl(): boolean {
  data.taskTpl.value = {
    ...structuredClone(TASK_TPL_DEFAULT),
    at: new Date().toISOString(),
  };
  return store.set('ldb.taskTpl', data.taskTpl.value);
}

/**
 * The open cruise has an aboard task rotation (sea and lake cruises) (legacy `hasAboard`).
 * @returns `true` when shown.
 */
export function hasAboard(): boolean {
  return Boolean(data.cruise.value) && curMode() !== 'lacj';
}

/** Load the button customizations (`ldb.uiEdits`). */
export function loadUiEdits(): void {
  data.uiEdits.value = store.get<Record<string, UiEdit>>('ldb.uiEdits', {});
}

/**
 * Persist the button customizations with their stamp (legacy `saveUiEdits`).
 */
export function saveUiEdits(): void {
  store.set('ldb.uiEdits', data.uiEdits.value);
  store.set('ldb.uiEdits.at', new Date().toISOString());
}

/**
 * Change the button customizations with an immer recipe, then save them.
 * @param recipe - Mutates the draft map.
 */
export function updateUiEdits(
  recipe: (edits: Record<string, UiEdit>) => void,
): void {
  data.uiEdits.value = produce(data.uiEdits.value, recipe);
  saveUiEdits();
}

/**
 * Merge received customizations, newer ones (`at`) winning (legacy `mergeUiEdits`).
 * @param list - Received map.
 * @returns How many were taken.
 */
export function mergeUiEdits(
  list: Record<string, unknown> | null | undefined,
): number {
  let taken = 0;
  const next = { ...data.uiEdits.value };
  for (const [key, value] of Object.entries(list || {})) {
    if (!value || typeof value !== 'object') continue;
    const edit = value as UiEdit;
    if (!next[key] || (edit.at || '') > (next[key]?.at || '')) {
      next[key] = edit;
      taken++;
    }
  }
  if (taken) {
    data.uiEdits.value = freeze(next, true);
    saveUiEdits();
  }
  return taken;
}
