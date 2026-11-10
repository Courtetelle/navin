import type { FunctionEntry } from '../../shell/search/searchIndex.ts';
import { store } from '../../storage/store.ts';

/** Which column of buttons, beside the map on a landscape tablet. */
export type RailSide = 'left' | 'right';

/** The buttons of both columns: a function key, or '' for a free place. */
export interface Rails {
  left: string[];
  right: string[];
}

/** Places in each column. */
export const RAIL_SLOTS = 6;
const RAILS_KEY = 'ldb.rails';

/** Actions on the map itself, beside the screens of the app. */
export const MAP_ACTIONS: readonly FunctionEntry[] = [
  { key: 'act:zoomin', title: '➕ Zoom avant', sub: 'carte agrandir' },
  { key: 'act:zoomout', title: '➖ Zoom arrière', sub: 'carte réduire' },
  { key: 'act:locate', title: '📍 Bateau', sub: 'centrer position gps' },
];

/** The columns of a first start, to show the idea. */
export const DEFAULT_RAILS: Rails = {
  left: ['weather', 'meteo', 'act:zoomin', 'act:zoomout', '', ''],
  right: ['marks', 'vhf', 'mob', '', '', ''],
};

function fit(keys: unknown): string[] {
  const list = Array.isArray(keys)
    ? keys.map((key) => (typeof key === 'string' ? key : ''))
    : [];
  return Array.from({ length: RAIL_SLOTS }, (_, index) => list[index] ?? '');
}

/**
 * The columns kept on this device.
 * @returns Both columns, each of {@link RAIL_SLOTS} places.
 */
export function loadRails(): Rails {
  const kept = store.get<Partial<Rails> | null>(RAILS_KEY, null);
  if (!kept) return DEFAULT_RAILS;
  return { left: fit(kept.left), right: fit(kept.right) };
}

/**
 * The columns with one place changed, kept on this device.
 * @param rails - The columns now.
 * @param side - The column.
 * @param index - The place in it.
 * @param key - The function put there, '' to free it.
 * @returns The new columns.
 */
export function setRail(
  rails: Rails,
  side: RailSide,
  index: number,
  key: string,
): Rails {
  const column = fit(rails[side]);
  column[index] = key;
  const next = { ...rails, [side]: column };
  store.set(RAILS_KEY, next);
  return next;
}

/**
 * The icon and the words of a function title such as '🌤 Météo'.
 * @param title - The title, its icon first.
 * @returns The icon ('' if none) and the label.
 */
export function splitTitle(title: string): { icon: string; label: string } {
  const space = title.indexOf(' ');
  if (space <= 0 || /[\p{L}\p{N}]/u.test(title.slice(0, space))) {
    return { icon: '', label: title };
  }
  return { icon: title.slice(0, space), label: title.slice(space + 1) };
}
