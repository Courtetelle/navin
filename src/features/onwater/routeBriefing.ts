/**
 * The go / no-go along a route: the forecast read at a few places along it
 * (wind, sea, currents), the track of the boat (the polar routing with that
 * wind, else the planned speed), then, hour by hour,
 * where the boat is, the weather of the nearest place, the course it steers
 * (for the point of sail), and the same rules as at one point.
 */

import type { LatLon } from '../../lib/geo.ts';
import { bearing, destination, distNM } from '../../lib/geo.ts';
import { bft, compassPoint } from '../../lib/wind.ts';
import type {
  DayVerdict,
  Hour,
  Light,
  PointOfSail,
  Thresholds,
} from '../../model/goNoGo.ts';
import { dayVerdict, hourLight } from '../../model/goNoGo.ts';
import type { Polar } from '../../model/polars.ts';
import type { RoutePoint } from '../../model/routes.ts';
import { pointName, routeLegs } from '../../model/routes.ts';
import type {
  RoutingResult,
  SailSpeed,
  Wind,
} from '../../model/sailRouting.ts';
import { routeSail } from '../../model/sailRouting.ts';
import { store } from '../../storage/store.ts';

import type { BriefingData, SeaMeasure } from './briefing.ts';
import {
  LIGHTS,
  briefingOf,
  briefingUrls,
  fromWord,
  hoursOf,
  readJson,
} from './briefing.ts';
import { currentShown } from './mapWeather.ts';

/** The current at a place and time: where it goes and its speed. */
export interface Current {
  /** Degrees, where it goes. */
  toward: number;
  /** Knots. */
  kn: number;
}

/** The currents asked of the sea model (km/h, where they go). */
const CURRENT_VARS = ['ocean_current_velocity', 'ocean_current_direction'];
const KMH_PER_KNOT = 1.852;

/** At most this many places are read along a route (one request). */
export const MOST_ROUTE_PLACES = 8;
/** About one place every this many miles. */
const PLACE_EVERY_NM = 8;
/** Days of forecast read for a route. */
const ROUTE_DAYS = 7;

/** The forecast at the places of a route. */
export interface RouteForecast {
  places: LatLon[];
  /** One per place, in the same order. */
  data: BriefingData[];
}

/**
 * Places along a route, evenly spaced by distance, the start and the end
 * among them.
 * @param points - The route.
 * @returns From 1 to {@link MOST_ROUTE_PLACES} places.
 */
export function routePlaces(points: readonly RoutePoint[]): LatLon[] {
  const legs = routeLegs(points);
  const total = legs.at(-1)?.totalNm ?? 0;
  const first = points[0];
  if (!first) return [];
  if (total === 0) return [{ lat: first.lat, lon: first.lon }];
  const count = Math.min(
    MOST_ROUTE_PLACES,
    Math.max(2, Math.ceil(total / PLACE_EVERY_NM - 0.01) + 1),
  );
  const places: LatLon[] = [];
  for (let rank = 0; rank < count; rank++) {
    places.push(positionAt(points, (total * rank) / (count - 1)).at);
  }
  return places;
}

/**
 * Where the boat is after so many miles along the route, and on which leg.
 * @param points - The route.
 * @param nm - Miles from the start.
 * @returns The place, the rank of the leg (from 0) and its course.
 */
export function positionAt(
  points: readonly RoutePoint[],
  nm: number,
): { at: LatLon; leg: number; course: number } {
  const legs = routeLegs(points);
  const first = points[0] ?? { lat: 0, lon: 0 };
  if (legs.length === 0) {
    return { at: { lat: first.lat, lon: first.lon }, leg: 0, course: 0 };
  }
  for (const [rank, leg] of legs.entries()) {
    if (nm <= leg.totalNm || rank === legs.length - 1) {
      const into = Math.min(leg.nm, Math.max(0, nm - (leg.totalNm - leg.nm)));
      const at =
        leg.nm > 0
          ? destination(leg.from, bearing(leg.from, leg.to), into)
          : leg.from;
      return {
        at: { lat: at.lat, lon: at.lon },
        leg: rank,
        course: leg.course,
      };
    }
  }
  return { at: first, leg: 0, course: 0 };
}

