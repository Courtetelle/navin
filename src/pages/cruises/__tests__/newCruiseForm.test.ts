import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import {
  load,
  useHarnessClock,
} from '../../../features/data/__tests__/fixtures.ts';
import type { Cruise } from '../../../model/types.ts';
import { state } from '../../../state/index.ts';
import {
  enterForm,
  keepBoat,
  keepCrew,
  keptBoatName,
  nameText,
  nameWithKeptBoat,
  newPlace,
  newZone,
  placeSearching,
  placeText,
  redrawForm,
  resolveMode,
  zoneNow,
} from '../newCruiseForm.ts';

beforeEach(() => {
  useHarnessClock();
  newPlace.value = undefined;
  newZone.value = null;
  placeText.value = '';
  nameText.value = '';
});

afterEach(() => {
  vi.useRealTimers();
});

test('the mode follows the type asked, else the open cruise', () => {
  load('sample-lake');

  expect(resolveMode('lacc')).toBe('lacc');
  expect(resolveMode('lac')).toBe('lacj');
  expect(resolveMode(null)).toBe('lacj');
  expect(resolveMode('autre')).toBe('lacj');

  load('empty');

  expect(resolveMode(null)).toBe('mer');
});

test('the sea area is the one chosen, else the last used, else the Mediterranean', () => {
  load('empty');

  expect(zoneNow()).toBe('M');

  state.preferences.settings.value = {
    ...state.preferences.settings.value,
    lastZone: 'B',
  };

  expect(zoneNow()).toBe('B');

  newZone.value = 'A';

  expect(zoneNow()).toBe('A');
});

test('coming back to the screen forgets the typed name, not the place', () => {
  nameText.value = 'Ma croisière';
  newPlace.value = 'Split';
  keepCrew.value = true;

  enterForm(false, true);

  expect(nameText.value).toBe('');
  expect(placeText.value).toBe('Split');
  expect(keepCrew.value).toBe(false);
  expect(nameWithKeptBoat.value).toBe(false);
});

test('a place still searched announces the search', () => {
  newPlace.value = null;

  enterForm(false, false);

  expect(placeSearching.value).toBe(true);
  expect(placeText.value).toBe('');
});

test('a redraw keeps the typed name and trims the place', () => {
  nameText.value = 'Ma croisière';
  placeText.value = ' Split ';
  keepBoat.value = true;
  keepCrew.value = true;

  redrawForm(true);

  expect(nameText.value).toBe('Ma croisière');
  expect(newPlace.value).toBe('Split');
  expect(placeText.value).toBe('Split');
  expect(keepCrew.value).toBe(false);
  expect(nameWithKeptBoat.value).toBe(true);
});

test('the name counts the kept boat only if its button was on', () => {
  keepBoat.value = false;

  redrawForm(true);

  expect(nameWithKeptBoat.value).toBe(false);
  expect(keepBoat.value).toBe(true);

  redrawForm(false);

  expect(nameWithKeptBoat.value).toBe(false);
});

test('the boat of a lake outing is not taken over in the name', () => {
  const cruise = {
    type: 'lac',
    info: { boat: 'Savannah' },
  } as unknown as Cruise;
  const sea = { info: { boat: 'Mistral' } } as unknown as Cruise;

  expect(keptBoatName(cruise, true)).toBe('');
  expect(keptBoatName(sea, true)).toBe('Mistral');
  expect(keptBoatName(sea, false)).toBe('');
  expect(keptBoatName(null, true)).toBe('');
});
