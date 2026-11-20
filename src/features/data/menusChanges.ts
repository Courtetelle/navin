/**
 * What the skipper changed in the menus on this device since a starting
 * point (the first look, or the last « repartir de zéro » once the changes
 * were taken into NavIn): items added, removed or renamed in each list, and
 * the buttons changed with the pencil. Shown in Sauvegarde et
 * synchronisation, and left on the relay with the menus.
 */

import { store } from '../../storage/store.ts';

import type { MenusFile } from './menusExport.ts';
import { menusFile } from './menusExport.ts';

/** One item of a list: where, its id, its words. */
interface MenuItem {
  list: string;
  id: string;
  label: string;
  /** Its place in the list (items without an id are paired by it). */
  at?: number;
}

/** One change, ready to show. */
export interface MenuChange {
  kind: 'added' | 'removed' | 'renamed';
  list: string;
  said: string;
}

const BASE = 'ldb.menusBase';
const BASE_AT = 'ldb.menusBaseAt';

/** The names of the lists of a boat. */
const BOAT_LISTS: Record<string, string> = {
  checklistDep: 'Check-in',
  checklist: 'Check-out',
  checklistDepX: 'Check-in croisière',
  checklistX: 'Check-out croisière',
};

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Items of an array whose elements carry words (label, name or text). */
function itemsOf(list: string, value: unknown): MenuItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry: unknown, at) => {
    if (!entry || typeof entry !== 'object') return [];
    const one = entry as Record<string, unknown>;
    const label = text(one.label) || text(one.name) || text(one.text);
    if (!label) return [];
    return [{ list, id: text(one.id) || label, label, at }];
  });
}

/**
 * Every item of the menus, each in its named list.
 * @param file - The menus.
 * @returns The items.
 */
export function menuItems(file: MenusFile): MenuItem[] {
  const items: MenuItem[] = [];
  for (const boat of file.boats) {
    const lists = boat.lists;
    const named = new Map(
      itemsOf('', lists.ckLists).map((one) => [one.id, one.label]),
    );
    const name = boat.name || boat.id;
    items.push(...itemsOf(`${name} › Listes`, lists.ckLists));
    for (const [key, value] of Object.entries(lists)) {
      const title = key.startsWith('ckx_')
        ? `Liste « ${named.get(key.slice(4)) ?? key.slice(4)} »`
        : BOAT_LISTS[key];
      if (title) items.push(...itemsOf(`${name} › ${title}`, value));
    }
  }
  for (const base of Array.isArray(file.bases) ? file.bases : []) {
    const one = base as { name?: unknown; items?: unknown };
    items.push(...itemsOf(`Base « ${text(one.name)} »`, one.items));
  }
  const sea = (file.seaTemplate ?? {}) as Record<string, unknown>;
  items.push(
    ...itemsOf('Modèle mer › Check-in', sea.checklistDep),
    ...itemsOf('Modèle mer › Check-out', sea.checklist),
    ...itemsOf(
      'Tâches à bord',
      (file.taskTemplates as { tasks?: unknown } | null)?.tasks,
    ),
  );
  const wx = (file.weatherChecks ?? {}) as Record<string, unknown>;
  items.push(
    ...itemsOf('Météo avant de partir › lac', wx.lac),
    ...itemsOf('Météo avant de partir › mer', wx.mer),
  );
  const buttons = (file.buttons ?? {}) as Record<
    string,
    Record<string, unknown>
  >;
  for (const [key, edit] of Object.entries(buttons)) {
    const was = text(edit.orig) || key;
    const now = [text(edit.label), text(edit.sub)].filter(Boolean).join(' · ');
    const shape = [text(edit.size), text(edit.view)].filter(Boolean).join(', ');
    items.push({
      list: 'Boutons modifiés (crayon)',
      id: key,
      label: `${was} → ${now || was}${shape ? ` (${shape})` : ''}`,
    });
  }
  return items;
}

function keyOf(item: MenuItem): string {
  return `${item.list}\u0000${item.id}`;
}

/**
 * The changes since the starting point; the first call sets it.
 * @param file - The menus now (read from the device when not given).
 * @returns The changes, by list.
 */
export function menusChanges(file: MenusFile = menusFile()): MenuChange[] {
  const now = menuItems(file);
  const base = store.get<MenuItem[] | null>(BASE, null);
  if (!base) {
    store.set(BASE, now);
    store.set(BASE_AT, Date.now());
    return [];
  }
  const before = new Map(base.map((item) => [keyOf(item), item]));
  const after = new Map(now.map((item) => [keyOf(item), item]));
  const changes: MenuChange[] = [];
  const added = [...after].filter(([key]) => !before.has(key));
  const removed = [...before].filter(([key]) => !after.has(key));
  // An item without an id, changed in place: renamed, not removed and added.
  for (const [newKey, item] of added) {
    const pair = removed.find(
      ([, old]) =>
        old.list === item.list &&
        old.at !== undefined &&
        old.at === item.at &&
        old.id === old.label &&
        item.id === item.label,
    );
    if (!pair) continue;
    removed.splice(removed.indexOf(pair), 1);
    before.delete(pair[0]);
    after.delete(newKey);
    changes.push({
      kind: 'renamed',
      list: item.list,
      said: `${pair[1].label} → ${item.label}`,
    });
  }
  for (const [key, item] of after) {
    const old = before.get(key);
    if (!old) {
      changes.push({ kind: 'added', list: item.list, said: item.label });
    } else if (old.label !== item.label) {
      changes.push({
        kind: 'renamed',
        list: item.list,
        said: `${old.label} → ${item.label}`,
      });
    }
  }
  for (const [key, item] of before) {
    if (!after.has(key)) {
      changes.push({ kind: 'removed', list: item.list, said: item.label });
    }
  }
  return changes.toSorted((one, two) => one.list.localeCompare(two.list, 'fr'));
}

/** The changes are taken into NavIn (or left aside): start again from here. */
export function resetMenusChanges(): void {
  store.set(BASE, menuItems(menusFile()));
  store.set(BASE_AT, Date.now());
}

/**
 * Since when the changes are counted.
 * @returns The time, or 0 before the first look.
 */
export function menusChangesSince(): number {
  return store.get<number>(BASE_AT, 0);
}
