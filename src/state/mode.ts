import { DAY_SECTIONS } from '../model/daySections.ts';
import type { FieldDefinition, SectionDefinition } from '../model/field.ts';
import { FIELDS } from '../model/fields.ts';
import { LAKE_DAY_SECTIONS } from '../model/lakeDaySections.ts';
import type { ModeKey } from '../model/modes.ts';
import { modeOf } from '../model/modes.ts';
import type { Cruise } from '../model/types.ts';
import { NIGHT_VIEWS } from '../model/views.ts';
import { store } from '../storage/store.ts';

import { data } from './data.ts';
import { view } from './view.ts';

/**
 * The open cruise is a lake outing; the zone simulation overrides it (legacy `isLake`).
 * @param cruise - Cruise to test.
 * @returns `true` on a lake outing.
 */
export function isLake(cruise: Cruise | null = data.cruise.value): boolean {
  if (!cruise) return false;
  const simulated = view.zoneSimV.value;
  if (simulated === 'lac' || simulated === 'mer') return simulated === 'lac';
  return cruise.type === 'lac';
}

/**
 * Mode of the open cruise (legacy `curMode`).
 * @returns `'mer'`, `'lacj'` or `'lacc'`.
 */
export function curMode(): ModeKey {
  return modeOf(data.cruise.value);
}

/**
 * The field or section applies to the current water type (legacy `forType`).
 * @param item - Field or section with its `sea` / `lake` flags.
 * @param lake - Lake outing.
 * @returns `true` when shown.
 */
export function forType(
  item: { sea?: boolean; lake?: boolean },
  lake: boolean = isLake(),
): boolean {
  return lake ? !item.sea : !item.lake;
}

/**
 * Logbook fields of the current water type, lake labels applied (legacy `activeFields`).
 * @param lake - Lake outing.
 * @returns The field definitions.
 */
export function activeFields(lake: boolean = isLake()): FieldDefinition[] {
  const out: FieldDefinition[] = [];
  for (const field of FIELDS) {
    if (!forType(field, lake)) continue;
    out.push(
      lake && field.lakeLabel ? { ...field, label: field.lakeLabel } : field,
    );
  }
  return out;
}

/**
 * Sections and fields of the current water type (legacy `activeSections`).
 * @param sections - Sections to filter.
 * @param lake - Lake outing.
 * @returns Filtered copies.
 */
export function activeSections(
  sections: readonly SectionDefinition[],
  lake: boolean = isLake(),
): SectionDefinition[] {
  return sections
    .filter((section) => forType(section, lake))
    .map((section) => ({
      ...section,
      fields: section.fields.filter((field) => forType(field, lake)),
    }));
}

/**
 * Sections of the day sheet (legacy `daySections`).
 * @param lake - Lake outing.
 * @returns The lake sheet, or the sea sheet filtered.
 */
export function daySections(
  lake: boolean = isLake(),
): readonly SectionDefinition[] {
  return lake ? LAKE_DAY_SECTIONS : activeSections(DAY_SECTIONS, lake);
}

/**
 * Field of the logbook by key (legacy `fieldByKey`).
 * @param key - Field key.
 * @returns The active field, if any.
 */
export function fieldByKey(key: string): FieldDefinition | undefined {
  return activeFields().find((field) => field.key === key);
}

/**
 * Set the zone simulation (data part of legacy `zoneSet`): memory and raw `ldb.zoneSim`.
 * The caller refreshes the clock, the settings page and shows the toast.
 * @param value - `'auto'` for GPS, `'lac'` or `'mer'`.
 */
export function setZoneSim(value: string): void {
  view.zoneSimV.value = value === 'auto' ? '' : value;
  if (value === 'auto') store.del('ldb.zoneSim');
  else store.setRaw('ldb.zoneSim', value);
}

/**
 * Stored zone simulation (legacy `zoneSimGet`).
 * @returns `'lac'`, `'mer'` or `'auto'`.
 */
export function zoneSimGet(): string {
  return store.raw('ldb.zoneSim') || 'auto';
}

/**
 * Title of the takeover / end observations of the current mode (legacy `constatTitle`).
 * @param list - `'dep'` or another list.
 * @returns The title.
 */
export function constatTitle(list: string): string {
  if (list === 'dep') return 'Constat à la prise du bateau';
  const mode = curMode();
  if (mode === 'lacj') return 'Constat de fin de journée';
  return mode === 'mer'
    ? 'Constat de fin de location'
    : 'Constat de fin de croisière';
}

/**
 * The settings were opened with the gear from a view that allows the night mode (legacy `nightOK`).
 * @returns `true` when the night switch is shown.
 */
export function nightOK(): boolean {
  const from = view.settingsFrom.value;
  return Boolean(from) && NIGHT_VIEWS.includes(from as string);
}
