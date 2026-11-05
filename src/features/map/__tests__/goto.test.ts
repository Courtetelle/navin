import { expect, test } from 'vitest';

import { gotoTexts } from '../goto.ts';
import { marksGpx, marksText } from '../marksText.ts';
import { bearingText, distanceText } from '../relativeText.ts';

const target = { lat: 46.5, lon: 6.5, name: 'M001' };

test('bearingText pads to three digits and wraps at 360', () => {
  expect(bearingText(45.2)).toBe('045°');
  expect(bearingText(359.6)).toBe('000°');
});

test('distanceText switches to metres under 0.1 NM', () => {
  expect(distanceText(0.05)).toBe('93 m');
  expect(distanceText(2.34)).toBe('2,3 NM');
});

test('gotoTexts waits for a position', () => {
  expect(gotoTexts(target, null)).toStrictEqual({
    name: 'M001',
    waiting: true,
    distance: '',
    bearing: '',
    tail: '',
  });
});

test('gotoTexts gives the correction and the time left', () => {
  const texts = gotoTexts(target, { lat: 46.4, lon: 6.5, sog: 5, cog: 20 });
  expect(texts.distance).toBe('6,0 NM');
  expect(texts.bearing).toBe('000°');
  expect(texts.tail).toBe(' · à gauche 20° · 1 h 17');
});

test('gotoTexts says straight ahead within 5°', () => {
  const texts = gotoTexts(target, { lat: 46.4, lon: 6.5, sog: 5, cog: 2 });
  expect(texts.tail.startsWith(' · droit devant')).toBe(true);
});

test('gotoTexts stays short when the boat stands still', () => {
  const texts = gotoTexts(target, { lat: 46.4, lon: 6.5, sog: 0.2, cog: 2 });
  expect(texts.tail).toBe('');
});

const marks = [
  {
    id: 'm',
    n: 1,
    name: 'M001',
    at: '2026-07-15T08:40:00.000Z',
    lat: 46.5,
    lon: 6.5,
    depth: '≈ 3 m',
    note: 'a&b',
  },
];

test('marksGpx writes one waypoint per mark', () => {
  expect(marksGpx(marks)).toBe(
    '<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="NavIn" xmlns="http://www.topografix.com/GPX/1/1">\n<wpt lat="46.5" lon="6.5"><time>2026-07-15T08:40:00.000Z</time><name>M001</name><desc>a&amp;b</desc></wpt>\n</gpx>',
  );
});

test('marksText writes one line per mark', () => {
  expect(marksText(marks)).toContain('M001 (a&b) · 15/07/2026 08:40 UTC · ');
  expect(marksText(marks).endsWith(' · ≈ 3 m')).toBe(true);
});
