import { produce } from 'immer';

import { uid } from '../../lib/format.ts';
import type { FieldDefinition } from '../../model/field.ts';
import { state, updateSettings } from '../../state/index.ts';

/**
 * The list of the labels of the user exists from the moment the ✎ mode opens;
 * it reaches the storage with the next save of the settings.
 */
export function ensureCustomLabels(): void {
  const { settings } = state.preferences;
  if (settings.value.memberCustom) return;
  settings.value = produce(settings.value, (draft) => {
    draft.memberCustom = [];
  });
}

/**
 * Rename a standard label of the cards; empty or the original label removes
 * the renaming.
 * @param field - Standard field.
 * @param label - Text typed, trimmed.
 */
export function renameMemberLabel(field: FieldDefinition, label: string): void {
  updateSettings((settings) => {
    settings.memberAlias ??= {};
    const alias = settings.memberAlias;
    if (label && label !== field.label) alias[field.key] = label;
    else Reflect.deleteProperty(alias, field.key);
  });
}

/**
 * Rename a label of the user; an empty text is ignored.
 * @param id - Custom label id.
 * @param label - Text typed, trimmed.
 */
export function renameCustomLabel(id: string, label: string): void {
  if (!label) return;
  updateSettings((settings) => {
    const custom = settings.memberCustom?.find((item) => item.id === id);
    if (custom) custom.label = label;
  });
}

/**
 * Add a label to all the cards.
 * @param label - Text of the label.
 * @returns Its id.
 */
export function addCustomLabel(label: string): string {
  const id = uid();
  updateSettings((settings) => {
    (settings.memberCustom ??= []).push({ id, label });
  });
  return id;
}

/**
 * Move a label of the user.
 * @param id - Custom label id.
 * @param direction - `-1` up, `1` down.
 */
export function moveCustomLabel(id: string, direction: number): void {
  updateSettings((settings) => {
    const list = settings.memberCustom ?? [];
    const index = list.findIndex((item) => item.id === id);
    const first = list[index];
    const second = list[index + direction];
    if (!first || !second) return;
    list[index] = second;
    list[index + direction] = first;
  });
}

/**
 * Remove a label of the user: the values already typed stay in the cards.
 * @param id - Custom label id.
 */
export function removeCustomLabel(id: string): void {
  updateSettings((settings) => {
    const list = settings.memberCustom ?? [];
    const index = list.findIndex((item) => item.id === id);
    if (index !== -1) list.splice(index, 1);
  });
}
