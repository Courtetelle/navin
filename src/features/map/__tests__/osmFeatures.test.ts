import { expect, test } from 'vitest';

import type { OsmFeature } from '../osmFeatures.ts';
import { osmToFeats, seamarkColour, seamarkPopup } from '../osmFeatures.ts';

test('osmToFeats classifies nodes, ways and relations', () => {
  const features = osmToFeats([
    {
      type: 'node',
      lat: 46.123_456,
      lon: 6.654_321,
      tags: { 'seamark:type': 'light_minor', name: 'Feu', foo: 'bar' },
    },
    {
      type: 'way',
      tags: Object.fromEntries([['man_made', 'pier']]),
      geometry: [
        { lat: 46, lon: 6 },
        { lat: 46.1, lon: 6 },
        { lat: 46.1, lon: 6.1 },
        { lat: 46, lon: 6 },
      ],
    },
    {
      type: 'way',
      tags: { leisure: 'marina' },
      geometry: [
        { lat: 46, lon: 6 },
        { lat: 46.1, lon: 6 },
        { lat: 46.1, lon: 6.1 },
        { lat: 46, lon: 6 },
      ],
    },
    {
      type: 'way',
      tags: { amenity: 'ferry_terminal' },
      geometry: [
        { lat: 46, lon: 6 },
        { lat: 46.2, lon: 6.2 },
      ],
    },
    {
      type: 'relation',
      tags: { natural: 'water' },
      members: [
        { role: 'outer', geometry: [{ lat: 46, lon: 6 }] },
        { role: 'inner', geometry: [{ lat: 47, lon: 7 }] },
      ],
    },
  ]);
  expect(features.map((feature) => [feature.k, feature.g])).toStrictEqual([
    ['light_minor', 'p'],
    ['pier', 'l'],
    ['harbour', 'a'],
    ['ferry', 'p'],
    ['other', 'm'],
  ]);
  expect(features[0]?.c).toStrictEqual([46.123_46, 6.654_32]);
  expect(features[0]?.t).toStrictEqual({
    'seamark:type': 'light_minor',
    name: 'Feu',
  });
  expect(features[3]?.c).toStrictEqual([46.1, 6.1]);
  expect(features[4]?.c).toStrictEqual([[[46, 6]]]);
});

test('seamarkColour reads the colours of the type, then of the light', () => {
  expect(
    seamarkColour({
      'seamark:type': 'buoy_lateral',
      'seamark:buoy_lateral:colour': 'red;white;mauve',
    }),
  ).toStrictEqual(['#d40000', '#ffffff']);
  expect(
    seamarkColour({
      'seamark:type': 'beacon_special_purpose',
      'seamark:light:colour': 'green',
    }),
  ).toStrictEqual(['#008a2e']);
  expect(seamarkColour({})).toBeNull();
});

test('seamarkPopup writes the name, the kind and the light', () => {
  const feature: OsmFeature = {
    k: 'light_minor',
    g: 'p',
    c: [46, 6],
    t: {
      'seamark:type': 'light_minor',
      name: 'Rolle',
      'seamark:light:character': 'Fl',
      'seamark:light:group': '2',
      'seamark:light:colour': 'white',
      'seamark:light:period': '5',
      ref: 'A1',
    },
  };
  expect(seamarkPopup(feature)).toBe(
    '<b>Rolle</b><br>Feu<br>Feu Fl(2) white 5 s<br>Réf. A1',
  );
});

test('seamarkPopup names a pier', () => {
  expect(seamarkPopup({ k: 'pier', g: 'l', c: [], t: {} })).toBe(
    '<b>Jetée</b>',
  );
});
