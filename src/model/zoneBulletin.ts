/*
 * The sailing bulletin of a zone, written by rules and without AI, in the
 * universal order of a sailing bulletin (Corban, 22/11/2026):
 * 1 alerts, 2 general situation, 3 wind, 4 sea (or chop on a lake), 5
 * weather and visibility. Each kind of zone has its own words: a lake (no
 * tide nor swell, a short chop, winds made by the relief and the heat), the
 * Channel and the Atlantic (tide, currents, swell), the Mediterranean
 * (regional winds, short fetch). Nothing is made up: what NavIn cannot read
 * (the text of the BMS, the tides of the SHOM) is said, with its link.
 */

import { shownOffset, showsUtc, utcMark } from '../lib/clockMode.ts';
import { bft, compassPoint } from '../lib/wind.ts';

import { fetchSea } from './fetchWaves.ts';
import { NOGO_WIND_MAX } from './goNoGo.ts';

/** The kind of a zone, for its bulletin. */
export type ZoneKind = 'lac' | 'manche' | 'med';

/** The hourly forecast read at the point (the same as the go / no-go). */
export interface BulletinData {
  /** When it was read, epoch ms. */
  at: number;
  /** Source of the weather. */
  src: string;
  /** Offset of local time, seconds. */
  offset: number;
  /** Hourly times, epoch ms (UTC). */
  t: number[];
  /** Variable → hourly values. */
  v: Record<string, Array<number | null>>;
}

/** The pressure at the places that tell the regional winds. */
export interface Gradient {
  /** Hourly times, epoch ms. */
  t: number[];
  /** Place → pressure at sea level, hPa. */
  p: Record<string, Array<number | null>>;
}

/** A warning of MeteoSwiss for a lake, as NavIn read it. */
export interface LakeAlert {
  name: string;
  level: number;
  onset: number;
  expires: number;
}

/** What the bulletin is made from. */
export interface BulletinInput {
  kind: ZoneKind;
  lat: number;
  lon: number;
  /** Its name, for the title. */
  name: string;
  data: BulletinData;
  now: number;
  /** Pressures at the places of the regional winds, null if unread. */
  gradient: Gradient | null;
  /** Warnings of MeteoSwiss on the lake: null when they could not be read. */
  lakeAlerts: LakeAlert[] | null;
  /** The fetch (km) of a wind coming from a direction, null without map. */
  fetchKm: ((from: number) => number | null) | null;
}

/** A table of the bulletin: units in the head, repeated at the foot. */
export interface BulletinTable {
  head: string[];
  rows: string[][];
}

/** One of the five levels. */
export interface BulletinLevel {
  level: 1 | 2 | 3 | 4 | 5;
  title: string;
  /** The sentences, in order of importance. */
  lines: string[];
  table: BulletinTable | null;
  /** Sites to open in one tap (keys of the list of sites). */
  links: string[];
  /** What NavIn could not read for this level. */
  missing: string[];
}

/** The bulletin. */
export interface Bulletin {
  kind: ZoneKind;
  title: string;
  /** Read when, from what. */
  source: string;
  /** The forecast is older than 6 h. */
  old: boolean;
  levels: BulletinLevel[];
}

/** Hours of forecast the bulletin speaks of. */
export const BULLETIN_HOURS = 48;
/** Hours between the lines of the tables. */
const STEP = 3;
/** Older than this, the forecast is said old. */
const OLD_MS = 6 * 3_600_000;

/** Places whose pressures tell the winds of the lakes and of Provence. */
export const GRADIENT_PLACES = {
  geneve: { lat: 46.24, lon: 6.11, name: 'Genève' },
  zurich: { lat: 47.46, lon: 8.55, name: 'Zurich' },
  lugano: { lat: 46, lon: 8.96, name: 'Lugano' },
  genes: { lat: 44.4, lon: 8.93, name: 'Gênes' },
} as const;

/** The places read for a kind of zone. */
export function gradientPlaces(
  kind: ZoneKind,
): Array<keyof typeof GRADIENT_PLACES> {
  if (kind === 'lac') return ['geneve', 'zurich', 'lugano'];
  if (kind === 'med') return ['genes'];
  return [];
}

/**
 * The kind of zone of a point.
 * @param point - The point.
 * @param point.lat - Latitude.
 * @param point.lon - Longitude.
 * @param lake - The point is on a lake.
 * @returns lake, Mediterranean, else Channel and Atlantic.
 */
export function zoneKindOf(
  point: { lat: number; lon: number },
  lake: boolean,
): ZoneKind {
  if (lake) return 'lac';
  const { lat, lon } = point;
  if (lat > 30 && lat < 44.5 && lon > 2.9 && lon < 37) return 'med';
  return 'manche';
}

/**
 * On the Léman (its local winds have names).
 * @param point - The point.
 * @param point.lat - Latitude.
 * @param point.lon - Longitude.
 * @returns Whether it is.
 */
