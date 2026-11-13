import { signal } from '@preact/signals-react';

import { dayKey, uid } from '../lib/format.ts';
import type { WeatherCheck } from '../model/weatherChecks.ts';
import { weatherChecks } from '../model/weatherChecks.ts';
import { store } from '../storage/store.ts';

const TICK_KEY = 'ldb.wx.checks';
const LIST_KEY = 'ldb.wx.list';

/** The weather checks ticked, for one day. */
interface Ticked {
  day: string;
  ids: string[];
}

/** The weather checks as edited with the pencil, for the lake and the sea. */
type Lists = Partial<Record<'lac' | 'mer', WeatherCheck[]>>;

const ticked = signal<Ticked>(
  store.get<Ticked>(TICK_KEY, { day: '', ids: [] }),
);
const lists = signal<Lists>(store.get<Lists>(LIST_KEY, {}));

const zoneOf = (lake: boolean): 'lac' | 'mer' => (lake ? 'lac' : 'mer');

/**
 * The weather checks of the lake or of the sea: as edited, else the default.
 * @param lake - On a lake.
 * @returns The checks, in order.
 */
export function wxChecks(lake: boolean): WeatherCheck[] {
  return lists.value[zoneOf(lake)] ?? weatherChecks(lake);
}

/**
 * Change the weather checks of the lake or of the sea.
 * @param lake - On a lake.
 * @param checks - The new list; null goes back to the default one.
 */
export function setWxChecks(
  lake: boolean,
  checks: WeatherCheck[] | null,
): void {
  const next = { ...lists.peek() };
  if (checks) next[zoneOf(lake)] = checks;
  else Reflect.deleteProperty(next, zoneOf(lake));
  lists.value = next;
  store.set(LIST_KEY, next);
}

/**
 * A new check, with its own id.
 * @param text - Its text.
 * @returns The check.
 */
export function newWxCheck(text: string): WeatherCheck {
  return { id: `wx${uid()}`, text };
}

/**
 * The checks ticked today.
 * @returns Their ids.
 */
export function wxTicked(): string[] {
  const value = ticked.value;
  return value.day === dayKey(new Date()) ? value.ids : [];
}

/**
 * Tick or untick a weather check, for today.
 * @param id - The check.
 */
export function toggleWxCheck(id: string): void {
  const ids = wxTicked();
  const next: Ticked = {
    day: dayKey(new Date()),
    ids: ids.includes(id) ? ids.filter((one) => one !== id) : [...ids, id],
  };
  ticked.value = next;
  store.set(TICK_KEY, next);
}

/**
 * How far the weather check is today: nothing, started, or every check done.
 * @param lake - On a lake.
 * @returns The state, which colours the Météo button.
 */
export function wxCheckState(lake: boolean): 'none' | 'part' | 'ok' {
  const checks = wxChecks(lake);
  const ids = wxTicked();
  const done = checks.filter((check) => ids.includes(check.id)).length;
  if (checks.length > 0 && done === checks.length) return 'ok';
  return done > 0 ? 'part' : 'none';
}
