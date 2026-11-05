import { afterEach, beforeEach, expect, test } from 'vitest';

import { initState, state } from '../../state/index.ts';
import { createMemoryStorage } from '../../storage/memoryStorage.ts';
import {
  clearHistory,
  go,
  goBackInHistory,
  goFromGear,
  historySnapshot,
  navigation,
  routedTab,
  voyageName,
} from '../router.ts';

beforeEach(() => {
  initState(createMemoryStorage({}));
  clearHistory();
  state.view.currentView.value = 'new';
});
afterEach(clearHistory);

test('non-root screens are pushed, root screens clear the history', () => {
  go('more');
  go('boats');
  go('dossier');
  expect(historySnapshot()).toStrictEqual(['more', 'boats']);
  go('dossier');
  expect(historySnapshot()).toStrictEqual(['more', 'boats']);
  go('sos');
  expect(historySnapshot()).toStrictEqual([]);
});

test('back pops the history, else goes to the parent screen', () => {
  go('more');
  go('boats');
  go('dossier');
  goBackInHistory();
  expect(state.view.currentView.value).toBe('boats');
  expect(historySnapshot()).toStrictEqual(['more']);
  goBackInHistory();
  expect(state.view.currentView.value).toBe('more');
  goBackInHistory();
  expect(state.view.currentView.value).toBe('tracker');
});

test('every go remounts the page and records where it came from', () => {
  go('boats', 'b1');
  const first = navigation.value;
  go('boats', 'b1');
  expect(navigation.value.id).toBe(first.id + 1);
  expect(navigation.value).toStrictEqual({
    id: first.id + 1,
    view: 'boats',
    arg: 'b1',
    from: 'boats',
  });
  expect(state.view.viewArg.value).toBe('b1');
});

test('without a cruise, the logbook redirects to nonav and lights its tab', () => {
  go('new');
  expect(state.view.currentView.value).toBe('nonav');
  expect(state.view.viewArg.value).toBe('new');
  expect(routedTab.value).toBe('tracker');
  expect(voyageName.value).toBe('NavIn');
});

test('the gear opens the settings of the screen, a second tap goes back', () => {
  go('vhf');
  goFromGear();
  expect(state.view.currentView.value).toBe('settings');
  expect(state.view.settingsFrom.value).toBe('vhf');
  expect(routedTab.value).toBe('tracker');
  goFromGear();
  expect(state.view.currentView.value).toBe('vhf');
  go('settings');
  expect(state.view.settingsFrom.value).toBeNull();
  expect(routedTab.value).toBe('more');
});

test('the alphabet remembers the safety screen it was opened from', () => {
  go('sos');
  go('alpha');
  expect(state.view.alphaBack.value).toBe('sos');
  expect(routedTab.value).toBe('sos');
  go('boats');
  go('alpha');
  expect(state.view.alphaBack.value).toBe('more');
  expect(routedTab.value).toBe('more');
});