export function onLeman(point: { lat: number; lon: number }): boolean {
  return (
    point.lat > 46.15 &&
    point.lat < 46.56 &&
    point.lon > 6.1 &&
    point.lon < 6.95
  );
}

/**
 * Near Porquerolles and the rade of Hyères (its own shelters).
 * @param point - The point.
 * @param point.lat - Latitude.
 * @param point.lon - Longitude.
 * @returns Whether it is.
 */
function nearPorquerolles(point: { lat: number; lon: number }): boolean {
  return (
    point.lat > 42.9 && point.lat < 43.2 && point.lon > 5.85 && point.lon < 6.5
  );
}

const fr = (value: number, digits = 0): string =>
  (Math.round(value * 10 ** digits) / 10 ** digits)
    .toString()
    .replace('.', ',')
    .replace('-', '−');

const cell = (value: number | null | undefined, digits = 0): string =>
  value == null || !Number.isFinite(value) ? '–' : fr(value, digits);

/** One hour, read. */
interface H {
  t: number;
  /** Local hour 0–23. */
  hour: number;
  wind: number | null;
  from: number | null;
  gust: number | null;
  p: number | null;
  rain: number | null;
  cape: number | null;
  cin: number | null;
  temp: number | null;
  dew: number | null;
  hs: number | null;
  period: number | null;
  windSeaHs: number | null;
  windSeaPeriod: number | null;
  swellHs: number | null;
  swellPeriod: number | null;
  swellDir: number | null;
}

function hoursOf(data: BulletinData, now: number): H[] {
  const at = (name: string, index: number): number | null => {
    const value = data.v[name]?.[index];
    return value == null || !Number.isFinite(value) ? null : value;
  };
  const first = data.t.findIndex((t) => t > now - 3_600_000);
  if (first === -1) return [];
  const out: H[] = [];
  for (
    let index = first;
    index < data.t.length && index < first + BULLETIN_HOURS;
    index++
  ) {
    const t = data.t[index] ?? 0;
    out.push({
      t,
      hour: new Date(t + data.offset * 1000).getUTCHours(),
      wind: at('wind_speed_10m', index),
      from: at('wind_direction_10m', index),
      gust: at('wind_gusts_10m', index),
      p: at('pressure_msl', index),
      rain: at('precipitation', index),
      cape: at('cape', index),
      cin: at('convective_inhibition', index),
      temp: at('temperature_2m', index),
      dew: at('dew_point_2m', index),
      hs: at('wave_height', index),
      period: at('wave_period', index),
      windSeaHs: at('wind_wave_height', index),
      windSeaPeriod: at('wind_wave_period', index),
      swellHs: at('swell_wave_height', index),
      swellPeriod: at('swell_wave_period', index),
      swellDir: at('swell_wave_direction', index),
    });
  }
  return out;
}

const WEEKDAYS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];

/**
 * The head of the hour column of the tables.
 * @returns « Heure locale », or « Heure UTC » when the clock shows UTC.
 */
function hourHead(): string {
  return showsUtc() ? 'Heure UTC' : 'Heure locale';
}

/**
 * A time in words, local to the place: « 14 h » today, « dem. 14 h »,
 * else the day; in UTC, « 14 h UTC », when the top bar clock shows UTC.
 * @param t - Epoch ms.
 * @param now - Epoch ms.
 * @param offset - Offset of local time, s.
 * @param mark - Write « UTC » after a UTC hour (not in a table, whose head
 * says it).
 * @returns The words.
 */
export function whenLocal(
  t: number,
  now: number,
  offset: number,
  mark = true,
): string {
  // In UTC when the top bar clock shows UTC.
  const shown = shownOffset(offset);
  const local = new Date(t + shown * 1000);
  const today = new Date(now + shown * 1000);
  const day = (date: Date) => Math.floor(date.getTime() / 86_400_000);
  const shift = day(local) - day(today);
  const hour = `${local.getUTCHours()} h${mark ? utcMark() : ''}`;
  if (shift === 0) return hour;
  if (shift === 1) return `dem. ${hour}`;
  return `${WEEKDAYS[local.getUTCDay()] ?? ''} ${hour}`;
}

/** The smallest angle between two directions, degrees. */
function turn(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180;
}

const inSector = (from: number | null, low: number, high: number): boolean =>
  from != null &&
  (low <= high ? from >= low && from <= high : from >= low || from <= high);

function maxOf(hours: readonly H[], key: keyof H): H | null {
  let best: H | null = null;
  for (const hour of hours) {
    const value = hour[key];
    if (value == null) continue;
    if (!best || (best[key] ?? -Infinity) < value) best = hour;
  }
  return best;
}

/** One line of the tables every 3 h. */
function sampled(hours: readonly H[]): H[] {
  return hours.filter((_, index) => index % STEP === 0);
}