/**
 * Read the forecast at the places of a route: two requests (weather, sea),
 * kept 30 minutes.
 * @param points - The route.
 * @param lake - On a lake: no sea model.
 * @returns The forecast, or null without network.
 */
export async function readRouteForecast(
  points: readonly RoutePoint[],
  lake: boolean,
): Promise<RouteForecast | null> {
  const places = routePlaces(points);
  if (places.length === 0) return null;
  const urls = briefingUrls(places, lake, ROUTE_DAYS, CURRENT_VARS);
  const [weather, sea] = await Promise.all([
    readJson(urls.weather).catch(() => null),
    urls.sea ? readJson(urls.sea).catch(() => null) : null,
  ]);
  return routeForecastOf(places, weather, sea, urls.swiss);
}

/**
 * The forecast of a route from the replies of Open-Meteo (a list for several
 * places, one object for one).
 * @param places - The places asked.
 * @param weather - The weather reply.
 * @param sea - The sea reply, or null.
 * @param swiss - Read with the Swiss model.
 * @param at - When it was read.
 * @returns The forecast, or null when a place has none.
 */
export function routeForecastOf(
  places: LatLon[],
  weather: unknown,
  sea: unknown,
  swiss: boolean,
  at = Date.now(),
): RouteForecast | null {
  const weathers = replyList(weather);
  const seas = replyList(sea);
  const data: BriefingData[] = [];
  for (const [rank, place] of places.entries()) {
    const one = briefingOf(
      weathers[rank],
      seas[rank] ?? null,
      { ...place, name: `point ${rank + 1} de la route` },
      swiss,
      at,
      CURRENT_VARS,
    );
    if (!one) return null;
    data.push(one);
  }
  return { places, data };
}

function replyList(reply: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(reply)) return reply as Array<Record<string, unknown>>;
  return reply ? [reply as Record<string, unknown>] : [];
}

function nearestPlace(places: readonly LatLon[], at: LatLon): number {
  let place = 0;
  let nearest = Infinity;
  for (const [rank, spot] of places.entries()) {
    const away = distNM(spot, at);
    if (away < nearest) {
      nearest = away;
      place = rank;
    }
  }
  return place;
}

/**
 * A value of the forecast at a place and time, between its hours: speed and
 * direction mixed as vectors (350° and 10° give 0°).
 */
function vectorAt(
  data: BriefingData,
  speedName: string,
  dirName: string,
  ms: number,
): { speed: number; dir: number } | null {
  const { t, v } = data;
  const first = t[0];
  const last = t.at(-1);
  if (first == null || last == null || ms < first - HOUR || ms > last) {
    return null;
  }
  const at = Math.max(0, Math.min(t.length - 1, (ms - first) / HOUR));
  const low = Math.floor(at);
  const high = Math.min(low + 1, t.length - 1);
  const share = at - low;
  const pick = (rank: number) => ({
    speed: v[speedName]?.[rank],
    dir: v[dirName]?.[rank],
  });
  const a = pick(low);
  const b = pick(high);
  if (a.speed == null || a.dir == null || b.speed == null || b.dir == null) {
    return null;
  }
  const rad = Math.PI / 180;
  const x =
    a.speed * Math.cos(a.dir * rad) * (1 - share) +
    b.speed * Math.cos(b.dir * rad) * share;
  const y =
    a.speed * Math.sin(a.dir * rad) * (1 - share) +
    b.speed * Math.sin(b.dir * rad) * share;
  return {
    speed: a.speed * (1 - share) + b.speed * share,
    dir: (((Math.atan2(y, x) / rad) % 360) + 360) % 360,
  };
}

/**
 * The wind of the route forecast at a place and time (the nearest place).
 * @param forecast - The forecast of the route.
 * @returns The wind, `null` out of the forecast.
 */
