import { expect, test } from 'vitest';

import { inFrenchLeman } from '../../../model/contacts.ts';
import {
  LEMAN_FRENCH_MARKS,
  LEMAN_LINES,
  LEMAN_MARKS,
} from '../sosPlaceMarks.ts';
import { sosPlaceWords } from '../sosPlaces.ts';

const OUCHY = LEMAN_MARKS.Ouchy as readonly [number, number];
const EVIAN = LEMAN_MARKS['Évian'] as readonly [number, number];

/**
 * A position on the axis Ouchy - Évian.
 * @param ratio - 0 at Ouchy, 1 at Évian.
 * @returns The position.
 */
function onAxis(ratio: number): { lat: number; lon: number } {
  return {
    lat: OUCHY[0] + (EVIAN[0] - OUCHY[0]) * ratio,
    lon: OUCHY[1] + (EVIAN[1] - OUCHY[1]) * ratio,
  };
}

test('on an axis the distance starts from the shore of the waters', () => {
  const french = onAxis(0.75);
  expect(inFrenchLeman(french)).toBe(true);
  expect(sosPlaceWords(french)).toBe(
    'Sur l’axe Évian – Ouchy, à 3 km d’Évian · eaux françaises',
  );
  const swiss = onAxis(0.3);
  expect(inFrenchLeman(swiss)).toBe(false);
  expect(sosPlaceWords(swiss)).toBe(
    'Sur l’axe Ouchy – Évian, à 3,6 km d’Ouchy · eaux suisses',
  );
});

test('off the axis it says the side, then the distance in brackets', () => {
  const { lat, lon } = onAxis(0.75);
  const west = lon - 0.8 / (111.32 * Math.cos((lat * Math.PI) / 180));
  expect(sosPlaceWords({ lat, lon: west })).toMatch(
    /^Sur l’axe .+ – .+, à .+, mais plus à l’(?:est|ouest) \(\d+ m\) · eaux françaises$/u,
  );
});

test('far from any axis the nearest mark is on the shore of the waters', () => {
  const words = sosPlaceWords({ lat: 46.2, lon: 6.11 });
  expect(words).toContain('eaux suisses');
});

test('every mark of an axis is known and the French ones are in the list', () => {
  for (const [first, second] of LEMAN_LINES) {
    expect(LEMAN_MARKS[first]).toBeDefined();
    expect(LEMAN_MARKS[second]).toBeDefined();
  }
  for (const name of LEMAN_FRENCH_MARKS) {
    expect(LEMAN_MARKS[name]).toBeDefined();
  }
});
