import { textOf } from '../lib/format.ts';
import type { Boat, Cruise, CruiseInfo, CruiseMeta } from '../model/types.ts';
import { store } from '../storage/store.ts';

/**
 * "Model, year" split into two values (legacy `splitModelYear`).
 * @param info - Sheet values, changed in place.
 * @returns `true` when split.
 */
export function splitModelYear(info: CruiseInfo | null | undefined): boolean {
  if (!info?.model) return false;
  const groups = textOf(info.model).match(
    /^(?<model>.*?)[,\s]+(?<year>(?:19|20)\d{2})\s*$/,
  )?.groups;
  if (!groups) return false;
  info.model = (groups.model as string).trim();
  if (!info.year) info.year = groups.year;
  return true;
}

/**
 * "Flag, home port" split into two values (legacy `splitFlagPort`).
 * @param info - Sheet values, changed in place.
 * @returns `true` when split.
 */
export function splitFlagPort(info: CruiseInfo | null | undefined): boolean {
  if (!info?.flag || info.homePort) return false;
  const groups = textOf(info.flag).match(
    /^(?<flag>.*?)\s*(?:·|,|\/)\s*(?<port>.+)$/,
  )?.groups;
  if (!groups) return false;
  info.flag = (groups.flag as string).trim();
  info.homePort = (groups.port as string).trim();
  return true;
}

/**
 * Unit "kg" taken out of the light displacement value (it is in the label).
 * @param info - Sheet values, changed in place.
 * @returns `true` when changed.
 */
export function displacementWithoutKg(
  info: CruiseInfo | null | undefined,
): boolean {
  if (!info || typeof info.displ !== 'string' || !/kg\s*$/i.test(info.displ)) {
    return false;
  }
  info.displ = info.displ.replace(/\s*kg\s*$/i, '').trim();
  return true;
}

/**
 * Anchor weight moved to its own value and sail area as a number (one-shot `ldb.anchorKg`).
 * @param info - Sheet values, changed in place.
 */
export function splitAnchorAndSails(info: CruiseInfo | null | undefined): void {
  if (!info) return;
  if (typeof info.anchor === 'string' && !info.anchorKg) {
    const match = info.anchor.match(/(?<weight>\d+(?:[.,]\d+)?)\s*kg/i);
    if (match?.groups) {
      info.anchorKg = (match.groups.weight as string).replace('.', ',');
      info.anchor = info.anchor
        .replace(match[0], '')
        .replaceAll(/\s+,/g, ',')
        .replaceAll(/,\s*,/g, ',')
        .replaceAll(/^[\s,]+|[\s,]+$/g, '')
        .replaceAll(/\s{2,}/g, ' ');
    }
  }
  if (typeof info.sails === 'string') {
    const area = info.sails.trim().match(/^(?<area>[\d.,]+)\s*m(?:²|2)$/i)
      ?.groups?.area;
    if (area) info.sails = area.replace('.', ',');
  }
}

/**
 * Power "13,3 kW" becomes the number "13,3" (one-shot `ldb.powerKw`).
 * @param info - Sheet values, changed in place.
 */
export function powerWithoutKw(info: CruiseInfo | null | undefined): void {
  if (!info || typeof info.power !== 'string') return;
  const power = info.power.trim().match(/^(?<power>[\d.,]+)\s*kw$/i)
    ?.groups?.power;
  if (power) info.power = power.replace('.', ',');
}

/**
 * An item ending with ":" is a value item (legacy `ckColon`).
 * @param item - Checklist item, changed in place.
 * @param item.label - Item label.
 * @param item.unit - Item unit.
 */
export function ckColon(item: { label?: string; unit?: string }): void {
  if (/:\s*$/.test(item.label || '') && !item.unit) item.unit = 'nb';
}

/**
 * Apply a sheet migration to the boats and to every stored cruise, once
 * (flag key), as the legacy boot does.
 * @param flag - One-shot storage flag.
 * @param boats - Boats, changed in place.
 * @param migrate - Migration of one sheet; returns `true` when a cruise must be saved.
 */
export function migrateSheets(
  flag: string,
  boats: Boat[],
  migrate: (info: CruiseInfo | null | undefined) => boolean,
): void {
  if (store.get(flag, false)) return;
  for (const boat of boats) migrate(boat.info);
  try {
    for (const meta of store.get<CruiseMeta[]>('ldb.index', [])) {
      const cruise = store.get<Cruise | null>(`ldb.cruise.${meta.id}`, null);
      if (cruise && migrate(cruise.info)) {
        store.set(`ldb.cruise.${meta.id}`, cruise);
      }
    }
  } catch {
    // A damaged index: the boats are still migrated.
  }
  store.set('ldb.boats', boats);
  store.set(flag, true);
}
