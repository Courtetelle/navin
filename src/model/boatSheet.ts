import { textOf } from '../lib/format.ts';

import type { FieldDefinition, SectionDefinition } from './field.ts';
import { flatFields } from './field.ts';
import { INFO_SECTIONS } from './infoSections.ts';
import type { Boat, BoatVersion, CruiseInfo } from './types.ts';

/** "Bateau et croisière" sections that belong to the boat (taken over on each outing). */
const BOAT_SECTIONS_ALL: readonly SectionDefinition[] = INFO_SECTIONS.filter(
  (section) => !['Croisière', 'Météo'].includes(section.title),
);

/** Sections shown on the boat sheet (rental, base and radio values are kept but not shown). */
export const BOAT_SECTIONS: readonly SectionDefinition[] =
  BOAT_SECTIONS_ALL.filter(
    (section) =>
      ![
        'Loueur, base',
        'Location et règlement du bateau',
        'Radio et identification',
      ].includes(section.title),
  );

/** Keys of the boat values (legacy `BOAT_KEYS`). */
export const BOAT_KEYS: readonly string[] = [
  ...BOAT_SECTIONS_ALL.flatMap((section) =>
    flatFields(section.fields).map((field) => field.key),
  ).filter((key) => !['moteurInit', 'fuelInit'].includes(key)),
  'gvDesc',
  'voilesDesc',
  'gvColor',
  'voilesColor',
  'vMoteur',
];

/** A field added by the user to a boat or member sheet. */
export interface CustomField {
  id: string;
  label: string;
  /**
   * Key of the field before it, or `§Title` for the start of a section.
   * @default undefined
   */
  after?: string;
}

/**
 * Field definition of a custom field (legacy `customField`).
 * @param custom - Custom field.
 * @returns A growing text line keyed `x_<id>`.
 */
export function customField(custom: CustomField): FieldDefinition {
  return {
    key: `x_${custom.id}`,
    label: custom.label,
    type: 'line',
    grow: true,
    wide: true,
  };
}

/**
 * Sections of a boat sheet with its custom fields placed and its renamed labels (legacy `boatSections`).
 * @param boat - Boat.
 * @returns The sections that have fields.
 */
export function boatSections(boat: Boat): SectionDefinition[] {
  const out = BOAT_SECTIONS.map((section) => ({
    ...section,
    fields: [...section.fields],
  }));
  const todo = [...(boat.custom || [])];
  for (let pass = 0; pass < 4 && todo.length > 0; pass++) {
    for (let position = 0; position < todo.length; position++) {
      const custom = todo[position] as CustomField;
      const after = custom.after || '';
      let done = false;
      if (after.startsWith('§')) {
        const section = out.find((item) => item.title === after.slice(1));
        if (section) {
          section.fields.unshift(customField(custom));
          done = true;
        }
      } else if (after) {
        for (const section of out) {
          const found = section.fields.findIndex(
            (field) => field.key === after,
          );
          if (found !== -1) {
            section.fields.splice(found + 1, 0, customField(custom));
            done = true;
            break;
          }
        }
      }
      if (done) {
        todo.splice(position, 1);
        position--;
      }
    }
  }
  const fallback =
    out.find((section) => section.title === 'Informations') || out.at(-1);
  if (fallback) {
    for (const custom of todo) fallback.fields.push(customField(custom));
  }
  const alias = boat.alias;
  if (alias) {
    for (const section of out) {
      section.fields = section.fields.map((field) =>
        alias[field.key] ? { ...field, label: alias[field.key] } : field,
      );
    }
  }
  return out.filter((section) => section.fields.length > 0);
}

/**
 * Value keys of a boat, custom fields included (legacy `boatKeys`).
 * @param boat - Boat.
 * @returns The keys.
 */
export function boatKeys(boat: Pick<Boat, 'custom'>): string[] {
  return [
    ...BOAT_KEYS,
    ...(boat.custom || []).map((custom) => `x_${custom.id}`),
  ];
}

/**
 * The boat values found in a sheet, with the `pairSrc_*` markers (legacy `boatInfoOf`).
 * @param boat - Boat (for its custom keys).
 * @param info - Sheet values.
 * @returns The non-empty boat values.
 */
export function boatInfoOf(
  boat: Pick<Boat, 'custom'>,
  info: CruiseInfo | null | undefined,
): CruiseInfo {
  const out: CruiseInfo = {};
  if (!info) return out;
  for (const key of boatKeys(boat)) {
    if (info[key] != null && info[key] !== '') out[key] = info[key];
  }
  for (const key in info) {
    if (key.startsWith('pairSrc_')) out[key] = info[key];
  }
  return out;
}

/**
 * Keys whose value differs between two sheets (legacy `infoDiffKeys`).
 * @param a - First sheet.
 * @param z - Second sheet.
 * @returns The differing keys.
 */
export function infoDiffKeys(a: CruiseInfo, z: CruiseInfo): string[] {
  const keys = [...new Set([...Object.keys(a), ...Object.keys(z)])];
  return keys.filter(
    (key) => JSON.stringify(a[key] ?? null) !== JSON.stringify(z[key] ?? null),
  );
}

/**
 * Keep a previous version of a boat sheet, 12 at most, newest first (legacy `boatSnap`).
 * Mutates `boat`: call it inside an immer recipe.
 * @param boat - Boat draft.
 * @param info - Values to keep.
 * @param from - Origin label.
 * @param at - ISO time (now by default).
 * @returns `true` when a version was added.
 */
export function boatSnap(
  boat: Boat,
  info: CruiseInfo,
  from: string,
  at?: string,
): boolean {
  boat.hist = boat.hist || [];
  if (
    Object.keys(info).length === 0 ||
    boat.hist.some((version) => infoDiffKeys(version.info, info).length === 0)
  ) {
    return false;
  }
  boat.hist.unshift({ at: at || new Date().toISOString(), from, info });
  boat.hist = boat.hist
    .toSorted((x: BoatVersion, z: BoatVersion) => z.at.localeCompare(x.at))
    .slice(0, 12);
  return true;
}

/**
 * Year of a boat sheet (legacy `boatYear`).
 * @param info - Sheet values.
 * @returns The 4-digit year found, or the text as typed.
 */
function boatYear(info: CruiseInfo | null | undefined): string {
  const text = textOf(info?.year);
  const match = text.match(/\b(?:19|20)\d{2}\b/);
  return match ? match[0] : text.trim();
}

/**
 * Sub-label of a boat chip: `Model (Year)` (legacy `boatSub`).
 * @param info - Sheet values.
 * @returns The sub-label.
 */
export function boatSub(info: CruiseInfo | null | undefined): string {
  if (!info) return '';
  const year = boatYear(info);
  return [info.model || '', year ? `(${year})` : ''].filter(Boolean).join(' ');
}
