import { expect, test } from 'vitest';

import { distNM } from '../../../lib/geo.ts';
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

const kmPerLon = (lat: number) => 111.32 * Math.cos((lat * Math.PI) / 180);

test('on an alignment the distance starts from the shore of the waters', () => {
  const french = onAxis(0.75);
  expect(inFrenchLeman(french)).toBe(true);
  expect(sosPlaceWords(french)).toMatch(
    /^Nous nous situons sur l’alignement entre Évian et Ouchy, à \d,\d km de distance d’Évian · eaux françaises$/u,
  );
  const swiss = onAxis(0.3);
  expect(inFrenchLeman(swiss)).toBe(false);
  expect(sosPlaceWords(swiss)).toMatch(
    /^Nous nous situons sur l’alignement entre Ouchy et Évian, à \d,\d km de distance d’Ouchy · eaux suisses$/u,
  );
});

test('off the alignment it says how far and on which side first', () => {
  const { lat, lon } = onAxis(0.75);
  const west = lon - 0.8 / kmPerLon(lat);
  expect(sosPlaceWords({ lat, lon: west })).toMatch(
    /^Nous nous situons \d+ m à l’(?:est|ouest) de l’alignement entre .+ et .+, à .+ de distance .+ · eaux françaises$/u,
  );
});

test('the distance to the place is the true one, not along the alignment', () => {
  const { lat, lon } = onAxis(0.75);
  const away = { lat, lon: lon - 0.8 / kmPerLon(lat) };
  const km = distNM(away, { lat: EVIAN[0], lon: EVIAN[1] }) * 1.852;
  expect(sosPlaceWords(away)).toContain(
    `à ${km.toFixed(1).replace('.', ',')} km de distance d’Évian`,
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
