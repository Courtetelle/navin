import { signal } from '@preact/signals-react';

import { byAlpha } from '../../lib/alpha.ts';
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

/** How a menu or a list is sorted: alphabetical, or by the use of its entries. */
export type MenuSort = 'alpha' | 'use';
/** The menus and lists that can be sorted. */
export type SortedMenu =
  'data' | 'settings' | 'boats' | 'people' | 'crews' | 'sites' | 'marks';

/** The order chosen for each menu, kept on the device (`ldb.menuSort`). */
export const menuSort = signal<Readonly<Partial<Record<SortedMenu, MenuSort>>>>(
  store.get<Partial<Record<SortedMenu, MenuSort>>>('ldb.menuSort', {}),
);

/**
 * The order of a menu: alphabetical unless chosen otherwise.
 * @param menu - The menu.
 * @returns Its order.
 */
export function sortOf(menu: SortedMenu): MenuSort {
  return menuSort.value[menu] ?? 'alpha';
}

/**
 * Turn a menu to the other order, kept until the next change.
 * @param menu - The menu.
 */
export function toggleMenuSort(menu: SortedMenu): void {
  const next = {
    ...menuSort.value,
    [menu]: sortOf(menu) === 'alpha' ? 'use' : 'alpha',
  };
  menuSort.value = next;
  store.set('ldb.menuSort', next);
}

/** Orders learnt from use, by menu (`ldb.menuOrders`); data keeps `ldb.dataOrder`. */
export const menuOrders = signal<
  Readonly<Partial<Record<SortedMenu, readonly string[]>>>
>(store.get<Partial<Record<SortedMenu, string[]>>>('ldb.menuOrders', {}));

/**
 * The order learnt from the use of a menu.
 * @param menu - The menu.
 * @returns Keys, the most used first.
 */
export function usedOrder(menu: SortedMenu): readonly string[] {
  return menu === 'data' ? dataOrder.value : (menuOrders.value[menu] ?? []);
}

/**
 * Note that an entry of a menu was opened: one rank up.
 * @param menu - The menu.
 * @param shown - Keys of the entries on screen, in order.
 * @param key - Key of the entry opened.
 */
export function bumpIn(
  menu: SortedMenu,
  shown: readonly string[],
  key: string,
): void {
  if (menu === 'data') {
    bumpTile(shown, key);
    return;
  }
  const order = bumpedOrder(shown, key, usedOrder(menu));
  if (!order) return;
  const next = { ...menuOrders.value, [menu]: order };
  menuOrders.value = next;
  store.set('ldb.menuOrders', next);
}

/**
 * Entries in the order chosen for their menu.
 * @param menu - The menu.
 * @param entries - The entries, in their own order.
 * @param keyOf - The key of an entry.
 * @param titleOf - Its title, in the language shown.
 * @returns The entries sorted.
 */
export function inMenuOrder<Entry>(
  menu: SortedMenu,
  entries: readonly Entry[],
  keyOf: (entry: Entry) => string,
  titleOf: (entry: Entry) => string,
): Entry[] {
  if (sortOf(menu) === 'alpha') {
    return entries.toSorted((first, second) =>
      byAlpha(titleOf(first), titleOf(second)),
    );
  }
  return sortTiles(
    entries.map((entry) => ({ key: keyOf(entry), entry })),
    usedOrder(menu),
  ).map(({ entry }) => entry);
}