export function routeWindAt(
  forecast: RouteForecast,
): (lat: number, lon: number, ms: number) => Wind | null {
  return (lat, lon, ms) => {
    const data = forecast.data[nearestPlace(forecast.places, { lat, lon })];
    const found =
      data && vectorAt(data, 'wind_speed_10m', 'wind_direction_10m', ms);
    return found ? { tws: found.speed, twd: found.dir } : null;
  };
}

/**
 * The current of the route forecast at a place and time (the nearest
 * place): on the Atlantic side, and in the Mediterranean only in its known
 * straits.
 * @param forecast - The forecast of the route.
 * @returns The current, `null` where none is known.
 */
export function routeCurrentAt(
  forecast: RouteForecast,
): (lat: number, lon: number, ms: number) => Current | null {
  return (lat, lon, ms) => {
    const place = nearestPlace(forecast.places, { lat, lon });
    const spot = forecast.places[place];
    const data = forecast.data[place];
    if (!spot || !data || !currentShown(spot)) return null;
    const found = vectorAt(
      data,
      'ocean_current_velocity',
      'ocean_current_direction',
      ms,
    );
    return found ? { kn: found.speed / KMH_PER_KNOT, toward: found.dir } : null;
  };
}

/** Where the boat is at a time, on which leg and steering what course. */
export interface TrackPoint {
  at: LatLon;
  /** Rank of the leg, from 0. */
  leg: number;
  /** Course steered, degrees. */
  course: number;
  /** Under motor. */
  motor: boolean;
}

/** The track of the boat along the route, in time. */
export interface Track {
  departMs: number;
  arriveMs: number;
  where: (ms: number) => TrackPoint;
  /** Start and end of each leg, epoch ms. */
  legTimes: Array<{ startMs: number; endMs: number }>;
  /** How the times were found, in words. */
  how: string;
  /** From the polar routing. */
  routed: boolean;
}

/**
 * The track at the planned speed over the ground.
 * @param points - The route.
 * @param speed - Knots.
 * @param departMs - Departure, epoch ms.
 * @returns The track.
 */
export function speedTrack(
  points: readonly RoutePoint[],
  speed: number,
  departMs: number,
): Track {
  const legs = routeLegs(points);
  const nm = legs.at(-1)?.totalNm ?? 0;
  return {
    departMs,
    // Without a speed, no time: the briefing says so.
    arriveMs: speed > 0 ? departMs + (nm / speed) * HOUR : departMs,
    where: (ms) => {
      const sailed = Math.min(
        nm,
        Math.max(0, ((ms - departMs) / HOUR) * speed),
      );
      return { ...positionAt(points, sailed), motor: false };
    },
    legTimes: legs.map((leg) => ({
      startMs: departMs + ((leg.totalNm - leg.nm) / speed) * HOUR,
      endMs: departMs + (leg.totalNm / speed) * HOUR,
    })),
    how: `à ${fr(speed, 1)} nd (vitesse prévue)`,
    routed: false,
  };
}

/**
 * The track of a polar routing: the boat where the routing puts it, with
 * its tacks and its gybes, its course steered and its motor.
 * @param points - The route.
 * @param result - The routing done.
 * @param departMs - Departure, epoch ms.
 * @returns The track.
 */
export function routingTrack(
  points: readonly RoutePoint[],
  result: Extract<RoutingResult, { kind: 'done' }>,
  departMs: number,
): Track {
  const { steps, legs, tacks, gybes, motorMin, arriveMs } = result;
  const end = points.at(-1) ?? { lat: 0, lon: 0 };
  const lastLeg = Math.max(0, points.length - 2);
  const manoeuvres = tacks + gybes;
  const motor =
    motorMin > 0 ? `, moteur ${durationWords(motorMin * 60_000)}` : '';
  return {
    departMs,
    arriveMs,
    where: (ms) => {
      let rank = -1;
      for (const [index, step] of steps.entries()) {
        if (step.ms <= ms) rank = index;
        else break;
      }
      const step = steps[Math.max(0, rank)];
      if (!step || ms >= arriveMs) {
        return {
          at: { lat: end.lat, lon: end.lon },
          leg: lastLeg,
          course: step?.course ?? 0,
          motor: false,
        };
      }
      const next = steps[rank + 1];
      const nextAt = next ?? { ...end, ms: arriveMs };
      const share =
        rank < 0 || nextAt.ms <= step.ms
          ? 0
          : Math.min(1, (ms - step.ms) / (nextAt.ms - step.ms));
      return {
        at: {
          lat: step.lat + (nextAt.lat - step.lat) * share,
          lon: step.lon + (nextAt.lon - step.lon) * share,
        },
        leg: Math.max(0, step.toPoint - 1),
        course: step.course,
        motor: step.mode === 'motor',
      };
    },
    legTimes: legs.map((leg, rank) => ({
      startMs: rank === 0 ? departMs : (legs[rank - 1]?.arriveMs ?? departMs),
      endMs: leg.arriveMs,
    })),
    how: `au routage polaire (${manoeuvres} virement${manoeuvres > 1 ? 's' : ''} ou empannage${manoeuvres > 1 ? 's' : ''}${motor})`,
    routed: true,
  };
}