function windWords(hour: H): string {
  if (hour.wind == null) return 'vent inconnu';
  const from = hour.from == null ? '' : `${compassPoint(hour.from)} `;
  const gust = hour.gust == null ? '' : `, rafales ${fr(hour.gust)} nd`;
  return `${from}${fr(hour.wind)} nd (force ${bft(hour.wind)})${gust}`;
}

// ── 1 · Alerts ───────────────────────────────────────────────────────────

function alerts(input: BulletinInput, hours: readonly H[]): BulletinLevel {
  const { kind, now, data, lakeAlerts } = input;
  const lines: string[] = [];
  const missing: string[] = [];
  const links: string[] = [];
  const strongest = maxOf(hours, 'wind');
  const gustiest = maxOf(hours, 'gust');
  const f7 = hours.find((hour) => (hour.wind ?? 0) >= NOGO_WIND_MAX);
  if (kind === 'lac') {
    links.push('wx-meteoswiss');
    if (lakeAlerts == null) {
      missing.push(
        'Avis de MétéoSuisse pour les lacs non lus (relais absent ou sans réponse) : ouvrez la carte des dangers.',
      );
    } else {
      const active = lakeAlerts.filter(
        (alert) => alert.expires > now && alert.level >= 2,
      );
      if (active.length === 0) {
        lines.push(
          'MétéoSuisse : aucun avis de vent fort ni de tempête sur ce lac.',
        );
      }
      for (const alert of active) {
        const words =
          alert.level >= 3
            ? 'TEMPÊTE (90 éclats/min)'
            : 'VENT FORT (40 éclats/min)';
        const from =
          alert.onset <= now
            ? 'en vigueur'
            : `dès ${whenLocal(alert.onset, now, data.offset)}`;
        lines.push(
          `MétéoSuisse, ${alert.name} : avis de ${words}, ${from}, jusqu’à ${whenLocal(alert.expires, now, data.offset)}.`,
        );
      }
    }
    const storm = hours.find(
      (hour) =>
        (hour.cape ?? 0) >= 500 &&
        (hour.cin ?? -999) > -50 &&
        (hour.rain ?? 0) > 0.2,
    );
    if (storm) {
      lines.push(
        `Orage possible dès ${whenLocal(storm.t, now, data.offset)} (CAPE ${fr(storm.cape ?? 0)} J/kg, CIN ${fr(storm.cin ?? 0)} J/kg) : bourrasques et sautes de vent soudaines, voir l’alerte orage.`,
      );
    }
  } else {
    links.push(
      kind === 'med' ? 'wx-bms-provence' : 'wx-bms-manche',
      'wx-vigilance',
    );
    missing.push(
      'Le texte du BMS en cours n’est pas lisible par NavIn (page Météo-France en JavaScript) : ouvrez le BMS côte de la zone.',
    );
    if (f7) {
      lines.push(
        `Le modèle donne force 7 ou plus (≥ ${NOGO_WIND_MAX} nd) dès ${whenLocal(f7.t, now, data.offset)} : un BMS est probable, vérifiez-le avant de sortir. No-go.`,
      );
    }
    const storm = hours.find(
      (hour) => (hour.cape ?? 0) >= 500 && (hour.cin ?? -999) > -50,
    );
    if (storm) {
      lines.push(
        `Orages possibles dès ${whenLocal(storm.t, now, data.offset)} (CAPE ${fr(storm.cape ?? 0)} J/kg, CIN ${fr(storm.cin ?? 0)} J/kg) : grains et rafales sous les cumulonimbus.`,
      );
    }
  }
  if (kind === 'lac' && f7) {
    lines.push(
      `Le modèle donne force 7 ou plus (≥ ${NOGO_WIND_MAX} nd) dès ${whenLocal(f7.t, now, data.offset)} : no-go.`,
    );
  }
  if (!f7 && strongest?.wind != null) {
    lines.push(
      `Vent moyen le plus fort des ${BULLETIN_HOURS} h : ${windWords(strongest)} vers ${whenLocal(strongest.t, now, data.offset)}${gustiest?.gust != null && gustiest !== strongest ? ` ; rafale maximale ${fr(gustiest.gust)} nd vers ${whenLocal(gustiest.t, now, data.offset)}` : ''}.`,
    );
  }
  return {
    level: 1,
    title:
      kind === 'lac'
        ? 'Alertes et avis de vent fort'
        : 'Alertes, BMS et avis de vent fort',
    lines,
    table: null,
    links: [...links, 'lightning'],
    missing,
  };
}

// ── 2 · General situation ───────────────────────────────────────────────

/** The tendency over 3 h, as the barometer reads it (WMO). */
export function tendencyWords(change3h: number): string {
  const size = Math.abs(change3h);
  if (size < 0.1) return 'stationnaire';
  const way = change3h > 0 ? 'hausse' : 'baisse';
  if (size <= 1.5) return `${way} lente`;
  if (size <= 3.5) return way;
  if (size <= 6) return `${way} rapide`;
  return `${way} très rapide`;
}

