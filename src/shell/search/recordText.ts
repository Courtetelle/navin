import { fmtPos } from '../../lib/geo.ts';
import { boatSections } from '../../model/boatSheet.ts';
import { MEMBER_FIELDS } from '../../model/crewFields.ts';
import type { CrewSet, Mark, Member } from '../../model/recordTypes.ts';
import type { Boat } from '../../model/types.ts';
import { memberName, state } from '../../state/index.ts';

import { plain } from './searchIndex.ts';

/** One field of a record: its title and what it holds. */
export interface RecordLine {
  label: string;
  value: string;
}

/** Longest text of a field kept for the search (a picture is left out). */
const LONGEST = 2000;

/**
 * The words a field holds, whatever its kind.
 * @param value - The value kept.
 * @returns Its text, empty for a picture or nothing.
 */
export function textValue(value: unknown): string {
  if (value == null || typeof value === 'boolean') return '';
  if (typeof value === 'string') {
    return value.startsWith('data:') || value.length > LONGEST ? '' : value;
  }
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) {
    return value.map(textValue).filter(Boolean).join(' · ');
  }
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>)
      .map(textValue)
      .filter(Boolean)
      .join(' · ');
  }
  return '';
}

/**
 * Every field of a boat sheet, its title and its content.
 * @param boat - The boat.
 * @returns The lines, in the order of the sheet.
 */
export function boatLines(boat: Boat): RecordLine[] {
  const info = boat.info as Record<string, unknown>;
  const lines: RecordLine[] = [];
  const seen = new Set<string>();
  for (const section of boatSections(boat)) {
    lines.push({ label: section.title, value: '' });
    for (const field of section.fields) {
      seen.add(field.key);
      lines.push({
        label: field.label ?? '',
        value: textValue(info[field.key]),
      });
    }
  }
  for (const [key, value] of Object.entries(info)) {
    if (!seen.has(key)) lines.push({ label: '', value: textValue(value) });
  }
  return lines;
}

/**
 * Every field of a crew card.
 * @param member - The card.
 * @returns The lines.
 */
export function memberLines(member: Member): RecordLine[] {
  const seen = new Set<string>(['id']);
  const lines: RecordLine[] = MEMBER_FIELDS.map((field) => {
    seen.add(field.key);
    return { label: field.label ?? '', value: textValue(member[field.key]) };
  });
  for (const [key, value] of Object.entries(member)) {
    if (!seen.has(key)) lines.push({ label: '', value: textValue(value) });
  }
  return lines;
}

/**
 * A crew: its name, its identifier, each crew member and their role.
 * @param set - The crew.
 * @returns The lines.
 */
export function crewLines(set: CrewSet): RecordLine[] {
  const lines: RecordLine[] = [
    { label: 'Nom', value: textValue(set.name) },
    { label: 'Identifiant', value: textValue(set.ident) },
  ];
  for (const line of set.crew) {
    const member = state.data.members.value.find(
      (one) => one.id === line.memberId,
    );
    lines.push({
      label: textValue(line.fonction),
      value: member ? memberName(member) : '',
    });
  }
  return lines;
}

/**
 * A mark: its name, note, depth and position.
 * @param mark - The mark.
 * @returns The lines.
 */
export function markLines(mark: Mark): RecordLine[] {
  return [
    { label: 'Nom', value: mark.name },
    { label: 'Note', value: textValue(mark.note) },
    { label: 'Profondeur', value: textValue(mark.depth) },
    { label: 'Position', value: fmtPos({ lat: mark.lat, lon: mark.lon }) },
  ];
}

/**
 * All the text of a record, to search in.
 * @param lines - Its lines.
 * @returns Titles and contents.
 */
export function linesText(lines: readonly RecordLine[]): string {
  return lines.map((line) => `${line.label} ${line.value}`).join(' ');
}

/** Longest content shown after a hit. */
const SHOWN = 40;

/**
 * Where a search found a record, when it is not in its name:
 * `Modèle : Hanse 325`.
 * @param query - Words typed.
 * @param name - The name shown.
 * @param lines - The lines of the record.
 * @returns The field found, or `''`.
 */
export function foundIn(
  query: string,
  name: string,
  lines: readonly RecordLine[],
): string {
  const words = plain(query).split(/\s+/).filter(Boolean);
  const inName = plain(name);
  const missing = words.filter((word) => !inName.includes(word));
  if (missing.length === 0) return '';
  // A field whose content holds the word first, then a title alone.
  const line =
    lines.find((one) =>
      missing.some((word) => plain(one.value).includes(word)),
    ) ??
    lines.find((one) =>
      missing.some((word) => plain(`${one.label} ${one.value}`).includes(word)),
    );
  if (!line) return '';
  const value =
    line.value.length > SHOWN ? `${line.value.slice(0, SHOWN)}…` : line.value;
  if (!line.label) return value;
  return value ? `${line.label} : ${value}` : line.label;
}

/**
 * A record of any kind, every word it holds.
 * @param record - The record.
 * @returns One line.
 */
export function anyLines(record: unknown): RecordLine[] {
  const lines: RecordLine[] = [];
  collect(record, '', lines);
  return lines;
}

/** Keys of the app, never written by anyone: left out of the search. */
const INTERNAL = new Set([
  'id',
  'memberId',
  'cid',
  'seed',
  'at',
  'created',
  'updated',
  't',
  'kind',
  'type',
]);

function collect(value: unknown, key: string, lines: RecordLine[]): void {
  if (INTERNAL.has(key)) return;
  if (Array.isArray(value)) {
    for (const item of value) collect(item, key, lines);
    return;
  }
  if (value && typeof value === 'object') {
    for (const [inner, item] of Object.entries(value)) {
      collect(item, inner, lines);
    }
    return;
  }
  const text = textValue(value);
  if (text) lines.push({ label: '', value: text });
}
