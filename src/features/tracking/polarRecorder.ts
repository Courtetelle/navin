import { signal } from '@preact/signals-react';

import type { RealPolar, SailsNow } from '../../model/realPolar.ts';
import {
  addMinute,
  angleMean,
  isRealPolar,
  sailsName,
  sailsSail,
} from '../../model/realPolar.ts';
import type { Boat } from '../../model/types.ts';
import {
  boatById,
  seaCruiseBoat,
  state,
  updateBoat,
} from '../../state/index.ts';
import { store } from '../../storage/store.ts';

import type { TrackSample } from './detector.ts';
import { nmeaFresh, nmeaHeading, nmeaLink } from './nmeaLive.ts';

const SAILS_KEY = 'ldb.sailsNow';
/** A minute of sailing is counted when it holds this long. */
const MINUTE_MS = 60_000;
/** Samples further apart than this start the minute again. */
const HOLE_MS = 20_000;
/** At most this much change of heading in a minute, degrees. */
const MOST_HEADING_SPREAD = 15;
/** At most this much change of wind direction in a minute, degrees. */
const MOST_WIND_SPREAD = 20;
/** At most this much change of wind speed in a minute, knots. */
const MOST_GUST = 5;

/** The sails up by default. */
export const DEFAULT_SAILS: SailsNow = { gv: 'Haute', avant: 'Génois' };

/** The sails up, kept on the device (`ldb.sailsNow`). */
export const sailsNow = signal<SailsNow & { at: string }>(readSails());

function readSails(): SailsNow & { at: string } {
  const kept = store.get<Partial<SailsNow & { at: string }> | null>(
    SAILS_KEY,
    null,
  );
  return {
    gv: typeof kept?.gv === 'string' ? kept.gv : DEFAULT_SAILS.gv,
    avant: typeof kept?.avant === 'string' ? kept.avant : DEFAULT_SAILS.avant,
    at: typeof kept?.at === 'string' ? kept.at : '',
  };
}

/**
 * Change the sails up: the next minutes count for them.
 * @param sails - The sails.
 */
export function setSailsNow(sails: SailsNow): void {
  const next = { ...sails, at: new Date().toISOString() };
  sailsNow.value = next;
  store.set(SAILS_KEY, next);
  minuteMoments.length = 0;
}

/**
 * The sails up now: the last ones set here, or those of the last logbook
 * entry when it is newer.
 * @returns The sails.
 */
export function currentSails(): SailsNow {
  const set = sailsNow.peek();
  const entries = state.data.cruise.peek()?.entries ?? [];
  for (let rank = entries.length - 1; rank >= 0; rank--) {
    const entry = entries[rank];
    if (!entry || entry.t <= set.at) break;
    const { gv, avant } = entry.v;
    if (gv || avant) {
      return { gv: gv ?? set.gv, avant: avant ?? set.avant };
    }
  }
  return { gv: set.gv, avant: set.avant };
}

/**
 * The boat sailing now: the boat of the open outing or sea cruise.
 * @returns The boat, or `undefined`.
 */
export function sailingBoat(): Boat | undefined {
  const cruise = state.data.cruise.peek();
  if (!cruise) return undefined;
  return cruise.boatId ? boatById(cruise.boatId) : seaCruiseBoat(cruise);
}

/**
 * The real polars of a boat.
 * @param boat - The boat.
 * @returns One per set of sails.
 */
export function realPolarsOf(boat: Boat | undefined): RealPolar[] {
  const list = boat?.realPolars;
  return Array.isArray(list) ? list.filter(isRealPolar) : [];
}

interface Moment {
  t: number;
  kn: number;
  hdg: number;
  twd: number;
  tws: number;
}

const minuteMoments: Moment[] = [];

/**
 * Take one position of the tracker: with the true wind of the instruments
 * and a steady minute, the minute counts in the real polar of the boat for
 * the sails up.
 * @param sample - The position, its speed and course, the wind.
 */
export function polarPush(sample: TrackSample): void {
  const moment = momentOf(sample);
  const last = minuteMoments.at(-1);
  if (!moment || (last && moment.t - last.t > HOLE_MS)) {
    minuteMoments.length = 0;
    if (!moment) return;
  }
  minuteMoments.push(moment);
  const first = minuteMoments[0] as Moment;
  if (moment.t - first.t < MINUTE_MS) return;
  const minute = steadyMinute(minuteMoments);
  minuteMoments.length = 0;
  if (!minute) return;
  const boat = sailingBoat();
  const sails = currentSails();
  if (!boat || !sailsSail(sails)) return;
  const name = sailsName(sails);
  updateBoat(boat.id, (draft) => {
    const list = realPolarsOf(draft);
    const rank = list.findIndex((real) => real.sails === name);
    const next = addMinute(list[rank], name, {
      ...minute,
      at: new Date(moment.t).toISOString(),
    });
    if (rank === -1) list.push(next);
    else list[rank] = next;
    draft.realPolars = list;
  });
}

function momentOf(sample: TrackSample): Moment | null {
  const { t, twd, tws, sog, cog } = sample;
  if (twd == null || tws == null || !Number.isFinite(t)) return null;
  const stw = nmeaFresh('stw') ? nmeaLink.live.stw : undefined;
  const kn = stw ?? sog;
  const hdg = nmeaHeading() ?? cog;
  if (kn == null || hdg == null) return null;
  return { t, kn, hdg, twd, tws };
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * A minute steady enough to count: one heading, one wind.
 * @param moments - The minute.
 * @returns The mean angle to the wind, wind and speed, or `null`.
 */
export function steadyMinute(
  moments: readonly Moment[],
): { twa: number; tws: number; kn: number } | null {
  if (moments.length < 3) return null;
  const heading = angleMean(moments.map((moment) => moment.hdg));
  const wind = angleMean(moments.map((moment) => moment.twd));
  const speeds = moments.map((moment) => moment.tws);
  if (heading.spread > MOST_HEADING_SPREAD) return null;
  if (wind.spread > MOST_WIND_SPREAD) return null;
  if (Math.max(...speeds) - Math.min(...speeds) > MOST_GUST) return null;
  return {
    twa: Math.abs(((heading.mean - wind.mean + 540) % 360) - 180),
    tws: mean(speeds),
    kn: mean(moments.map((moment) => moment.kn)),
  };
}