function regimeWords(p: number): string {
  if (p < 1000) return 'régime dépressionnaire marqué';
  if (p < 1010) return 'régime plutôt dépressionnaire';
  if (p <= 1020) return 'pression moyenne, pas de régime marqué';
  if (p <= 1030) return 'régime anticyclonique';
  return 'régime anticyclonique marqué';
}

/**
 * The passage of a trough or a cold front: a low of the pressure, falling
 * then rising, with the wind veering (clockwise) across it.
 */
function troughOf(hours: readonly H[]): H | null {
  for (let index = 6; index < hours.length - 6; index++) {
    const here = hours[index];
    const low = here?.p;
    if (here == null || low == null) continue;
    const before = hours[index - 6]?.p;
    const after = hours[index + 6]?.p;
    if (before == null || after == null) continue;
    const lowest = hours
      .slice(index - 3, index + 4)
      .every((hour) => hour.p == null || hour.p >= low - 1e-9);
    if (!lowest || before - low < 2 || after - low < 2) continue;
    const fromBefore = hours[index - 3]?.from;
    const fromAfter = hours[index + 3]?.from;
    if (fromBefore == null || fromAfter == null) continue;
    if (turn(fromBefore, fromAfter) >= 40) return here;
  }
  return null;
}

function nearestIndex(times: readonly number[], t: number): number {
  let best = 0;
  for (const [index, time] of times.entries()) {
    if (Math.abs(time - t) < Math.abs((times[best] ?? 0) - t)) best = index;
  }
  return best;
}

function situation(input: BulletinInput, hours: readonly H[]): BulletinLevel {
  const { kind, now, data, gradient } = input;
  const lines: string[] = [];
  const missing: string[] = [];
  const first = hours.find((hour) => hour.p != null);
  const in3 = hours[3]?.p;
  const in24 = hours[24]?.p;
  if (first?.p != null) {
    const parts = [
      `Pression au niveau de la mer : ${fr(first.p)} hPa, ${regimeWords(first.p)}`,
    ];
    if (in3 != null) {
      parts.push(
        `tendance sur 3 h : ${tendencyWords(in3 - first.p)} (${fr(in3 - first.p, 1)} hPa)`,
      );
    }
    if (in24 != null) {
      const change = in24 - first.p;
      parts.push(
        `sur 24 h : ${change >= 0 ? '+' : ''}${fr(change)} hPa${Math.abs(change) >= 10 ? ', évolution rapide' : ''}`,
      );
    }
    lines.push(`${parts.join(' ; ')}.`);
  } else {
    missing.push('Pression du modèle absente pour ce point.');
  }
  const trough = troughOf(hours);
  if (trough) {
    lines.push(
      `Passage probable d’un talweg ou d’un front froid vers ${whenLocal(trough.t, now, data.offset)} : la pression passe par un creux (${fr(trough.p ?? 0)} hPa) et le vent tourne à droite. Déduit de la pression et du vent au point : à confirmer sur les cartes de la situation générale ci-dessus.`,
    );
  }
  const minP = maxOf(
    hours.map((hour) => ({ ...hour, p: hour.p == null ? null : -hour.p })),
    'p',
  );
  if (!trough && minP?.p != null && first?.p != null && -minP.p < first.p - 4) {
    lines.push(
      `Baisse de pression jusqu’à ${fr(-minP.p)} hPa vers ${whenLocal(minP.t, now, data.offset)} : approche d’une dépression ou d’une perturbation.`,
    );
  }
  if (gradient) {
    const at = nearestIndex(gradient.t, now);
    const p = (place: string) => gradient.p[place]?.[at] ?? null;
    if (kind === 'lac') {
      const ge = p('geneve');
      const zh = p('zurich');
      const lu = p('lugano');
      if (ge != null && zh != null) {
        const diff = zh - ge;
        const words =
          diff >= 4
            ? 'bise forte probable sur le Plateau et le Léman'
            : diff >= 2
              ? 'bise probable'
              : diff <= -3
                ? 'flux d’ouest à sud-ouest sur le Plateau'
                : 'gradient faible : place aux brises et aux effets locaux';
        lines.push(
          `Gradient sur le Plateau, Zurich − Genève : ${diff >= 0 ? '+' : ''}${fr(diff, 1)} hPa, ${words}.`,
        );
      }
      if (lu != null && zh != null && lu - zh >= 4) {
        lines.push(
          `Lugano − Zurich : +${fr(lu - zh, 1)} hPa, fœhn du sud possible (Vaudaire sur le Haut-Lac).`,
        );
      }
    }
    if (kind === 'med') {
      const genoa = p('genes');
      const later =
        gradient.p.genes?.[Math.min(at + 12, gradient.t.length - 1)];
      if (genoa != null && first?.p != null) {
        const diff = first.p - genoa;
        lines.push(
          `Pression à Gênes : ${fr(genoa)} hPa (${diff >= 0 ? '' : '+'}${fr(-diff)} hPa par rapport au point)${diff >= 4 ? ' : dépression du golfe de Gênes, flux de mistral favorisé' : ''}.`,
        );
      }
      if (genoa != null && later != null && genoa - later >= 4) {
        lines.push(
          `Creusement dans le golfe de Gênes : −${fr(genoa - later)} hPa en 12 h, mistral à surveiller.`,
        );
      }
    }
  } else if (kind !== 'manche') {
    missing.push(
      kind === 'lac'
        ? 'Pressions de Genève, Zurich et Lugano non lues (gradient de bise et de fœhn).'
        : 'Pression de Gênes non lue (creusement du golfe de Gênes).',
    );
  }
  lines.push(
    kind === 'lac'
      ? 'Les cartes de l’hémisphère au local sont dans la situation générale ci-dessus.'
      : 'Anticyclones, dépressions, fronts et jets : cartes de la situation générale ci-dessus.',
  );
  return {
    level: 2,
    title: 'Situation générale et évolution',
    lines,
    table: null,
    links: [],
    missing,
  };
}

