import { beforeEach, expect, test } from 'vitest';

import { initState } from '../../state/index.ts';
import { createMemoryStorage } from '../../storage/memoryStorage.ts';
import { inMenu, menuButtonPress, openMenu } from '../menuOwner.ts';
import { go, goBackInHistory, navigation } from '../router.ts';

beforeEach(() => {
  initState(createMemoryStorage({}));
  openMenu.value = null;
  go('tracker');
});

const press = () => menuButtonPress('more', goBackInHistory);

test('a menu button opens its menu, goes back one step, then out', () => {
  go('marks');
  press();
  expect(navigation.value.view).toBe('more');
  expect(inMenu('more')).toBe(true);
  go('cartes');
  expect(inMenu('more')).toBe(true);
  press();
  expect(navigation.value.view).toBe('more');
  press();
  expect(navigation.value.view).toBe('marks');
  expect(inMenu('more')).toBe(false);
});

test('another main screen closes the menu', () => {
  press();
  go('cartes');
  go('sos');
  expect(inMenu('more')).toBe(false);
});
