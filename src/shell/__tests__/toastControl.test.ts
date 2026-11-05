import { expect, test } from 'vitest';

import {
  hideToast,
  showToastText,
  toastDisplay,
  toastDuration,
  toastLines,
} from '../toastControl.ts';

test('a bubble stays the time of a normal reading', () => {
  expect(toastDuration('Lien copié')).toBe(2500);
  expect(toastDuration('un deux trois quatre cinq six')).toBe(3300);
  expect(
    toastDuration(Array.from({ length: 100 }, () => 'mot').join(' ')),
  ).toBe(25_000);
});

test('one idea per line', () => {
  expect(toastLines('Trace démarrée · complétez plus tard · merci')).toBe(
    'Trace démarrée\ncomplétez plus tard\nmerci',
  );
});

test('hiding keeps the text, like legacy', () => {
  showToastText('Bonjour', 2500, false);
  hideToast();
  expect(toastDisplay.value).toStrictEqual({
    text: 'Bonjour',
    shown: false,
    top: false,
    duration: 2500,
  });
});