// ── 3 · Wind ─────────────────────────────────────────────────────────────

/** The name of a wind of the Léman, by its direction, speed and hour. */
export function lemanWind(hour: {
  from: number | null;
  wind: number | null;
  hour: number;
}): string | null {
  const { from, wind } = hour;
  if (from == null || wind == null) return null;
  if (wind < 5) {
    return hour.hour >= 10 && hour.hour <= 18
      ? 'brise thermique de jour'
      : 'brise de terre de nuit';
  }
  if (inSector(from, 20, 80)) return 'bise';
  if (inSector(from, 290, 345)) return 'joran possible';
  if (inSector(from, 100, 165)) return 'vaudaire possible';
  if (inSector(from, 200, 285)) {
    return wind < 12 && hour.hour >= 11 && hour.hour <= 18
      ? 'vent blanc possible'
      : 'vent (SO à O)';
  }
  return null;
}

/** The name of a wind of Provence, by its direction and speed. */
export function provenceWind(hour: {
  from: number | null;
  wind: number | null;
  hour: number;
}): string | null {
  const { from, wind } = hour;
  if (from == null || wind == null) return null;
  if (
    wind < 8 &&
    hour.hour >= 10 &&
    hour.hour <= 18 &&
    inSector(from, 120, 250)
  ) {
    return 'brise de mer';
  }
  if (wind >= 12 && inSector(from, 270, 350)) return 'mistral';
  if (wind >= 10 && inSector(from, 40, 140)) return 'vent d’est';
  return null;
}

function windName(kind: ZoneKind, leman: boolean, hour: H): string {
  if (kind === 'lac') return leman ? (lemanWind(hour) ?? '') : '';
  if (kind === 'med') return provenceWind(hour) ?? '';
  return '';
}

function changes(hours: readonly H[], now: number, offset: number): string[] {
  const out: string[] = [];
  let lastShift = -99;
  for (let index = 0; index + 6 < hours.length; index++) {
    const here = hours[index];
    const later = hours[index + 6];
    if (!here || !later) continue;
    if (
      index - lastShift >= 6 &&
      here.from != null &&
      later.from != null &&
      (here.wind ?? 0) >= 6 &&
      (later.wind ?? 0) >= 6 &&
      Math.abs(turn(here.from, later.from)) >= 45
    ) {
      out.push(
        `Bascule du ${compassPoint(here.from)} au ${compassPoint(later.from)} entre ${whenLocal(here.t, now, offset)} et ${whenLocal(later.t, now, offset)}.`,
      );
      lastShift = index;
    }
  }
  let lastRise = -99;
  for (let index = 0; index + 6 < hours.length; index++) {
    const here = hours[index];
    const later = hours[index + 6];
    if (!here || !later || here.wind == null || later.wind == null) continue;
    if (index - lastRise >= 6 && later.wind - here.wind >= 8) {
      out.push(
        `Renforcement de ${fr(here.wind)} à ${fr(later.wind)} nd entre ${whenLocal(here.t, now, offset)} et ${whenLocal(later.t, now, offset)}.`,
      );
      lastRise = index;
    }
  }
  return out.slice(0, 4);
}

