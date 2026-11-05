import { expect, test } from 'vitest';

import { bumpedOrder, sortTiles } from '../dataOrder.ts';

const TILES = [{ key: 'a' }, { key: 'b' }, { key: 'c' }, { key: 'd' }];

function keys(order: readonly string[]): string[] {
  return sortTiles(TILES, order).map((tile) => tile.key);
}

test('tiles keep their order until they are used', () => {
  expect(keys([])).toStrictEqual(['a', 'b', 'c', 'd']);
});

test('known tiles come first, in the learnt order', () => {
  expect(keys(['c', 'a'])).toStrictEqual(['c', 'a', 'b', 'd']);
});

test('an opened tile moves one rank up', () => {
  expect(bumpedOrder(['a', 'b', 'c'], 'c', [])).toStrictEqual(['a', 'c', 'b']);
});

test('the keys of hidden tiles stay in the order', () => {
  expect(bumpedOrder(['a', 'b'], 'b', ['x', 'a', 'y'])).toStrictEqual([
    'b',
    'a',
    'x',
    'y',
  ]);
});

test('the first tile and an unknown tile change nothing', () => {
  expect(bumpedOrder(['a', 'b'], 'a', [])).toBeNull();
  expect(bumpedOrder(['a', 'b'], 'z', [])).toBeNull();
});
