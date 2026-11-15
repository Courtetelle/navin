import { expect, test } from 'vitest';

import { recordPoints } from '../liveRecorder.ts';

test('the GPS and the three zones are recorded, two close points once', () => {
  const zones = [
    { name: 'Lacs', lat: 46.45, lon: 6.55 },
    { name: 'Méditerranée', lat: 43.3, lon: 5.37 },
    { name: 'Atlantique', lat: 48.65, lon: -2.03 },
  ];
  expect(recordPoints(null, zones).map((point) => point.name)).toStrictEqual([
    'Lacs',
    'Méditerranée',
    'Atlantique',
  ]);
  // At Saint-Malo: the GPS stands for the Atlantic.
  expect(
    recordPoints({ lat: 48.64, lon: -2 }, zones).map((point) => point.name),
  ).toStrictEqual(['GPS', 'Lacs', 'Méditerranée']);
});