/** What the polar routing needs of the boat. */
export interface RoutingBoat {
  polar: Polar;
  sailSpeed: (twa: number, tws: number) => SailSpeed;
  motorBelow: number;
  motorKn: number;
}

/**
 * The track of the boat: the polar routing with the wind of the route
 * forecast when the boat has a polar, else (or when the
 * routing finds no wind) the planned speed.
 * @param points - The route.
 * @param departMs - Departure, epoch ms.
 * @param forecast - The forecast of the route.
 * @param boat - The polar and the motor of the boat, or null.
 * @param speed - Planned speed, knots, for want of a routing.
 * @returns The track, and why the planned speed when it is used.
 */
export function routeTrack(
  points: readonly RoutePoint[],
  departMs: number,
  forecast: RouteForecast,
  boat: RoutingBoat | null,
  speed: number,
): { track: Track; note: string | null } {
  const bySpeed = (note: string) => ({
    track: speedTrack(points, speed, departMs),
    note,
  });
  if (!boat) {
    return bySpeed(
      'Ce bateau n’a pas de polaire (Bateaux › ⛵ Polaire) : durée à la vitesse prévue.',
    );
  }
  const result = routeSail({
    points,
    departMs,
    windAt: routeWindAt(forecast),
    sailSpeed: boat.sailSpeed,
    polar: boat.polar,
    motorBelow: boat.motorBelow,
    motorKn: boat.motorKn,
  });
  if (result.kind === 'done') {
    return { track: routingTrack(points, result, departMs), note: null };
  }
  const offset = forecast.data[0]?.offset ?? 0;
  return bySpeed(
    result.kind === 'no-wind'
      ? `Le routage polaire sort de la prévision vers ${whenWords(result.ms, offset)} : durée à la vitesse prévue.`
      : 'Le routage polaire dépasse 14 jours : durée à la vitesse prévue.',
  );
}

/** One hour of the route: where the boat is, and its weather. */
export interface RouteHour {
  hour: Hour;
  lat: number;
  lon: number;
  /** Course steered, degrees. */
  course: number;
  /** Rank of the leg, from 0. */
  leg: number;
  motor: boolean;
  light: Light;
  point: PointOfSail;
}

/** One leg of the route, as the go / no-go reads it. */
export interface RouteLegView {
  leg: number;
  name: string;
  course: number;
  nm: number;
  startMs: number;
  endMs: number;
  windMin: number | null;
  windMax: number | null;
  /** Direction of the strongest wind, degrees. */
  windFrom: number | null;
  gustMax: number | null;
  hsMax: number | null;
  /** Strongest current met, knots, null where none is known. */
  currentMax: number | null;
  points: PointOfSail[];
  light: Light;
}

/** The go / no-go of a route. */
export interface RouteBriefing {
  departMs: number;
  arriveMs: number;
  nm: number;
  /** Offset of local time, seconds. */
  offset: number;
  hours: RouteHour[];
  legs: RouteLegView[];
  verdict: DayVerdict;
  /** Hours of the route out of the forecast. */
  missing: number;
  lines: string[];
  src: string;
  at: number;
  /** How the times were found, in words. */
  how: string;
  routed: boolean;
}

