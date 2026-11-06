import { expect, test } from 'vitest';

import { landmarkHtml } from '../landmarkLayer.ts';

test('a landmark says its name, kind and height, and escapes its text', () => {
  expect(landmarkHtml('Château de Chillon', 'Château')).toBe(
    '<b>Château de Chillon</b><br>Château',
  );
  expect(landmarkHtml('Tour <A>', 'Tour', 25)).toBe(
    '<b>Tour &lt;A></b><br>Tour · 25,0 m',
  );
  expect(landmarkHtml('Phare', 'Phare')).toBe('Phare');
});
