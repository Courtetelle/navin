import { PREP_PURPOSES } from '../../model/modes.ts';
import type { Cruise } from '../../model/types.ts';
import {
  boatById,
  crewSetName,
  state,
  updatePrepPaths,
} from '../../state/index.ts';
import { store } from '../../storage/store.ts';

import { prepFlow } from './prepTypes.ts';

/** What a lake path keeps (legacy `PREP_PATH_KEYS`). */
export const PREP_PATH_KEYS = [
  'purpose',
  'duree',
  'boatId',
  'boatName',
  'crewSet',
  'step',
  'reach',
  'cruiseId',
  'fresh',
  'tarif',
] as const;

/** One saved lake path (`ldb.prepPaths`). */
export interface PrepPath {
  /** Lake path. @default undefined */
  purpose?: string;
  /** Duration. @default undefined */
  duree?: string;
  /** Boat chosen. @default undefined */
  boatId?: string;
  /** Boat name typed. @default undefined */
  boatName?: string;
  /** Composition chosen. @default undefined */
  crewSet?: string;
  /** Step shown. @default undefined */
  step?: number;
  /** Step being filled. @default undefined */
  reach?: number;
  /** Own cruise of the path. @default undefined */
  cruiseId?: string;
  /** Nothing taken from the open cruise yet. @default undefined */
  fresh?: boolean;
  /** Label of the fare chosen. @default undefined */
  tarif?: string;
  /** Time of the save. */
  t: string;
}

/**
 * Keep the lake path in progress (legacy `prepPathSave`): each purpose has its
 * own, resumed as it was left.
 */
export function prepPathSave(): void {
  const prep = prepFlow();
  if (prep?.type !== 'lac' || !prep.purpose || prep.fill) return;
  const path: Record<string, unknown> = {};
  for (const key of PREP_PATH_KEYS) {
    if (prep[key] !== null && prep[key] !== undefined) path[key] = prep[key];
  }
  path.t = new Date().toISOString();
  const { purpose } = prep;
  updatePrepPaths((paths) => {
    paths[purpose] = path;
  });
}

/**
 * Forget a lake path (legacy `prepPathDrop`).
 * @param purpose - Path, nothing happens without one.
 */
export function prepPathDrop(purpose: string | null | undefined): void {
  if (!purpose || !state.data.prepPaths.value[purpose]) return;
  updatePrepPaths((paths) => {
    Reflect.deleteProperty(paths, purpose);
  });
}

/**
 * A kept path that is still valid: its cruise exists and has not started
 * (no entry). Reads only, so that it can run while rendering.
 * @param purpose - Path.
 * @returns The path, or null.
 */
export function prepPathValid(purpose: string): PrepPath | null {
  const path = state.data.prepPaths.value[purpose] as PrepPath | undefined;
  if (!path) return null;
  if (!path.cruiseId) return path;
  const cruise = store.get<Cruise | null>(`ldb.cruise.${path.cruiseId}`, null);
  return !cruise || (cruise.entries || []).length > 0 ? null : path;
}

/**
 * A kept path, forgotten when it is no longer valid (legacy `prepPathGet`).
 * @param purpose - Path.
 * @returns The path, or null.
 */
export function prepPathGet(purpose: string): PrepPath | null {
  const path = prepPathValid(purpose);
  if (!path) prepPathDrop(purpose);
  return path;
}

/** Forget the paths that are no longer valid (legacy read them on every render). */
export function prunePrepPaths(): void {
  for (const [purpose] of PREP_PURPOSES) prepPathGet(purpose);
}

/**
 * Reminder of a kept path under its button (legacy `prepPathSub`).
 * @param purpose - Path.
 * @returns e.g. `en cours : Savannah · EQ001`, `''` without path.
 */
export function prepPathSub(purpose: string): string {
  const path = prepPathValid(purpose);
  if (!path) return '';
  const boat = path.boatId ? boatById(path.boatId) : null;
  const set = path.crewSet
    ? state.data.crewSets.value.find((item) => item.id === path.crewSet)
    : null;
  const bits = [
    boat ? boat.info.boat : path.boatName,
    set ? crewSetName(set) : '',
  ].filter(Boolean);
  return bits.length > 0 ? `en cours : ${bits.join(' · ')}` : '';
}
