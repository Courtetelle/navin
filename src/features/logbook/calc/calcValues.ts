import { dayKey, num } from '../../../lib/format.ts';
import type { FieldData } from '../../../model/field.ts';
import type { Cruise, Day, Entry } from '../../../model/types.ts';

/** Figures of the engine block of the day sheet. */
interface EngineFigures {
  /** Hours read tonight. */
  evening: number | null;
  /** Hours at the start of the cruise. */
  start: number | null;
  /** Hours run. */
  hours: number | null;
  /** Consumption of all engines, l/h. */
  consumption: number | null;
  /** Litres burnt. */
  burnt: number | null;
  /** Fuel added up to this day. */
  refuelled: number;
  /** Fuel at departure, refuels included. */
  loaded: number | null;
  /** Fuel left. */
  available: number | null;
  /** Something is missing for the calculation. */
  incomplete: boolean;
}

/**
 * Engine and fuel figures of a day (legacy `calcEngine`).
 * @param cruise - Cruise.
 * @param data - Values of the day form.
 * @param key - Day shown.
 * @returns The figures.
 */
export function engineFigures(
  cruise: Cruise,
  data: FieldData,
  key: string,
): EngineFigures {
  const { info, days } = cruise;
  const evening = num(data.moteurSoir);
  const start = num(info.moteurInit);
  const fuel = num(info.fuelInit);
  const first = num(info.conso);
  const second = num(info.conso2);
  const consumption =
    first != null || second != null ? (first ?? 0) + (second ?? 0) : null;
  const hours = evening != null && start != null ? evening - start : null;
  const burnt =
    hours != null && consumption != null ? hours * consumption : null;
  let refuelled = 0;
  for (const day of Object.keys(days)) {
    if (day <= key) refuelled += num(days[day]?.plein) || 0;
  }
  return {
    evening,
    start,
    hours,
    consumption,
    burnt,
    refuelled,
    loaded: fuel == null ? null : fuel + refuelled,
    available: fuel != null && burnt != null ? fuel + refuelled - burnt : null,
    incomplete: start == null || consumption == null || fuel == null,
  };
}

function lochOf(entry: Entry): number | null {
  return num(entry.v.loch);
}

/**
 * Miles of a day read on the log (legacy `lochSuggestion`).
 * @param cruise - Cruise.
 * @param key - Day.
 * @returns Miles rounded to 0.1, or null.
 */
export function lochSuggestion(cruise: Cruise, key: string): number | null {
  const readings = cruise.entries.filter((entry) => lochOf(entry) != null);
  const today = readings.filter((entry) => dayKey(new Date(entry.t)) === key);
  const first = today[0];
  const last = today.at(-1);
  if (!first || !last) return null;
  const earlier = readings.findLast((entry) => dayKey(new Date(entry.t)) < key);
  const start = lochOf(earlier ?? first) ?? 0;
  const miles = (lochOf(last) ?? 0) - start;
  return miles > 0 ? Math.round(miles * 10) / 10 : null;
}

/** Figures of the miles block of the day sheet. */
interface MilesFigures {
  /** Total of the previous days. */
  previous: number;
  /** Miles of this day. */
  today: number | null;
  /** Engine speed, knots. */
  speed: number | null;
  /** Total under engine. */
  engineTotal: number | null;
  /** Under engine this day. */
  engineToday: number | null;
  /** Miles read on the log. */
  suggestion: number | null;
}

/**
 * Miles of the cruise up to a day (legacy `calcMiles`).
 * @param cruise - Cruise.
 * @param data - Values of the day form.
 * @param key - Day shown.
 * @returns The figures.
 */
export function milesFigures(
  cruise: Cruise,
  data: FieldData,
  key: string,
): MilesFigures {
  const { info, days } = cruise;
  const earlier = Object.keys(days)
    .filter((day) => day < key)
    .toSorted()
    .toReversed();
  let previous = 0;
  for (const day of earlier) previous += num(days[day]?.nmJour) || 0;
  const start = num(info.moteurInit);
  const hoursAt = (day: Day | FieldData) => {
    const evening = num(day.moteurSoir);
    return evening != null && start != null ? evening - start : null;
  };
  const speed = num(info.vMoteur);
  const hours = hoursAt(data);
  const engineTotal = hours != null && speed != null ? hours * speed : null;
  const lastDay = earlier.find((day) => hoursAt(days[day] ?? {}) != null);
  const engineBefore =
    lastDay && speed != null ? (hoursAt(days[lastDay] ?? {}) ?? 0) * speed : 0;
  return {
    previous,
    today: num(data.nmJour),
    speed,
    engineTotal,
    engineToday: engineTotal == null ? null : engineTotal - engineBefore,
    suggestion: lochSuggestion(cruise, key),
  };
}
