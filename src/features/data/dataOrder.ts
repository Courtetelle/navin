import { signal } from '@preact/signals-react';

import { store } from '../../storage/store.ts';

/** Order of the data tiles learnt from their use (`ldb.dataOrder`). */
export const dataOrder = signal<readonly string[]>(
  store.get<string[]>('ldb.dataOrder', []),
);

/**
 * Sort tiles by their learnt position; unknown tiles keep their place after
 * the known ones (legacy `dataTiles`).
 * @param tiles - Tiles in their default order.
 * @param order - Learnt order of the keys.
 * @returns The sorted tiles.
 */
export function sortTiles<Tile extends { key: string }>(
  tiles: readonly Tile[],
  order: readonly string[],
): Tile[] {
  const positions = tiles.map((tile, index) => {
    const position = order.indexOf(tile.key);
    return { tile, index, position: position === -1 ? 1000 + index : position };
  });
  return positions
    .toSorted(
      (first, second) =>
        first.position - second.position || first.index - second.index,
    )
    .map(({ tile }) => tile);
}

/**
 * Move a tile one rank up after its opening (legacy `dataBump`): the visible
 * tiles keep their order, the keys of hidden tiles follow.
 * @param shown - Keys of the tiles on screen, in order.
 * @param key - Key of the tile opened.
 * @param order - Learnt order.
 * @returns The new order, or null when the tile is already first.
 */
export function bumpedOrder(
  shown: readonly string[],
  key: string,
  order: readonly string[],
): string[] | null {
  const position = shown.indexOf(key);
  if (position <= 0) return null;
  const visible = [...shown];
  visible[position] = visible[position - 1] as string;
  visible[position - 1] = key;
  return [...visible, ...order.filter((item) => !visible.includes(item))];
}

/**
 * Note that a tile was opened and persist the order.
 * @param shown - Keys of the tiles on screen, in order.
 * @param key - Key of the tile opened.
 */
export function bumpTile(shown: readonly string[], key: string): void {
  const order = bumpedOrder(shown, key, dataOrder.value);
  if (!order) return;
  dataOrder.value = order;
  store.set('ldb.dataOrder', order);
}