function windLevel(input: BulletinInput, hours: readonly H[]): BulletinLevel {
  const { kind, now, data } = input;
  const leman = onLeman(input);
  const lines: string[] = [];
  const first = hours[0];
  if (first) lines.push(`Maintenant : ${windWords(first)}.`);
  lines.push(...changes(hours, now, data.offset));
  const names = new Set(
    hours.map((hour) => windName(kind, leman, hour)).filter(Boolean),
  );
  if (kind === 'lac') {
    if (leman) {
      if (names.has('bise')) {
        lines.push(
          'Bise (NE) : fraîche et régulière, elle forcit au large et s’accélère dans l’entonnoir du Petit-Lac vers Genève.',
        );
      }
      if (names.has('joran possible')) {
        lines.push(
          'Vent de NO : joran possible, descendant du Jura, soudain et rafaleux près de la côte vaudoise, souvent le soir ou après un orage.',
        );
      }
      if (names.has('vaudaire possible')) {
        lines.push(
          'Vent de SE : vaudaire possible (fœhn du Valais), surtout sur le Haut-Lac et l’est du Grand-Lac, en rafales.',
        );
      }
      if (names.has('vent (SO à O)')) {
        lines.push(
          'Vent de SO à O : le « vent » du Léman, souvent devant une perturbation, rafaleux ; il lève une mer plus longue sur le Grand-Lac.',
        );
      }
      if (names.has('vent blanc possible')) {
        lines.push(
          'Vent blanc (SO thermique) possible l’après-midi par beau temps.',
        );
      }
      if (
        names.has('brise thermique de jour') ||
        names.has('brise de terre de nuit')
      ) {
        lines.push(
          'Flux faible : brises thermiques (Séchard, Rebat, Morget selon la rive), brise de lac le jour, de terre la nuit. Leur direction locale se lit sur les stations de LiveMétéo.',
        );
      }
      lines.push(
        'Effets de couloir et de cap : le Petit-Lac (resserré) et le Grand-Lac (large) ne reçoivent pas le même vent ; coups de vent locaux possibles côté savoyard (Bornan, Môlan) sous orage.',
      );
    } else {
      lines.push(
        'Lac : vent canalisé par le relief et brises thermiques par flux faible ; les rafales sont plus fortes au débouché des vallées.',
      );
    }
  }
  if (kind === 'manche') {
    lines.push(
      'Le vent forcit et devient rafaleux sur les caps, pointes et goulets : voir aussi les Alertes fixes du menu Météo.',
    );
  }
  if (kind === 'med') {
    if (names.has('mistral')) {
      lines.push(
        'Mistral (NO à O) : sec, ciel clair, fortes rafales et turbulences près des reliefs et des côtes ; mer formée à l’ouest de Porquerolles et dans la rade de Toulon.',
      );
    }
    if (names.has('vent d’est')) {
      lines.push(
        'Vent d’est : humide, nuages bas et pluie possibles, mer et houle qui entrent dans les rades et baies ouvertes à l’est.',
      );
    }
    if (names.has('brise de mer')) {
      lines.push(
        'Flux faible le jour : brise de mer en rade de Toulon et autour des îles.',
      );
    }
  }
  const hasName = kind !== 'manche' && (kind === 'med' || leman);
  const head = [
    hourHead(),
    'Direction (° / point)',
    'Vent moyen (nd)',
    'Beaufort (force)',
    'Rafales (nd)',
  ];
  if (hasName) head.push('Vent régional (nom)');
  const rows = sampled(hours).map((hour) => {
    const row = [
      whenLocal(hour.t, now, data.offset, false),
      hour.from == null ? '–' : `${fr(hour.from)}° ${compassPoint(hour.from)}`,
      cell(hour.wind),
      hour.wind == null ? '–' : String(bft(hour.wind)),
      cell(hour.gust),
    ];
    if (hasName) row.push(windName(kind, leman, hour) || '–');
    return row;
  });
  return {
    level: 3,
    title: 'Vent',
    lines,
    table: { head, rows },
    links: kind === 'lac' ? ['wx-meteoswiss-mesures'] : [],
    missing: [],
  };
}

// ── 4 · Sea ──────────────────────────────────────────────────────────────

function exposedWords(from: number): string {
  const facing = compassPoint(from);
  const lee = compassPoint((from + 180) % 360);
  return `côtes exposées : celles tournées vers le ${facing} ; abri derrière les terres, côté ${lee}`;
}