const HOUR = 3_600_000;
const RANK: Readonly<Record<Light, number>> = { go: 0, prudence: 1, nogo: 2 };

const fr = (value: number, digits = 0) =>
  (Math.round(value * 10 ** digits) / 10 ** digits)
    .toString()
    .replace('.', ',');

const max = (values: ReadonlyArray<number | null>) => {
  const kept = values.filter((value): value is number => value != null);
  return kept.length > 0 ? Math.max(...kept) : null;
};

const min = (values: ReadonlyArray<number | null>) => {
  const kept = values.filter((value): value is number => value != null);
  return kept.length > 0 ? Math.min(...kept) : null;
};

/** The words of a point of sail. */
export const POINT_WORDS: Readonly<Record<PointOfSail, string>> = {
  pres: 'près',
  travers: 'travers',
  portant: 'portant',
};

/**
 * A time in words, local: « sam. 23, 9 h 30 ».
 * @param ms - Epoch ms.
 * @param offset - Offset of local time, seconds.
 * @param withDay - With the day.
 * @returns The words.
 */
export function whenWords(ms: number, offset: number, withDay = true): string {
  // To 5 minutes: a plan, not a timetable.
  const local = new Date(Math.round((ms + offset * 1000) / 300_000) * 300_000);
  const minutes = local.getUTCMinutes();
  const time = `${local.getUTCHours()} h${minutes ? ` ${String(minutes).padStart(2, '0')}` : ''}`;
  if (!withDay) return time;
  const day = local.toLocaleDateString('fr-CH', {
    weekday: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
  return `${day}, ${time}`;
}

function durationWords(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return `${hours} h${rest ? ` ${String(rest).padStart(2, '0')}` : ''}`;
}

/**
 * The go / no-go of a route, along the track of the boat.
 * @param points - The route.
 * @param track - Where the boat is, in time.
 * @param forecast - The forecast at the places of the route.
 * @param limits - The thresholds of the boat.
 * @param measure - The measure typed at sea, or null.
 * @returns The briefing, or why there is none.
 */
export function routeBriefing(
  points: readonly RoutePoint[],
  track: Track,
  forecast: RouteForecast,
  limits: Thresholds,
  measure: SeaMeasure | null,
): RouteBriefing | { error: string } {
  const legs = routeLegs(points);
  const nm = legs.at(-1)?.totalNm ?? 0;
  if (legs.length === 0 || nm === 0) {
    return { error: 'La route doit avoir au moins deux points distincts.' };
  }
  const { departMs, arriveMs, legTimes, how, routed } = track;
  if (!(arriveMs > departMs)) {
    return { error: 'La route n’a pas de vitesse prévue (Routes).' };
  }
  const first = forecast.data[0];
  if (!first) return { error: 'Pas de prévision le long de la route.' };
  const currentAt = routeCurrentAt(forecast);
  const perPlace = forecast.data.map((data) => hoursOf(data, measure));
  // Each hour of the forecast while the boat sails, the departure and the
  // arrival hours included.
  const fromHour = Math.floor(departMs / HOUR) * HOUR;
  const toHour = Math.ceil(arriveMs / HOUR) * HOUR;
  const hours: RouteHour[] = [];
  let missing = 0;
  const courses = new Map<Hour, number>();
  for (let t = fromHour; t <= toHour; t += HOUR) {
    const where = track.where(Math.max(t, departMs));
    const place = nearestPlace(forecast.places, where.at);
    const index = forecast.data[place]?.t.indexOf(t) ?? -1;
    const found = index === -1 ? undefined : perPlace[place]?.[index];
    if (found?.windKn == null) {
      missing++;
      continue;
    }
    const current = currentAt(where.at.lat, where.at.lon, t);
    const hour: Hour = {
      ...found,
      currentKn: current ? current.kn : null,
      currentToward: current ? current.toward : null,
    };
    courses.set(hour, where.course);
    hours.push({
      hour,
      lat: where.at.lat,
      lon: where.at.lon,
      course: where.course,
      leg: where.leg,
      motor: where.motor,
      light: 'go',
      point: 'pres',
    });
  }
  if (hours.length === 0) {
    return {
      error:
        'La route est hors de la prévision (7 jours au plus) : choisissez un départ plus proche.',
    };
  }
  // The 3 hours before the departure, at the start, for the fall of pressure.
  const startIndex = first.t.indexOf(fromHour);
  const before =
    startIndex > 0
      ? (perPlace[0] ?? []).slice(Math.max(0, startIndex - 3), startIndex)
      : [];
  const routeHours = hours.map((one) => one.hour);
  const all = [...before, ...routeHours];
  const courseOf = (hour: Hour) => courses.get(hour) ?? null;
  const verdict = dayVerdict(routeHours, all, limits, courseOf);
  for (const one of hours) {
    const { light, point } = hourLight(one.hour, all, limits, courseOf);
    one.light = light;
    one.point = point;
  }
  const legViews = legs.map((leg, rank): RouteLegView => {
    const own = hours.filter((one) => one.leg === rank);
    const times = legTimes[rank] ?? {
      startMs: departMs,
      endMs: arriveMs,
    };
    const windMax = max(own.map((one) => one.hour.windKn));
    let light: Light = 'go';
    for (const one of own) if (RANK[one.light] > RANK[light]) light = one.light;
    return {
      leg: rank,
      name: `${pointName(points, rank)} → ${pointName(points, rank + 1)}`,
      course: leg.course,
      nm: leg.nm,
      startMs: times.startMs,
      endMs: times.endMs,
      windMin: min(own.map((one) => one.hour.windKn)),
      windMax,
      windFrom:
        own.find((one) => one.hour.windKn === windMax)?.hour.windFrom ?? null,
      gustMax: max(own.map((one) => one.hour.gustKn)),
      hsMax: max(own.map((one) => one.hour.hs)),
      currentMax: max(own.map((one) => one.hour.currentKn ?? null)),
      points: [...new Set(own.map((one) => one.point))],
      light,
    };
  });
  const offset = first.offset;
  const lines = routeLines(points, track, nm, hours, legViews, offset);
  if (missing > 0) {
    lines.push(
      `${missing} heure${missing > 1 ? 's' : ''} de la route hors de la prévision : le feu ne les compte pas.`,
    );
  }
  return {
    departMs,
    arriveMs,
    nm,
    offset,
    hours,
    legs: legViews,
    verdict,
    missing,
    lines,
    src: first.src,
    at: first.at,
    how,
    routed,
  };
}

function routeLines(
  points: readonly RoutePoint[],
  track: Track,
  nm: number,
  hours: readonly RouteHour[],
  legs: readonly RouteLegView[],
  offset: number,
): string[] {
  const { departMs, arriveMs, how, routed } = track;
  const lines = [
    `Départ ${whenWords(departMs, offset)} de ${pointName(points, 0)}, arrivée vers ${whenWords(arriveMs, offset)} à ${pointName(points, points.length - 1)} : ${fr(nm, 1)} NM en ${durationWords(arriveMs - departMs)} ${how}.`,
  ];
  const windMax = max(hours.map((one) => one.hour.windKn));
  const windMin = min(hours.map((one) => one.hour.windKn));
  const gustMax = max(hours.map((one) => one.hour.gustKn));
  const strongest = hours.find((one) => one.hour.windKn === windMax);
  if (windMax != null && windMin != null && strongest) {
    const from =
      strongest.hour.windFrom == null
        ? ''
        : `${fromWord(compassPoint(strongest.hour.windFrom))} `;
    const range =
      Math.round(windMin) === Math.round(windMax)
        ? `${fr(windMax)} nd`
        : `${fr(windMin)} à ${fr(windMax)} nd`;
    lines.push(
      `Vent ${from}${range} le long de la route (force ${bft(windMax)}${gustMax == null ? '' : `, rafales ${fr(gustMax)} nd`}), au plus fort vers ${whenWords(strongest.hour.t, offset, false)} sur ${legs[strongest.leg]?.name ?? ''}, au ${POINT_WORDS[strongest.point]}.`,
    );
  }
  const hsMax = max(hours.map((one) => one.hour.hs));
  const highest = hours.find((one) => one.hour.hs === hsMax);
  if (hsMax == null) {
    lines.push('Mer : pas de prévision de vagues sur cette route.');
  } else if (highest) {
    lines.push(
      `Mer : Hs ${fr(hsMax, 1)} m au plus${highest.hour.period == null ? '' : ` (${fr(highest.hour.period, 1)} s)`}, vers ${whenWords(highest.hour.t, offset, false)} sur ${legs[highest.leg]?.name ?? ''}.`,
    );
  }
  lines.push(...currentLines(hours, legs, offset));
  const upwind = legs.filter((leg) => leg.points.includes('pres'));
  if (upwind.length > 0 && !routed) {
    lines.push(
      `Au près sur ${upwind.map((leg) => leg.name).join(', ')} : virements à prévoir, la durée peut s’allonger.`,
    );
  }
  let rain = 0;
  for (const one of hours) rain += one.hour.rain ?? 0;
  if (rain >= 1) lines.push(`Pluie : ${fr(rain)} mm sur la route.`);
  const night = hours.filter((one) => {
    const h = new Date(one.hour.t + offset * 1000).getUTCHours();
    return h < 7 || h > 19;
  });
  if (night.length > 0) {
    lines.push(
      `Navigation de nuit (environ ${night.length} h) : feux, quarts et veille.`,
    );
  }
  return lines;
}

function currentLines(
  hours: readonly RouteHour[],
  legs: readonly RouteLegView[],
  offset: number,
): string[] {
  const known = hours.filter((one) => one.hour.currentKn != null);
  if (known.length === 0) {
    return [
      'Courants : aucun courant connu sur cette route (lac, ou Méditerranée hors détroits).',
    ];
  }
  const along = (one: RouteHour) =>
    (one.hour.currentKn ?? 0) *
    Math.cos((((one.hour.currentToward ?? 0) - one.course) * Math.PI) / 180);
  let strongest = known[0] as RouteHour;
  for (const one of known) {
    if ((one.hour.currentKn ?? 0) > (strongest.hour.currentKn ?? 0)) {
      strongest = one;
    }
  }
  const kn = strongest.hour.currentKn ?? 0;
  if (kn < 0.3) {
    return ['Courants : faibles le long de la route (moins de 0,3 nd).'];
  }
  const share = along(strongest);
  const how =
    Math.abs(share) < kn / 3
      ? 'de travers'
      : share > 0
        ? 'porteur'
        : 'contraire';
  const helping = known.filter((one) => along(one) >= 0.3).length;
  const against = known.filter((one) => along(one) <= -0.3).length;
  return [
    `Courants : jusqu’à ${fr(kn, 1)} nd ${how} vers ${whenWords(strongest.hour.t, offset, false)} sur ${legs[strongest.leg]?.name ?? ''}${helping + against > 0 ? ` ; porteur environ ${helping} h, contraire environ ${against} h` : ''}.`,
  ];
}

/**
 * One leg in words, units included: « P1 → Grand Léjon · 6,7 NM · 9 h →
 * 10 h 05 · cap 29°, portant · vent 12 nd d’O, rafales 16 nd · Hs 1,2 m ».
 * @param leg - The leg.
 * @param offset - Offset of local time, seconds.
 * @returns The words.
 */
export function legWords(leg: RouteLegView, offset: number): string {
  const wind =
    leg.windMax == null
      ? 'vent hors prévision'
      : `vent ${leg.windMin != null && Math.round(leg.windMin) !== Math.round(leg.windMax) ? `${fr(leg.windMin)} à ` : ''}${fr(leg.windMax)} nd${leg.windFrom == null ? '' : ` ${fromWord(compassPoint(leg.windFrom))}`}${leg.gustMax == null ? '' : `, rafales ${fr(leg.gustMax)} nd`}`;
  const points = leg.points.map((one) => POINT_WORDS[one]).join(' puis ');
  return [
    leg.name,
    `${fr(leg.nm, 1)} NM`,
    `${whenWords(leg.startMs, offset, leg.leg === 0)} → ${whenWords(leg.endMs, offset, false)}`,
    `cap ${leg.course}°${points ? `, ${points}` : ''}`,
    wind,
    ...(leg.hsMax == null ? [] : [`Hs ${fr(leg.hsMax, 1)} m`]),
    ...(leg.currentMax == null || leg.currentMax < 0.3
      ? []
      : [`courant ${fr(leg.currentMax, 1)} nd au plus`]),
  ].join(' · ');
}

/**
 * The route for the prompt of an AI: its legs, its hours, NavIn's light.
 * @param name - The name of the route.
 * @param briefing - The go / no-go of the route.
 * @returns The lines.
 */
export function routePrompt(name: string, briefing: RouteBriefing): string {
  const { offset, lines, hours, verdict } = briefing;
  return [
    '',
    `Route prévue « ${name} » : ${lines[0] ?? ''}`,
    'Heure par heure le long de la route (heure locale) : heure | position | cap ° | allure | vent nd | direction ° | rafales nd | Hs m | courant nd vers °',
    ...hours.map(
      (one) =>
        `${whenWords(one.hour.t, offset)} | ${fr(one.lat, 3)}, ${fr(one.lon, 3)} | ${one.course} | ${POINT_WORDS[one.point]} | ${one.hour.windKn == null ? '–' : fr(one.hour.windKn)} | ${one.hour.windFrom == null ? '–' : fr(one.hour.windFrom)} | ${one.hour.gustKn == null ? '–' : fr(one.hour.gustKn)} | ${one.hour.hs == null ? '–' : fr(one.hour.hs, 1)} | ${one.hour.currentKn == null ? '–' : `${fr(one.hour.currentKn, 1)} vers ${fr(one.hour.currentToward ?? 0)}`}`,
    ),
    `Avis de NavIn sur la route : ${LIGHTS[verdict.light].word}${verdict.reasons.length > 0 ? ` (${verdict.reasons.join(' ; ')})` : ''}.`,
    'Donne aussi ton avis sur cette route à cet horaire : meilleur créneau de départ, passages délicats.',
  ].join('\n');
}

/** The route forecasts kept for offline, by route (the newest few). */
const PACKET_KEY = 'navin.gngRoutePackets';
/** At most this many routes kept offline. */
const MOST_PACKETS = 4;

/** A route forecast kept for offline. */
export interface RoutePacket {
  routeId: string;
  /** The points it was read for, as JSON: changed points, a new reading. */
  points: string;
  forecast: RouteForecast;
}

/**
 * Keep the forecast of a route for offline (the newest {@link MOST_PACKETS}
 * routes).
 * @param routeId - The route.
 * @param points - Its points.
 * @param forecast - Its forecast.
 * @returns Kept (false: storage full).
 */
export function keepRoutePacket(
  routeId: string,
  points: readonly RoutePoint[],
  forecast: RouteForecast,
): boolean {
  const others = keptRoutePackets().filter((one) => one.routeId !== routeId);
  const packet: RoutePacket = {
    routeId,
    points: JSON.stringify(points),
    forecast,
  };
  return store.set(PACKET_KEY, [packet, ...others].slice(0, MOST_PACKETS));
}

/**
 * The route forecasts kept.
 * @returns Them, newest first.
 */
export function keptRoutePackets(): RoutePacket[] {
  const kept = store.get<unknown>(PACKET_KEY, []);
  return Array.isArray(kept)
    ? (kept as RoutePacket[]).filter(
        (one) =>
          typeof one.routeId === 'string' &&
          typeof one.points === 'string' &&
          Array.isArray(one.forecast?.data),
      )
    : [];
}

/**
 * The forecast kept for a route, while its points are the same.
 * @param routeId - The route.
 * @param points - Its points now.
 * @returns The forecast, or null.
 */
export function keptRouteForecast(
  routeId: string,
  points: readonly RoutePoint[],
): RouteForecast | null {
  const text = JSON.stringify(points);
  return (
    keptRoutePackets().find(
      (one) => one.routeId === routeId && one.points === text,
    )?.forecast ?? null
  );
}
