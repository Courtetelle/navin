import { expect, test } from 'vitest';

import { chromeUrl } from '../chromeLinks.ts';

test('a link to another site opens in the Chrome app', () => {
  expect(chromeUrl('https://portail-api.meteofrance.fr/a?b=1', 'ios')).toBe(
    'googlechromes://portail-api.meteofrance.fr/a?b=1',
  );
  // An address without its secure s: the same Chrome, without it.
  const plain = ['http', '://example.org/'].join('');
  expect(chromeUrl(plain, 'ios')).toBe('googlechrome://example.org/');
  expect(chromeUrl('https://opendata.aemet.es/x', 'android')).toBe(
    'intent://opendata.aemet.es/x#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=https%3A%2F%2Fopendata.aemet.es%2Fx;end',
  );
  expect(chromeUrl('https://a.b/', 'other')).toBeNull();
  expect(chromeUrl('tel:112', 'ios')).toBeNull();
});