function seaLevel(input: BulletinInput, hours: readonly H[]): BulletinLevel {
  const { kind, now, data, fetchKm } = input;
  const lines: string[] = [];
  const missing: string[] = [];
  const links: string[] = [];
  if (kind === 'lac') {
    const rows: string[][] = [];
    let worst: { t: number; hs: number; period: number } | null = null;
    for (const hour of sampled(hours)) {
      const km = fetchKm && hour.from != null ? fetchKm(hour.from) : null;
      const sea =
        hour.wind != null && km != null ? fetchSea(hour.wind, km) : null;
      if (sea && (!worst || sea.hs > worst.hs)) worst = { t: hour.t, ...sea };
      rows.push([
        whenLocal(hour.t, now, data.offset, false),
        cell(hour.wind),
        cell(km),
        sea ? cell(sea.hs * 100) : '–',
        sea ? cell(sea.period, 1) : '–',
      ]);
    }
    lines.push(
      'Lac : ni marée ni houle océanique, mais un clapot court et très réactif au vent.',
    );
    if (worst) {
      lines.push(
        `Clapot le plus fort vers ${whenLocal(worst.t, now, data.offset)} : environ ${fr(worst.hs * 100)} cm, période ${fr(worst.period, 1)} s (calculé par NavIn d’après le vent et la longueur d’eau devant le vent).`,
      );
    }
    if (onLeman(input)) {
      lines.push(
        'Clapot haché et raide quand le vent s’oppose aux brises ou s’accélère dans l’entonnoir du Petit-Lac.',
      );
    }
    if (!fetchKm) {
      missing.push('Carte des rives non chargée : clapot non calculé.');
    }
    return {
      level: 4,
      title: 'État de l’eau (clapot)',
      lines,
      table: {
        head: [
          hourHead(),
          'Vent moyen (nd)',
          'Longueur d’eau (km)',
          'Clapot (cm)',
          'Période (s)',
        ],
        rows,
      },
      links,
      missing,
    };
  }
  const first = hours.find((hour) => hour.hs != null);
  const highest = maxOf(hours, 'hs');
  if (first) {
    lines.push(
      `Maintenant : vagues ${cell(first.hs, 1)} m (période ${cell(first.period)} s) ; houle ${first.swellDir == null ? '' : `du ${compassPoint(first.swellDir)} `}${cell(first.swellHs, 1)} m, ${cell(first.swellPeriod)} s ; mer du vent ${cell(first.windSeaHs, 1)} m, ${cell(first.windSeaPeriod)} s.`,
    );
  } else {
    missing.push(
      'Modèle de vagues sans réponse pour ce point (Open-Meteo marine).',
    );
  }
  if (highest?.hs != null && highest !== first) {
    lines.push(
      `Mer la plus forte vers ${whenLocal(highest.t, now, data.offset)} : ${fr(highest.hs, 1)} m, période ${cell(highest.period)} s.`,
    );
  }
  const short = hours.find(
    (hour) =>
      hour.windSeaHs != null &&
      hour.windSeaPeriod != null &&
      hour.windSeaHs >= 0.8 &&
      hour.windSeaHs / (1.56 * hour.windSeaPeriod ** 2) >= 1 / 20,
  );
  if (short) {
    lines.push(
      `Mer du vent courte et creuse dès ${whenLocal(short.t, now, data.offset)} (${fr(short.windSeaHs ?? 0, 1)} m pour ${fr(short.windSeaPeriod ?? 0)} s).`,
    );
  }
  if (kind === 'manche') {
    links.push('wx-shom-marees');
    missing.push(
      'Marées (coefficient, heures et hauteurs de pleine et basse mer) : non lues par NavIn, voir le SHOM.',
    );
    lines.push(
      'Courants : sens (flot, jusant) et vitesse à lire sur la carte des courants de la situation générale ci-dessus ; renforcement sur les raz, pointes et entrées de ports. Vent contre courant : la mer se creuse et se raccourcit.',
    );
  }
  if (kind === 'med') {
    const now0 = hours[0];
    if (now0?.from != null) {
      lines.push(
        `Avec ce vent du ${compassPoint(now0.from)}, ${exposedWords(now0.from)}.`,
      );
    }
    if (nearPorquerolles(input)) {
      lines.push(
        'Porquerolles : sous mistral, mer formée à l’ouest de l’île et dans la rade, abri sur la façade nord-est ; sous vent d’est, abri à l’ouest et au sud-ouest, mer qui entre dans les baies ouvertes à l’est.',
      );
    }
  }
  return {
    level: 4,
    title:
      kind === 'manche'
        ? 'Marées, courants et houle'
        : 'État de la mer et houle',
    lines,
    table: {
      head: [
        hourHead(),
        'Vagues (m)',
        'Période (s)',
        'Houle (dir.)',
        'Houle (m)',
        'Houle (s)',
        'Mer du vent (m)',
      ],
      rows: sampled(hours).map((hour) => [
        whenLocal(hour.t, now, data.offset, false),
        cell(hour.hs, 1),
        cell(hour.period),
        hour.swellDir == null ? '–' : compassPoint(hour.swellDir),
        cell(hour.swellHs, 1),
        cell(hour.swellPeriod),
        cell(hour.windSeaHs, 1),
      ]),
    },
    links,
    missing,
  };
}

// ── 5 · Weather and visibility ───────────────────────────────────────────

/** The balance of CAPE and CIN, with Corban's classes. */
export function convectionWords(cape: number, cin: number | null): string {
  const lock = cin == null ? null : Math.abs(cin);
  if (cape < 300) return 'atmosphère stable';
  if (cape >= 1500 && lock != null && lock > 100) {
    return 'énergie forte mais verrouillée : orage violent si le verrou saute';
  }
  if (cape >= 500 && lock != null && lock < 50) {
    return 'zone tampon : orages faciles à déclencher';
  }
  return 'instabilité modérée';
}

