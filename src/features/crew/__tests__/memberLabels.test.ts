import { beforeEach, expect, test } from 'vitest';

import { MEMBER_FIELDS } from '../../../model/crewFields.ts';
import { initState, state } from '../../../state/index.ts';
import { createMemoryStorage } from '../../../storage/memoryStorage.ts';
import { store } from '../../../storage/store.ts';
import {
  addCustomLabel,
  ensureCustomLabels,
  moveCustomLabel,
  removeCustomLabel,
  renameCustomLabel,
  renameMemberLabel,
} from '../memberLabels.ts';

const field = MEMBER_FIELDS.find((item) => item.key === 'nationalite');

beforeEach(() => {
  initState(createMemoryStorage());
});

function custom() {
  return state.preferences.settings.value.memberCustom?.map(
    (item) => item.label,
  );
}

test('a label equal to the original one or empty removes the renaming', () => {
  if (!field) throw new Error('no field');

  renameMemberLabel(field, 'Pays');
  expect(state.preferences.settings.value.memberAlias).toStrictEqual({
    nationalite: 'Pays',
  });

  renameMemberLabel(field, 'Nationalité');
  expect(state.preferences.settings.value.memberAlias).toStrictEqual({});

  renameMemberLabel(field, 'Pays');
  renameMemberLabel(field, '');
  expect(state.preferences.settings.value.memberAlias).toStrictEqual({});
});

test('the list of the user labels exists once the mode opened, not saved yet', () => {
  ensureCustomLabels();

  expect(state.preferences.settings.value.memberCustom).toStrictEqual([]);
  expect(
    store.get<{ memberCustom?: unknown }>('ldb.settings', {}).memberCustom,
  ).toBeUndefined();
});

test('user labels are added, renamed, moved and removed', () => {
  const first = addCustomLabel('Club');
  const second = addCustomLabel('Gilet');

  renameCustomLabel(first, '');
  expect(custom()).toStrictEqual(['Club', 'Gilet']);

  renameCustomLabel(first, 'Mon club');
  moveCustomLabel(second, -1);
  expect(custom()).toStrictEqual(['Gilet', 'Mon club']);

  moveCustomLabel(second, -1);
  expect(custom()).toStrictEqual(['Gilet', 'Mon club']);

  removeCustomLabel(second);
  expect(custom()).toStrictEqual(['Mon club']);
});
