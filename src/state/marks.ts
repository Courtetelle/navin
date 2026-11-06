import { produce } from 'immer';

import type { Mark } from '../model/types.ts';
import { store } from '../storage/store.ts';

import { data } from './data.ts';
import { examplesWanted } from './examplesWanted.ts';

/** Example marks: `[note, lat, lon]` (7 on Lake Geneva, 4 near Toulon). */
const EXAMPLE_MARKS: ReadonlyArray<readonly [string, number, number]> = [
  ['Bouée devant Morges', 46.5, 6.5],
  ['Large de Saint-Sulpice', 46.5, 6.56],
  ['Milieu du Grand-Lac', 46.45, 6.55],
  ['Large de Rolle', 46.445, 6.34],
  ['Large d’Ouchy', 46.495, 6.63],
  ['Large d’Évian', 46.42, 6.59],
  ['Large de Nyon', 46.37, 6.26],
  ['Sud de Porquerolles', 42.98, 6.2],
  ['Rade de Toulon', 43.085, 5.94],
  ['Large de Cassis', 43.19, 5.53],
  ['Large du cap Sicié', 43.03, 5.85],
];

/** The example marks by id, with their note, to recognise them. */
export const EXAMPLE_MARK_NOTES: Readonly<Record<string, string>> =
  Object.fromEntries(
    EXAMPLE_MARKS.map(([note], position) => [`exm${position + 1}`, note]),
  );

/**
 * Name of a mark from its number (legacy `markName`).
 * @param number - Sequence number.
 * @returns e.g. `M007`.
 */
export function markName(number: number): string {
  return `M${String(number).padStart(3, '0')}`;
}

/** Load the marks and add the example marks once (marks.js 9-29). */
export function loadMarks(): void {
  const marks = store.arr<Mark>('ldb.marks');
  data.marks.value = marks;
  if (!examplesWanted() || store.get('ldb.exMarks', false)) return;
  let sequence = store.get('ldb.markSeq', 0);
  const now = new Date().toISOString();
  for (const [position, [note, lat, lon]] of EXAMPLE_MARKS.entries()) {
    const id = `exm${position + 1}`;
    if (marks.some((mark) => mark.id === id)) continue;
    sequence += 1;
    marks.push({
      id,
      n: sequence,
      name: markName(sequence),
      at: now,
      lat,
      lon,
      depth: '',
      note,
    });
  }
  store.set('ldb.markSeq', sequence);
  saveMarks();
  store.set('ldb.exMarks', true);
}

/** Persist the marks with their stamp (legacy `saveMarks`). */
export function saveMarks(): void {
  store.set('ldb.marks', data.marks.value);
  store.set('ldb.marks.at', new Date().toISOString());
}

/**
 * Change the marks with an immer recipe, then save them.
 * @param recipe - Mutates the draft list.
 */
export function updateMarks(recipe: (marks: Mark[]) => void): void {
  data.marks.value = produce(data.marks.value, recipe);
  saveMarks();
}

/**
 * Restored marks: unknown ids are added, sorted by number, sequence kept ahead (legacy `mergeMarks`).
 * @param list - Marks from a backup.
 */
export function mergeMarks(list: unknown): void {
  if (!Array.isArray(list)) return;
  const received = list as Mark[];
  data.marks.value = produce(data.marks.value, (marks) => {
    for (const mark of received) {
      if (!marks.some((item) => item.id === mark.id)) marks.push(mark);
    }
    marks.sort((a, b) => a.n - b.n);
  });
  let highest = store.get('ldb.markSeq', 0);
  for (const mark of data.marks.value) highest = Math.max(highest, mark.n || 0);
  store.set('ldb.markSeq', highest);
  saveMarks();
}

/**
 * Record a mark at a position (data part of legacy `addMark`; the map redraws itself).
 * @param lat - Latitude.
 * @param lon - Longitude.
 * @param depth - Depth text.
 * @returns The new mark.
 */
export function addMark(lat: number, lon: number, depth?: string): Mark {
  const number = store.get('ldb.markSeq', 0) + 1;
  store.set('ldb.markSeq', number);
  const mark: Mark = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    n: number,
    name: markName(number),
    at: new Date().toISOString(),
    lat: Math.round(lat * 1e6) / 1e6,
    lon: Math.round(lon * 1e6) / 1e6,
    depth: depth || '',
    note: '',
  };
  updateMarks((marks) => {
    marks.push(mark);
  });
  return mark;
}

/**
 * Delete a mark.
 * @param id - Mark id.
 */
export function removeMark(id: string): void {
  data.marks.value = data.marks.value.filter((mark) => mark.id !== id);
  saveMarks();
}
