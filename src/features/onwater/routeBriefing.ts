/**
 * The go / no-go along a route: the forecast read at a few places along it,
 * then, hour by hour, where the boat is at its planned speed from its
 * departure, the weather of the nearest place, the course of the leg it
 * sails (for the point of sail), and the same rules as at one point.
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
import type { RoutePoint } from '../../model/routes.ts';
import { pointName, routeLegs } from '../../model/routes.ts';

import type { BriefingData, SeaMeasure } from './briefing.ts';
import {
  LIGHTS,
  briefingOf,
  briefingUrls,
  fromWord,
  hoursOf,
  readJson,
} from './briefing.ts';

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
  const urls = briefingUrls(places, lake, ROUTE_DAYS);
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

/** One hour of the route: where the boat is, and its weather. */
export interface RouteHour {
  hour: Hour;
  lat: number;
  lon: number;
  /** Course of the leg sailed, degrees. */
  course: number;
  /** Rank of the leg, from 0. */
  leg: number;
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
 * The go / no-go of a route, sailed at its planned speed from a departure.
 * @param route - The points and the planned speed.
 * @param route.points - The points.
 * @param route.speed - Planned speed over the ground, knots.
 * @param departMs - Departure, epoch ms.
 * @param forecast - The forecast at the places of the route.
 * @param limits - The thresholds of the boat.
 * @param measure - The measure typed at sea, or null.
 * @returns The briefing, or why there is none.
 */
export function routeBriefing(
  route: { points: readonly RoutePoint[]; speed: number },
  departMs: number,
  forecast: RouteForecast,
  limits: Thresholds,
  measure: SeaMeasure | null,
): RouteBriefing | { error: string } {
  const { points, speed } = route;
  const legs = routeLegs(points);
  const nm = legs.at(-1)?.totalNm ?? 0;
  if (legs.length === 0 || nm === 0) {
    return { error: 'La route doit avoir au moins deux points distincts.' };
  }
  if (!(speed > 0)) {
    return { error: 'La route n’a pas de vitesse prévue (Routes).' };
  }
  const first = forecast.data[0];
  if (!first) return { error: 'Pas de prévision le long de la route.' };
  const arriveMs = departMs + (nm / speed) * HOUR;
  const perPlace = forecast.data.map((data) => hoursOf(data, measure));
  // Each hour of the forecast while the boat sails, the departure and the
  // arrival hours included.
  const fromHour = Math.floor(departMs / HOUR) * HOUR;
  const toHour = Math.ceil(arriveMs / HOUR) * HOUR;
  const hours: RouteHour[] = [];
  let missing = 0;
  const courses = new Map<Hour, number>();
  for (let t = fromHour; t <= toHour; t += HOUR) {
    const sailed = Math.min(nm, Math.max(0, ((t - departMs) / HOUR) * speed));
    const where = positionAt(points, sailed);
    let place = 0;
    let nearest = Infinity;
    for (const [rank, spot] of forecast.places.entries()) {
      const away = distNM(spot, where.at);
      if (away < nearest) {
        nearest = away;
        place = rank;
      }
    }
    const index = forecast.data[place]?.t.indexOf(t) ?? -1;
    const found = index === -1 ? undefined : perPlace[place]?.[index];
    if (found?.windKn == null) {
      missing++;
      continue;
    }
    const hour: Hour = { ...found };
    courses.set(hour, where.course);
    hours.push({
      hour,
      lat: where.at.lat,
      lon: where.at.lon,
      course: where.course,
      leg: where.leg,
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
    const startMs = departMs + ((leg.totalNm - leg.nm) / speed) * HOUR;
    const windMax = max(own.map((one) => one.hour.windKn));
    let light: Light = 'go';
    for (const one of own) if (RANK[one.light] > RANK[light]) light = one.light;
    return {
      leg: rank,
      name: `${pointName(points, rank)} → ${pointName(points, rank + 1)}`,
      course: leg.course,
      nm: leg.nm,
      startMs,
      endMs: departMs + (leg.totalNm / speed) * HOUR,
      windMin: min(own.map((one) => one.hour.windKn)),
      windMax,
      windFrom:
        own.find((one) => one.hour.windKn === windMax)?.hour.windFrom ?? null,
      gustMax: max(own.map((one) => one.hour.gustKn)),
      hsMax: max(own.map((one) => one.hour.hs)),
      points: [...new Set(own.map((one) => one.point))],
      light,
    };
  });
  const offset = first.offset;
  const lines = routeLines(
    points,
    departMs,
    arriveMs,
    nm,
    speed,
    hours,
    legViews,
    offset,
  );
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
  };
}

function routeLines(
  points: readonly RoutePoint[],
  departMs: number,
  arriveMs: number,
  nm: number,
  speed: number,
  hours: readonly RouteHour[],
  legs: readonly RouteLegView[],
  offset: number,
): string[] {
  const lines = [
    `Départ ${whenWords(departMs, offset)} de ${pointName(points, 0)}, arrivée vers ${whenWords(arriveMs, offset)} à ${pointName(points, points.length - 1)} : ${fr(nm, 1)} NM en ${durationWords(arriveMs - departMs)} à ${fr(speed, 1)} nd.`,
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
  const upwind = legs.filter((leg) => leg.points.includes('pres'));
  if (upwind.length > 0) {
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

/**
 * The route for the prompt of an AI: its legs, its hours, NavIn's light.
 * @param name - The name of the route.
 * @param briefing - The go / no-go of the route.
 * @returns The lines.
 */
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
  ].join(' · ');
}

export function routePrompt(name: string, briefing: RouteBriefing): string {
  const { offset, lines, hours, verdict } = briefing;
  return [
    '',
    `Route prévue « ${name} » : ${lines[0] ?? ''}`,
    'Heure par heure le long de la route (heure locale) : heure | position | cap ° | allure | vent nd | direction ° | rafales nd | Hs m',
    ...hours.map(
      (one) =>
        `${whenWords(one.hour.t, offset)} | ${fr(one.lat, 3)}, ${fr(one.lon, 3)} | ${one.course} | ${POINT_WORDS[one.point]} | ${one.hour.windKn == null ? '–' : fr(one.hour.windKn)} | ${one.hour.windFrom == null ? '–' : fr(one.hour.windFrom)} | ${one.hour.gustKn == null ? '–' : fr(one.hour.gustKn)} | ${one.hour.hs == null ? '–' : fr(one.hour.hs, 1)}`,
    ),
    `Avis de NavIn sur la route : ${LIGHTS[verdict.light].word}${verdict.reasons.length > 0 ? ` (${verdict.reasons.join(' ; ')})` : ''}.`,
    'Donne aussi ton avis sur cette route à cet horaire : meilleur créneau de départ, passages délicats.',
  ].join('\n');
}
