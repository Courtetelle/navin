import { dayKey, stringOf } from '../../lib/format.ts';
import { CK_DEFS } from '../../model/modes.ts';
import type { ChecklistItem, Cruise, Day } from '../../model/types.ts';
import { curMode, getDay, state } from '../../state/index.ts';

import {
  checklistOwner,
  ckName,
  ckProp,
  ownerItems,
} from './checklistOwner.ts';

/**
 * Items of a list; without list, the two built-in lists only: the banner does
 * not count the free lists (legacy `checkItems`).
 * @param list - List id.
 * @returns The items, none without open cruise.
 */
export function checkItems(list?: string | null): readonly ChecklistItem[] {
  if (!state.data.cruise.value) return [];
  const owner = checklistOwner();
  if (list) return ownerItems(owner, ckProp(list));
  return CK_DEFS[curMode()].flatMap(([, property]) =>
    ownerItems(owner, property),
  );
}

/**
 * Ids done: for the day on a lake day outing, for the whole cruise otherwise
 * (legacy `checkDone`).
 * @returns A new set.
 */
export function checkDone(): Set<string> {
  return new Set(checklistHolder()?.checkDone);
}

/**
 * Items left in a list (legacy `checkLeft`).
 * @param list - List id, both built-in lists by default.
 * @returns The items not done.
 */
export function checkLeft(list?: string | null): ChecklistItem[] {
  const done = checkDone();
  return checkItems(list).filter((item) => !done.has(item.id));
}

/**
 * List to suggest: the arrival list as long as it is not finished (legacy `ckCurrent`).
 * @returns `'dep'` or `'quit'`.
 */
export function ckCurrent(): string {
  return checkLeft('dep').length > 0 || checkItems('quit').length === 0
    ? 'dep'
    : 'quit';
}

/**
 * Sub-label of the checklist buttons (legacy `checklistSub`).
 * @returns `à préparer`, the points left, or `tout est fait`.
 */
export function checklistSub(): string {
  if (checkItems().length === 0) return 'à préparer';
  const list = ckCurrent();
  const left = checkLeft(list).length;
  if (!left) return 'tout est fait';
  return `${ckName(list)} : ${left} point${left > 1 ? 's' : ''}`;
}

/**
 * Ids opened in orange (legacy `ckOpen`).
 * @returns A new set.
 */
export function ckOpen(): Set<string> {
  return new Set(checklistHolder()?.ckOpen as string[] | undefined);
}

/**
 * Value of an item: in the day sheet when it has a `key`, else with the checks
 * (legacy `ckVal`).
 * @param item - Checklist item.
 * @returns The value, empty when none.
 */
export function ckVal(item: ChecklistItem): string {
  const value = item.key
    ? getDay(dayKey(new Date()))[item.key]
    : (checklistHolder()?.ckVals as Record<string, string> | undefined)?.[
        item.id
      ];
  return (value as string | undefined) || '';
}

/**
 * Label of an item with its value and unit (legacy `ckLabelVal`).
 * @param item - Checklist item.
 * @returns `label : value unit`, or the label without value.
 */
export function ckLabelVal(item: ChecklistItem): string {
  const value = ckVal(item);
  if (!value) return item.label;
  const unit = item.unit && item.unit !== 'nb' ? ` ${item.unit}` : '';
  return `${item.label.replace(/\s*:\s*$/, '')} : ${value}${unit}`;
}

/**
 * The record holding the observations (legacy `obsOwner`).
 * @returns The day on a lake day outing, the cruise otherwise.
 */
export function obsOwner(): Day | Cruise | null {
  return checklistHolder();
}

/**
 * Summary of the readings of a day (legacy `relevesSummary`).
 * @param day - Day sheet.
 * @returns The readings separated by ` · `.
 */
export function relevesSummary(day: Day): string {
  const value = (key: string, unit: string) =>
    day[key] != null && day[key] !== ''
      ? `${stringOf(day[key])} ${unit}`
      : null;
  const engine = value('moteurDebut', 'h');
  const fuel = value('carbPct', '%');
  const batteries = [value('batt1', 'V'), value('batt2', 'V')]
    .filter(Boolean)
    .join(' / ');
  const water = value('eauPct', '%');
  return [
    engine && `moteur ${engine}`,
    fuel && `carburant ${fuel}`,
    batteries && `batteries ${batteries}`,
    water && `eau ${water}`,
  ]
    .filter(Boolean)
    .join(' · ');
}

function checklistHolder(): Day | Cruise | null {
  const cruise = state.data.cruise.value;
  if (curMode() !== 'lacj') return cruise;
  return cruise?.days[dayKey(new Date())] ?? null;
}
