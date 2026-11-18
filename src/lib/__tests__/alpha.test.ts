import { expect, test } from 'vitest';

import { alphaKey, byAlpha } from '../alpha.ts';

test('titles are sorted by their words, emoji and accents aside', () => {
  expect(alphaKey('🧭 Zone et écran')).toBe('Zone et écran');
  expect(
    [
      '🧭 Zone',
      '👥 Équipages',
      '⚡ Alertes orage',
      '📅 Journée',
      'Paramétrage',
    ].toSorted(byAlpha),
  ).toStrictEqual([
    '⚡ Alertes orage',
    '👥 Équipages',
    '📅 Journée',
    'Paramétrage',
    '🧭 Zone',
  ]);
});
