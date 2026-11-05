import { beforeEach, expect, test } from 'vitest';

import type { Cruise } from '../../../model/types.ts';
import { initState, setCruise, setDraft, state } from '../../../state/index.ts';
import { createMemoryStorage } from '../../../storage/memoryStorage.ts';
import { store } from '../../../storage/store.ts';
import {
  deleteEntry,
  editEntry,
  saveDraftAsEntry,
  setEntryValue,
} from '../entryActions.ts';
import { openDay, openDraft } from '../screens.ts';

const CRUISE: Cruise = {
  id: 'c1',
  created: '2026-07-14T07:00:00.000Z',
  info: { name: 'Test' },
  crew: [],
  entries: [
    { id: 'e1', t: '2026-07-15T08:00:00.000Z', v: { loch: 3 }, auto: true },
  ],
  days: {},
};

beforeEach(() => {
  initState(createMemoryStorage());
  setCruise(structuredClone(CRUISE));
  state.preferences.settings.value = {
    ...state.preferences.settings.value,
    prefill: true,
  };
});

test('a new form carries the last values and follows the clock', () => {
  openDraft();
  const draft = state.data.draft.value;
  expect(draft?.v).toStrictEqual({ loch: 3 });
  expect(draft?.prefilled).toBe(true);
  expect(store.get('ldb.draft.c1', null)).toStrictEqual(draft);
});

test('a time set by hand is kept when the form is reopened', () => {
  setDraft({ t: '2026-07-15T06:00:00.000Z', v: {}, tManual: true });
  openDraft();
  expect(state.data.draft.value?.t).toBe('2026-07-15T06:00:00.000Z');
});

test('values are set and cleared', () => {
  setDraft({ t: '2026-07-15T06:00:00.000Z', v: { a: 1 } });
  setEntryValue('b', 2);
  setEntryValue('a', null);
  setEntryValue('c', []);
  expect(state.data.draft.value?.v).toStrictEqual({ b: 2 });
});

test('saving a new draft adds a sorted entry and drops the draft', () => {
  setDraft({ t: '2026-07-15T06:00:00.000Z', v: { note: 'x' } });
  saveDraftAsEntry();
  const entries = state.data.cruise.value?.entries ?? [];
  expect(entries).toHaveLength(2);
  expect(entries[0]?.v).toStrictEqual({ note: 'x' });
  expect(entries[1]?.id).toBe('e1');
  expect(state.view.toast.value?.message).toBe(
    '✔ Entrée de 08:00 (06:00 UTC) enregistrée',
  );
  expect(store.get('ldb.draft.c1', null)).toStrictEqual(state.data.draft.value);
  expect(state.view.currentView.value).toBe('new');
});

test('editing an automatic entry keeps it automatic', () => {
  const entry = state.data.cruise.value?.entries[0];
  if (!entry) throw new Error('no entry');
  editEntry(entry);
  expect(state.data.draft.value).toStrictEqual({
    id: 'e1',
    t: entry.t,
    v: { loch: 3 },
    tManual: true,
  });
  setEntryValue('loch', 4);
  saveDraftAsEntry();
  expect(state.data.cruise.value?.entries).toStrictEqual([
    { id: 'e1', t: entry.t, v: { loch: 4 }, auto: true },
  ]);
  expect(state.view.toast.value?.message).toBe('✔ Entrée modifiée');
  expect(state.view.currentView.value).toBe('log');
});

test('deleting remembers the id', () => {
  deleteEntry('e1');
  const cruise = state.data.cruise.value;
  expect(cruise?.entries).toStrictEqual([]);
  expect(cruise?.deleted).toStrictEqual(['e1']);
  expect(state.view.toast.value?.message).toBe('Entrée supprimée');
});

test('opening a day remembers it and creates it', () => {
  openDay('2026-07-14');
  expect(state.view.currentDay.value).toBe('2026-07-14');
  expect(state.data.cruise.value?.days['2026-07-14']).toStrictEqual({});
  openDay(null);
  expect(state.view.currentDay.value).toBe('2026-07-14');
});
