import { dayKey } from '../../lib/format.ts';
import type { Cruise, Entry } from '../../model/types.ts';
import { state } from '../../state/index.ts';

/** Bathing journal events (legacy `LAKE_EVENTS`). */
export const LAKE_EVENTS = {
  bain: 'Départ baignade',
  bainFin: 'Retour baignade',
} as const;

/** Engine and sail are two independent switches; both on means sail + engine (legacy `PROP_EVT`). */
export const PROP_EVT = {
  motOn: 'Début moteur',
  motOff: 'Fin moteur',
  sailOn: 'Début voile',
  sailOff: 'Fin voile',
} as const;

/** Points of sail offered under way (legacy `NAV_ALLURES`). */
export const NAV_ALLURES = [
  'Près',
  'Travers',
  'Largue',
  'Grand largue',
  'Vent arrière',
] as const;

/** Mainsail states (legacy `NAV_GV`). */
export const NAV_GV = ['Haute', '1 ris', '2 ris', 'Affalée'] as const;

/** Default headsails (legacy `NAV_AVANT`). */
export const NAV_AVANT = [
  'Génois',
  'Génois partiel',
  'Foc',
  'Spi',
  'Gennaker',
  'Aucune',
] as const;

/** Black water discharge, only noted on a deliberate touch (legacy `BLACK_EVT`). */
export const BLACK_EVT = 'Eaux noires vidées';

/** Engine, sails and bathing at a given moment of the day (legacy `lakeState`). */
export interface LakeState {
  motor: boolean;
  /** Time the engine was started, null when stopped. */
  motorT: string | null;
  sail: boolean;
  /** Time the sails were hoisted, null when not sailing. */
  sailT: string | null;
  allure: string | null;
  gv: string | null;
  avant: string | null;
  bathing: boolean;
  /**
   * Time of the last bathing event.
   * @default undefined
   */
  bathT?: string;
}

/** Time spent by propulsion and bathing periods of a day (legacy `lakeTimes`). */
export interface LakeTimes {
  /** Milliseconds under engine. */
  motor: number;
  /** Milliseconds under sail. */
  sail: number;
  /** Milliseconds with both. */
  mixed: number;
  /** `[start, end]` epoch milliseconds; a running bath has a null end. */
  baths: Array<[number | null, number | null]>;
}

interface Propulsion {
  m: boolean;
  s: boolean;
  mT: string | null;
  sT: string | null;
}

/**
 * The entry carries this journal event (legacy `hasEvt`).
 * @param entry - Logbook entry.
 * @param label - Event label.
 * @returns `true` when present.
 */
export function hasEvt(entry: Entry, label: string): boolean {
  return (entry.v.evt ?? []).includes(label);
}

/**
 * Engine on hides the point of sail; engine alone hides the sails too (legacy `sailHidden`).
 * @param key - Field key (`allure`, `gv`, `avant`).
 * @param lake - Current state, or null on a past entry.
 * @returns `true` when the field is hidden.
 */
export function sailHidden(key: string, lake: LakeState | null): boolean {
  return lake !== null && lake.motor && (key === 'allure' || !lake.sail);
}

/**
 * State of the propulsion, sails and bathing on a day (legacy `lakeState`).
 * @param key - Day key `YYYY-MM-DD`.
 * @param cruise - Cruise (the open one by default).
 * @returns The state.
 */
