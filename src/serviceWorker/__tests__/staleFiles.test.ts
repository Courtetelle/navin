import { expect, test } from 'vitest';

import { staleFiles } from '../staleFiles.ts';

const base = 'https://example.org/navin/sw.js';

test('keeps the files of the build and returns the others', () => {
  const cached = [
    new Request('https://example.org/navin/'),
    new Request('https://example.org/navin/index.html'),
    new Request('https://example.org/navin/assets/index-new.js'),
    new Request('https://example.org/navin/assets/index-old.js'),
  ];
  const stale = staleFiles(
    cached,
    ['./', 'index.html', 'assets/index-new.js'],
    base,
  );
  expect(stale.map((request) => request.url)).toStrictEqual([
    'https://example.org/navin/assets/index-old.js',
  ]);
});

test('a file with a query string is not a file of the build', () => {
  const stale = staleFiles(
    [new Request('https://example.org/navin/index.html?source=pwa')],
    ['index.html'],
    base,
  );
  expect(stale).toHaveLength(1);
});
