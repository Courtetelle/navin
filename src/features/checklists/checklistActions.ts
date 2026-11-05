import { dayKey } from '../../lib/format.ts';
import { modeOf } from '../../model/modes.ts';
import type { ChecklistItem, Cruise, Day } from '../../model/types.ts';
import { updateCruise } from '../../state/index.ts';

import { checkDone, ckOpen } from './checklistProgress.ts';

/**
 * Write the value of an item and save the cruise (legacy `setCkVal` + `saveCruise`).
 * @param item - Checklist item.
 * @param value - Value, empty to remove it.
 */
export function saveCkVal(item: ChecklistItem, value: string): void {
  updateCruise((cruise) => {
    writeCkVal(cruise, item, value);
  });
}

/**
 * Short tap on a white item: it turns orange (not done: value, photo).
 * @param id - Item id.
 */
export function markItemOpen(id: string): void {
  const open = ckOpen();
  open.add(id);
  updateHolder((holder) => {
    writeSet(holder, 'ckOpen', open);
  });
}

/**
 * Long press on a white or orange item: it turns green (done).
 * @param id - Item id.
 */
export function markItemDone(id: string): void {
  const done = checkDone();
  done.add(id);
  const open = ckOpen();
  open.delete(id);
  updateHolder((holder) => {
    writeSet(holder, 'checkDone', done);
    writeSet(holder, 'ckOpen', open);
  });
}

/**
 * Long press on a green item: back to white, value and photos kept.
 * @param id - Item id.
 */
export function markItemTodo(id: string): void {
  const done = checkDone();
  done.delete(id);
  const open = ckOpen();
  open.delete(id);
  updateHolder((holder) => {
    writeSet(holder, 'checkDone', done);
    writeSet(holder, 'ckOpen', open);
  });
}

/**
 * Restart an item: white, without its value.
 * @param item - Checklist item.
 */
export function clearItem(item: ChecklistItem): void {
  markItemTodo(item.id);
  saveCkVal(item, '');
}

/**
 * Write the observations of a list, then save (legacy `obs[constatKey(list)] = value`).
 * @param key - `obsPrise` or `obsFin`.
 * @param value - Text.
 */
export function saveObservation(key: string, value: string): void {
  updateHolder((holder) => {
    holder[key] = value;
  });
}

/**
 * Write a reading of today's sheet, then save.
 * @param key - Day key of the reading.
 * @param value - Value.
 */
export function saveReading(key: string, value: string): void {
  const today = dayKey(new Date());
  updateCruise((cruise) => {
    const day = dayOf(cruise, today);
    day[key] = value;
    if (day._auto) Reflect.deleteProperty(day._auto, key);
  });
}

function updateHolder(recipe: (holder: Day | Cruise) => void): void {
  const today = dayKey(new Date());
  updateCruise((cruise) => {
    recipe(modeOf(cruise) === 'lacj' ? dayOf(cruise, today) : cruise);
  });
}

function dayOf(cruise: Cruise, key: string): Day {
  cruise.days[key] ??= {};
  return cruise.days[key];
}

function writeSet(
  holder: Day | Cruise,
  key: 'checkDone' | 'ckOpen',
  values: ReadonlySet<string>,
): void {
  if (values.size > 0) holder[key] = [...values];
  else Reflect.deleteProperty(holder, key);
}

function writeCkVal(cruise: Cruise, item: ChecklistItem, value: string): void {
  const today = dayKey(new Date());
  if (item.key) {
    const day = dayOf(cruise, today);
    if (value) day[item.key] = value;
    else Reflect.deleteProperty(day, item.key);
    if (day._auto) Reflect.deleteProperty(day._auto, item.key);
    return;
  }
  const holder = modeOf(cruise) === 'lacj' ? dayOf(cruise, today) : cruise;
  holder.ckVals ??= {};
  const values = holder.ckVals as Record<string, string>;
  if (value) values[item.id] = value;
  else Reflect.deleteProperty(values, item.id);
}