function weatherLevel(
  input: BulletinInput,
  hours: readonly H[],
): BulletinLevel {
  const { kind, now, data } = input;
  const lines: string[] = [];
  const rainy = hours.filter((hour) => (hour.rain ?? 0) >= 0.2);
  const total = hours.reduce((sum, hour) => sum + (hour.rain ?? 0), 0);
  if (rainy.length === 0) {
    lines.push(`Pas de pluie notable sur ${BULLETIN_HOURS} h.`);
  } else {
    const firstRain = rainy[0];
    lines.push(
      `Pluie : ${fr(total, 1)} mm en ${BULLETIN_HOURS} h, ${rainy.length} h de pluie${firstRain ? `, dès ${whenLocal(firstRain.t, now, data.offset)}` : ''}.`,
    );
  }
  const capeMax = maxOf(hours, 'cape');
  if (capeMax?.cape != null && capeMax.cape >= 300) {
    lines.push(
      `CAPE jusqu’à ${fr(capeMax.cape)} J/kg vers ${whenLocal(capeMax.t, now, data.offset)} (CIN ${cell(capeMax.cin)} J/kg) : ${convectionWords(capeMax.cape, capeMax.cin)}. Écart à la normale : non disponible dans NavIn.`,
    );
  } else {
    lines.push('Pas d’énergie orageuse notable (CAPE < 300 J/kg).');
  }
  const fog = hours.find(
    (hour) =>
      hour.temp != null &&
      hour.dew != null &&
      hour.temp - hour.dew <= 1 &&
      (hour.rain ?? 0) < 0.2,
  );
  if (fog) {
    const advection = kind === 'manche' && (fog.wind ?? 0) >= 6;
    lines.push(
      `${advection ? 'Brouillard d’advection (air doux sur eau froide)' : kind === 'lac' ? 'Brume ou brouillard (matinal ou d’évaporation)' : 'Brume ou brouillard'} possible vers ${whenLocal(fog.t, now, data.offset)} : air presque saturé (température − point de rosée ≤ 1 °C).`,
    );
  }
  if (kind === 'med') {
    const dry = hours.some(
      (hour) =>
        provenceWind(hour) === 'mistral' &&
        hour.temp != null &&
        hour.dew != null &&
        hour.temp - hour.dew >= 8,
    );
    if (dry) {
      lines.push('Sous le mistral : air sec, ciel dégagé et bonne visibilité.');
    }
  }
  if (kind === 'manche' && troughOf(hours) != null) {
    lines.push('Grains possibles à l’arrière du front froid.');
  }
  if (kind === 'lac') {
    lines.push(
      'Plafond bas sur les reliefs possible par temps couvert : voir les webcams et les stations.',
    );
  }
  const temps = hours.map((hour) => hour.temp).filter((value) => value != null);
  if (temps.length > 0) {
    lines.push(
      `Température de l’air : ${fr(Math.min(...temps))} à ${fr(Math.max(...temps))} °C.`,
    );
  }
  return {
    level: 5,
    title: 'Temps sensible et visibilité',
    lines,
    table: {
      head: [
        hourHead(),
        'Pluie (mm/3 h)',
        'CAPE (J/kg)',
        'CIN (J/kg)',
        'Air (°C)',
        'Air − rosée (°C)',
      ],
      rows: sampled(hours).map((hour, index) => {
        const rain = hours
          .slice(index * STEP, index * STEP + STEP)
          .reduce((sum, one) => sum + (one.rain ?? 0), 0);
        return [
          whenLocal(hour.t, now, data.offset, false),
          fr(rain, 1),
          cell(hour.cape),
          cell(hour.cin),
          cell(hour.temp),
          hour.temp != null && hour.dew != null
            ? fr(hour.temp - hour.dew, 1)
            : '–',
        ];
      }),
    },
    links: [],
    missing: [
      'Visibilité : non fournie par le modèle, voir le bulletin côtier ou lacustre officiel.',
    ],
  };
}

const KIND_TITLE: Readonly<Record<ZoneKind, string>> = {
  lac: 'plan d’eau intérieur',
  manche: 'Manche et Atlantique',
  med: 'Méditerranée',
};

/**
 * The bulletin of the zone, in the five levels.
 * @param input - What it is made from.
 * @returns The bulletin.
 */
export function zoneBulletin(input: BulletinInput): Bulletin {
  const hours = hoursOf(input.data, input.now);
  const read = new Date(input.data.at + shownOffset(input.data.offset) * 1000);
  const readAt = `${String(read.getUTCHours()).padStart(2, '0')}:${String(read.getUTCMinutes()).padStart(2, '0')}${showsUtc() ? ' UTC' : ''}`;
  return {
    kind: input.kind,
    title: `${input.name} · ${KIND_TITLE[input.kind]}`,
    source: `${input.data.src}, lu à ${readAt}${showsUtc() ? '' : ' (heure locale du lieu)'} ; texte écrit par les règles de NavIn, sans IA.`,
    old: input.now - input.data.at > OLD_MS,
    levels: [
      alerts(input, hours),
      situation(input, hours),
      windLevel(input, hours),
      seaLevel(input, hours),
      weatherLevel(input, hours),
    ],
  };
}
