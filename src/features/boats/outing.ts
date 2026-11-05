import { dayKey, fmtDur, fr, num, textOf } from '../../lib/format.ts';
import type { Cruise, Day } from '../../model/types.ts';
import {
  crewNames,
  ensureDay,
  navForDay,
  saveCruise,
  state,
  updateCruise,
} from '../../state/index.ts';
import { hasEvt } from '../onwater/index.ts';

import { dayLine } from './dayLine.ts';

/** Departure and return of a day (legacy `outingTimes`). */
export interface OutingTimes {
  /** Departure, epoch ms. */
  t0: number | null;
  /** Return, epoch ms. */
  t1: number | null;
  /** Miles of the GPS track. */
  nm: number;
  /** The outing is being tracked now. */
  live: boolean;
}

/**
 * Departure and return of a day: GPS track of the day, else the journal entries
 * Départ / Arrivée (legacy `outingTimes`).
 * @param key - Day key `YYYY-MM-DD`.
 * @param cruise - Cruise (the open one by default).
 * @returns Times, miles and whether it is running.
 */
export function outingTimes(
  key: string,
  cruise: Cruise | null = state.data.cruise.value,
): OutingTimes {
  const entries = (cruise?.entries ?? []).filter(
    (entry) => dayKey(new Date(entry.t)) === key,
  );
  const { line, nm } = dayLine(key, cruise);
  const departure = entries.find((entry) => hasEvt(entry, 'Départ'));
  const arrival = entries.findLast((entry) => hasEvt(entry, 'Arrivée'));
  const first = line[0];
  const last = line.at(-1);
  let t0: number | null = null;
  if (departure) t0 = Date.parse(departure.t);
  else if (first) t0 = first.t;
  else if (entries[0]) t0 = Date.parse(entries[0].t);
  let t1: number | null = null;
  if (arrival) t1 = Date.parse(arrival.t);
  else if (line.length > 1 && last) t1 = last.t;
  else if (entries.length > 1) t1 = Date.parse(entries.at(-1)?.t ?? '');
  if (t1 !== null && t0 !== null && t1 <= t0) t1 = null;
  return {
    t0,
    t1,
    nm: line.length > 1 ? nm : 0,
    live: state.view.tracking.value && key === dayKey(new Date()),
  };
}

/**
 * Navigation time of a day (legacy `navDur`).
 * @param key - Day key.
 * @param cruise - Cruise (the open one by default).
 * @returns The formatted duration, `''` without navigation.
 */
export function navDur(
  key: string,
  cruise: Cruise | null = state.data.cruise.value,
): string {
  const { ms } = navForDay(key, cruise);
  return ms ? fmtDur(ms) : '';
}

/**
 * The day has a track worth a map (legacy `hasTrace`).
 * @param key - Day key.
 * @returns `true` with two points or more.
 */
export function hasTrace(key: string): boolean {
  return dayLine(key, state.data.cruise.value).line.length > 1;
}

/**
 * Rental price from the day and hour of departure, read in the « Tarifs » text
 * of the boat (legacy `rentalPrice`).
 * @param time - Departure (now by default).
 * @param prices - The « Tarifs » text.
 * @returns The rounded price, or null when no line applies.
 */
export function rentalPrice(
  time: number | string | Date | null | undefined,
  prices: unknown,
): string | null {
  const date = new Date(time || Date.now());
  const weekend = date.getDay() === 0 || date.getDay() === 6;
  const evening = date.getHours() * 60 + date.getMinutes() >= 16 * 60 + 30;
  for (const line of textOf(prices).split('\n')) {
    const lineWeekend = /\bwe\b|week-?end|samedi|dimanche/i.test(line);
    const lineEvening = /soir|17\s*h/i.test(line);
    const match = /(?<price>\d+(?:[.,]\d{1,2})?)(?!.*\d)/.exec(line);
    if (match && lineWeekend === weekend && lineEvening === evening) {
      return String(Math.round(num(match.groups?.price) ?? 0));
    }
  }
  return null;
}

/**
 * Fill what can be filled in a lake day sheet; a value corrected by hand is
 * never replaced (legacy `autoFillLakeDay`). The day is created when missing.
 * @param key - Day key.
 * @returns The day.
 */
export function autoFillLakeDay(key: string): Day {
  ensureDay(key);
  const times = outingTimes(key);
  let changed = false;
  updateCruise(
    (cruise) => {
      cruise.days[key] ??= {};
      const day = cruise.days[key];
      day._auto ??= {};
      const memory = day._auto;
      const auto = (name: string, value: unknown) => {
        if (value == null || value === '') return;
        const stored = day[name];
        const free = stored == null || stored === '' || stored === memory[name];
        if (free && stored !== value) {
          day[name] = value;
          changed = true;
        }
        if (day[name] === value) memory[name] = value;
      };
      auto('typeSortie', cruise.purpose || guessOutingType(times.t0));
      const role = (name: string) =>
        cruise.crew.find((line) => line.fonction === name)?.nom;
      auto('skipper', role('Skipper'));
      auto('coSkipper', role('Second'));
      auto(
        'equipage',
        crewNames(cruise)
          .filter((name) => name !== day.skipper && name !== day.coSkipper)
          .join(', '),
      );
      if (times.nm > 0.05) auto('nmJour', fr(times.nm));
      if (day.typeSortie === 'Location') {
        auto('montant', rentalPrice(times.t0, cruise.info.tarifs));
      }
      const previous = Object.keys(cruise.days)
        .filter((other) => other < key)
        .toSorted()
        .findLast((other) => num(cruise.days[other]?.moteurSoir) != null);
      auto(
        'moteurDebut',
        previous ? cruise.days[previous]?.moteurSoir : cruise.info.moteurInit,
      );
    },
    { save: false },
  );
  if (changed) saveCruise();
  return state.data.cruise.value?.days[key] ?? {};
}

function guessOutingType(time: number | null): string {
  const date = new Date(time || Date.now());
  if (date.getDay() === 0 || date.getDay() === 6) return 'Journée WE';
  return date.getHours() * 60 + date.getMinutes() >= 16 * 60 + 30
    ? 'Dès 17h00'
    : 'Journée semaine';
}