export function lakeState(
  key: string,
  cruise: Cruise | null = state.data.cruise.value,
): LakeState {
  const entries = entriesOfDay(key, cruise);
  const current: Propulsion = { m: false, s: false, mT: null, sT: null };
  for (const entry of entries) {
    const was = { m: current.m, s: current.s };
    if (!applyProp(entry, current)) continue;
    if (current.m && !was.m) current.mT = entry.t;
    if (current.s && !was.s) current.sT = entry.t;
  }
  const bath = entries.findLast(
    (entry) =>
      hasEvt(entry, LAKE_EVENTS.bain) || hasEvt(entry, LAKE_EVENTS.bainFin),
  );
  const sailedSince = Date.parse(current.sT ?? '');
  const allure = current.s
    ? entries.findLast(
        (entry) =>
          Date.parse(entry.t) >= sailedSince &&
          entry.v.allure &&
          entry.v.allure !== 'Moteur',
      )
    : undefined;
  const mainsail = entries.findLast((entry) => entry.v.gv);
  const headsail = entries.findLast((entry) => entry.v.avant);
  return {
    motor: current.m,
    motorT: current.m ? current.mT : null,
    sail: current.s,
    sailT: current.s ? current.sT : null,
    allure: allure?.v.allure ?? null,
    gv: mainsail?.v.gv ?? null,
    avant: headsail?.v.avant ?? null,
    bathing: bath !== undefined && hasEvt(bath, LAKE_EVENTS.bain),
    bathT: bath?.t,
  };
}

/**
 * Time under engine, under sail, under both, and the bathing periods of a day,
 * for the day sheet (legacy `lakeTimes`).
 * @param key - Day key.
 * @param cruise - Cruise (the open one by default).
 * @returns The durations.
 */
export function lakeTimes(
  key: string,
  cruise: Cruise | null = state.data.cruise.value,
): LakeTimes {
  const entries = entriesOfDay(key, cruise);
  const times: LakeTimes = { motor: 0, sail: 0, mixed: 0, baths: [] };
  if (entries.length === 0) return times;
  const current: Propulsion = { m: false, s: false, mT: null, sT: null };
  let last: number | null = null;
  let bathStart: number | null = null;
  const add = (time: number) => {
    if (last !== null) {
      const elapsed = time - last;
      if (current.m) times.motor += elapsed;
      if (current.s) times.sail += elapsed;
      if (current.m && current.s) times.mixed += elapsed;
    }
    last = time;
  };
  for (const entry of entries) {
    const time = Date.parse(entry.t);
    add(time);
    applyProp(entry, current);
    if (hasEvt(entry, LAKE_EVENTS.bain)) bathStart = time;
    if (hasEvt(entry, LAKE_EVENTS.bainFin)) {
      times.baths.push([bathStart, time]);
      bathStart = null;
    }
  }
  if (current.m || current.s) add(Math.max(last ?? 0, dayEnd(key, entries)));
  if (bathStart !== null) times.baths.push([bathStart, null]);
  return times;
}

function entriesOfDay(key: string, cruise: Cruise | null): Entry[] {
  return (cruise?.entries ?? []).filter(
    (entry) => dayKey(new Date(entry.t)) === key,
  );
}

function dayEnd(key: string, entries: Entry[]): number {
  const arrival = entries.findLast((e) => hasEvt(e, 'Arrivée'));
  if (arrival) return Date.parse(arrival.t);
  if (key === dayKey(new Date())) return Date.now();
  return Date.parse(entries.at(-1)?.t ?? '');
}

// Effect of an entry on the engine and sail switches; the labels of older
// versions of the app are understood too.
function applyProp(entry: Entry, current: Propulsion): boolean {
  const set = (engine: boolean | null, sail: boolean | null) => {
    if (engine !== null) current.m = engine;
    if (sail !== null) current.s = sail;
    return true;
  };
  if (hasEvt(entry, 'Arrivée') || hasEvt(entry, 'Fin voile et moteur')) {
    return set(false, false);
  }
  if (hasEvt(entry, 'Passage au moteur')) return set(true, false);
  if (hasEvt(entry, 'Passage à la voile')) return set(false, true);
  if (hasEvt(entry, 'Voile et moteur')) return set(true, true);
  let changed = false;
  if (hasEvt(entry, PROP_EVT.motOn)) changed = set(true, null);
  if (hasEvt(entry, PROP_EVT.motOff)) changed = set(false, null);
  if (hasEvt(entry, PROP_EVT.sailOn)) changed = set(null, true);
  if (hasEvt(entry, PROP_EVT.sailOff)) changed = set(null, false);
  return changed;
}
