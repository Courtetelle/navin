import { fmtNum, fmtValue } from '../../lib/fieldFormat.ts';
import {
  fmtShortDate,
  fmtTime,
  fmtUtc,
  keyToDate,
  stringOf,
} from '../../lib/format.ts';
import type { FieldDefinition } from '../../model/field.ts';
import type { Cruise } from '../../model/types.ts';
import {
  activeFields,
  daySections,
  daysWithData,
  navLabel,
} from '../../state/index.ts';

/** Byte order mark: spreadsheets then read the file as UTF-8. */
const BOM = '﻿';
const NOT_EXPORTED: ReadonlySet<string> = new Set([
  'calc',
  'tides',
  'signature',
]);

/** One tide line of a day sheet (`day.marees[]`). */
export interface TideRow {
  /** @default undefined */
  type?: string;
  /** @default undefined */
  h?: string;
  /** @default undefined */
  m?: string;
}

/**
 * Spreadsheet of the logbook entries, one line per entry (legacy `csvEntries`).
 * @param cruise - Cruise exported.
 * @returns The CSV text, starting with a byte order mark.
 */
export function csvEntries(cruise: Cruise): string {
  const fields = activeFields().filter((field) => field.key !== 't');
  const header = ['Date', 'Heure', 'Heure UTC', 'Auto'];
  for (const field of fields) {
    header.push(
      field.unit ? `${field.label} (${field.unit})` : `${field.label}`,
    );
  }
  const lines = [csvLine(header)];
  for (const entry of cruise.entries) {
    const date = new Date(entry.t);
    const row: unknown[] = [
      fmtShortDate(date),
      fmtTime(date),
      fmtUtc(date).replace(' UTC', ''),
      entry.auto ? 'oui' : '',
    ];
    for (const field of fields) {
      const value = entry.v[field.key];
      row.push(
        field.type === 'number'
          ? value == null
            ? ''
            : fmtNum(field, value)
          : fmtValue(field, value),
      );
    }
    lines.push(csvLine(row));
  }
  return BOM + lines.join('\r\n');
}

/**
 * Spreadsheet of the day sheets, one line per day (legacy `csvDays`).
 * @param cruise - Cruise exported.
 * @returns The CSV text, starting with a byte order mark.
 */
export function csvDays(cruise: Cruise): string {
  const fields = dayFieldsFlat();
  const header = ['Date', 'Navigation'];
  for (const field of fields) {
    if (field.unit) header.push(`${field.label || field.key} (${field.unit})`);
    else header.push(field.label || 'Contrôles');
  }
  header.push('Marées');
  const lines = [csvLine(header)];
  for (const key of daysWithData(cruise)) {
    const day = cruise.days[key] ?? {};
    const row: unknown[] = [
      fmtShortDate(keyToDate(key)),
      navLabel(key, cruise),
    ];
    for (const field of fields) row.push(dayVal(field, day[field.key]));
    row.push(tideLines(day.marees).join(' / '));
    lines.push(csvLine(row));
  }
  return BOM + lines.join('\r\n');
}

/**
 * Value of a day sheet field as printed and exported (legacy `dayVal`): a list
 * joined by commas, with the field's prefix (« ≥ » before the minimum depth).
 * @param field - Field definition.
 * @param value - Stored value.
 * @returns The value, `''` when empty.
 */
export function dayVal(field: FieldDefinition, value: unknown): unknown {
  const text = Array.isArray(value) ? value.join(', ') : (value ?? '');
  return field.prefix && text !== ''
    ? `${field.prefix} ${stringOf(text)}`
    : text;
}

/**
 * Tides of a day that have a type or a time (legacy filter of `day.marees`).
 * @param tides - Stored tide rows.
 * @returns One text per tide, e.g. `PM 06:12 4,2 m`.
 */
export function tideLines(tides: unknown): string[] {
  const lines: string[] = [];
  for (const row of (tides ?? []) as readonly TideRow[]) {
    if (!row.type && !row.h) continue;
    lines.push(
      `${row.type || ''} ${row.h || ''} ${row.m ? `${row.m} m` : ''}`.trim(),
    );
  }
  return lines;
}

function dayFieldsFlat(): FieldDefinition[] {
  const fields: FieldDefinition[] = [];
  for (const section of daySections()) {
    for (const field of section.fields) {
      if (!NOT_EXPORTED.has(field.type)) fields.push(field);
    }
  }
  return fields;
}

function csvLine(cells: readonly unknown[]): string {
  const quoted: string[] = [];
  for (const value of cells) {
    quoted.push(`"${stringOf(value ?? '').replaceAll('"', '""')}"`);
  }
  return quoted.join(';');
}
