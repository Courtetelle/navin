import { bft, compassPoint } from '../../lib/wind.ts';
import { degreeOfHeight } from '../../model/beaufortDouglas.ts';
import type { DayVerdict, Hour, Thresholds } from '../../model/goNoGo.ts';
import {
  corrected,
  correctedDirection,
  dayVerdict,
} from '../../model/goNoGo.ts';
import { store } from '../../storage/store.ts';

import { steepnessOf } from './steepness.ts';

/** Raw hourly series of Open-Meteo, as received (weather and sea). */
export interface BriefingData {
  /** When it was read, epoch ms. */
  at: number;
  lat: number;
  lon: number;
  /** Name of the point. */
  name: string;
  /** Source of the weather. */
  src: string;
  /** Offset of local time, seconds. */
  offset: number;
  /** Hourly times, epoch ms (UTC). */
  t: number[];
  /** Variable → hourly values. */
  v: Record<string, Array<number | null>>;
  /** Ultra-light: every 3 h over 72 h, a few variables. */
  light?: boolean;
}

/** A measure typed at sea, to correct the forecast. */
export interface SeaMeasure {
  t: number;
  windKn: number | null;
  windFrom: number | null;
  hs: number | null;
}

const WEATHER_VARS = [
  'wind_speed_10m',
  'wind_direction_10m',
  'wind_gusts_10m',
  'cape',
  'convective_inhibition',
  'pressure_msl',
  'precipitation',
];
const SEA_VARS = [
  'wave_height',
  'wave_period',
  'wind_wave_height',
  'wind_wave_period',
  'wind_wave_direction',
  'swell_wave_height',
  'swell_wave_period',
  'swell_wave_direction',
];
/** What the ultra-light packet keeps. */
const LIGHT_VARS = [
  'wind_speed_10m',
  'wind_direction_10m',
  'wind_gusts_10m',
  'wave_height',
  'wave_period',
  'wave_direction',
  'pressure_msl',
  'precipitation',
  'cape',
];

const FULL_KEY = 'navin.wxPacket';
const LIGHT_KEY = 'navin.wxPacketLight';
const MEASURE_KEY = 'navin.wxMeasure';

function inSwissModel(lat: number, lon: number): boolean {
  return lat > 45.6 && lat < 48 && lon > 5.8 && lon < 10.7;
}

async function json(url: string): Promise<Record<string, unknown> | null> {
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  return response.ok
    ? ((await response.json()) as Record<string, unknown>)
    : null;
}

/**
 * Read 4 days of hourly weather (and sea, off the lakes) at a point.
 * @param point - The point.
 * @param point.lat - Latitude.
 * @param point.lon - Longitude.
 * @param point.name - Its name.
 * @param lake - On a lake: no sea model.
 * @returns The data, or null without network.
 */
export async function readBriefing(
  point: { lat: number; lon: number; name: string },
  lake: boolean,
): Promise<BriefingData | null> {
  const where = `latitude=${point.lat.toFixed(3)}&longitude=${point.lon.toFixed(3)}&forecast_days=4&timezone=auto`;
  const swiss = inSwissModel(point.lat, point.lon);
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?${where}&wind_speed_unit=kn&hourly=${WEATHER_VARS.join(',')}${swiss ? '&models=meteoswiss_icon_ch2' : '&models=ecmwf_ifs025'}${lake ? '' : '&cell_selection=sea'}`;
  const [weather, sea] = await Promise.all([
    json(weatherUrl).catch(() => null),
    lake
      ? null
      : json(
          `https://marine-api.open-meteo.com/v1/marine?${where}&hourly=${[...SEA_VARS, 'wave_direction'].join(',')}`,
        ).catch(() => null),
  ]);
  const hourly = weather?.hourly as Record<string, unknown> | undefined;
  const times = hourly?.time as string[] | undefined;
  if (!hourly || !times) return null;
  const offset = Number(weather?.utc_offset_seconds ?? 0);
  const t = times.map((time) => Date.parse(`${time}:00Z`) - offset * 1000);
  const v: Record<string, Array<number | null>> = {};
  for (const name of WEATHER_VARS) {
    v[name] = (hourly[name] as Array<number | null> | undefined) ?? [];
  }
  const seaHourly = sea?.hourly as Record<string, unknown> | undefined;
  const seaTimes = (seaHourly?.time as string[] | undefined) ?? [];
  for (const name of [...SEA_VARS, 'wave_direction']) {
    const values =
      (seaHourly?.[name] as Array<number | null> | undefined) ?? [];
    // Same hours as the weather, matched by their text.
    v[name] = times.map((time) => {
      const at = seaTimes.indexOf(time);
      return at === -1 ? null : (values[at] ?? null);
    });
  }
  return {
    at: Date.now(),
    lat: point.lat,
    lon: point.lon,
    name: point.name,
    src: swiss
      ? 'MeteoSwiss ICON-CH2 (via Open-Meteo)'
      : 'ECMWF IFS 0,25° (via Open-Meteo)',
    offset,
    t,
    v,
  };
}

/**
 * The ultra-light packet: every 3 h over 72 h, a few variables.
 * @param data - The full data.
 * @returns The light data.
 */
export function lightPacket(data: BriefingData): BriefingData {
  const keep = data.t
    .map((_, index) => index)
    .filter((index) => index % 3 === 0 && index < 72);
  const v: Record<string, Array<number | null>> = {};
  for (const name of LIGHT_VARS) {
    const values = data.v[name] ?? [];
    v[name] = keep.map((index) => {
      const value = values[index];
      return value == null ? null : Math.round(value * 10) / 10;
    });
  }
  return {
    ...data,
    t: keep.map((index) => data.t[index] ?? 0),
    v,
    light: true,
  };
}

/** The packets kept for offline, with their sizes in bytes. */
export interface Packets {
  full: BriefingData | null;
  light: BriefingData | null;
  fullBytes: number;
  lightBytes: number;
}

/**
 * Keep the packets for offline: the ultra-light first, then the full one
 * (a full storage keeps at least the light one).
 * @param data - The data read.
 * @returns The sizes kept.
 */
export function keepPackets(data: BriefingData): Packets {
  const light = lightPacket(data);
  const lightText = JSON.stringify(light);
  const fullText = JSON.stringify(data);
  let lightOk = false;
  let fullOk = false;
  try {
    store.set(LIGHT_KEY, light);
    lightOk = true;
    store.set(FULL_KEY, data);
    fullOk = true;
  } catch {
    // Storage full: the light one at least.
  }
  return {
    full: fullOk ? data : null,
    light: lightOk ? light : null,
    fullBytes: fullOk ? fullText.length : 0,
    lightBytes: lightOk ? lightText.length : 0,
  };
}

/**
 * The packets kept.
 * @returns Them, null where none.
 */
export function keptPackets(): Packets {
  const full = store.get<BriefingData | null>(FULL_KEY, null);
  const light = store.get<BriefingData | null>(LIGHT_KEY, null);
  return {
    full,
    light,
    fullBytes: full ? JSON.stringify(full).length : 0,
    lightBytes: light ? JSON.stringify(light).length : 0,
  };
}

/**
 * The measure typed at sea, while it still corrects (6 h).
 * @returns It, or null.
 */
export function keptMeasure(): SeaMeasure | null {
  const measure = store.get<SeaMeasure | null>(MEASURE_KEY, null);
  return measure && Date.now() - measure.t < 6 * 3_600_000 ? measure : null;
}

/**
 * Keep or clear the measure typed at sea.
 * @param measure - The measure, or null to clear.
 */
export function keepMeasure(measure: SeaMeasure | null): void {
  store.set(MEASURE_KEY, measure);
}

/**
 * The hours of the data, as the rules read them, corrected by a measure.
 * @param data - The data.
 * @param measure - The measure typed at sea, or null.
 * @returns The hours.
 */
export function hoursOf(
  data: BriefingData,
  measure: SeaMeasure | null,
): Hour[] {
  const { t, v } = data;
  const at = (name: string) => v[name] ?? [];
  const wind = corrected(
    at('wind_speed_10m'),
    t,
    measure?.windKn == null ? null : { value: measure.windKn, t: measure.t },
  );
  const gustRatio = corrected(
    at('wind_gusts_10m'),
    t,
    measure?.windKn == null
      ? null
      : {
          // Gusts follow the wind in the same ratio.
          value:
            (measure.windKn /
              Math.max(1, nearest(at('wind_speed_10m'), t, measure.t) ?? 1)) *
            (nearest(at('wind_gusts_10m'), t, measure.t) ?? 0),
          t: measure.t,
        },
  );
  const direction = correctedDirection(
    at('wind_direction_10m'),
    t,
    measure?.windFrom == null
      ? null
      : { value: measure.windFrom, t: measure.t },
  );
  const hs = corrected(
    at('wave_height'),
    t,
    measure?.hs == null ? null : { value: measure.hs, t: measure.t },
  );
  return t.map((time, index) => {
    const windSeaHs = at('wind_wave_height')[index] ?? null;
    const windSeaPeriod = at('wind_wave_period')[index] ?? null;
    const steep = steepnessOf(windSeaHs, windSeaPeriod);
    return {
      t: time,
      windKn: wind[index] ?? null,
      windFrom: direction[index] ?? null,
      gustKn: gustRatio[index] ?? null,
      hs: hs[index] ?? null,
      period: at('wave_period')[index] ?? null,
      windSeaHs,
      windSeaSteep: steep ? steep.steep.level : null,
      windSeaDir: at('wind_wave_direction')[index] ?? null,
      swellHs: at('swell_wave_height')[index] ?? null,
      swellDir: at('swell_wave_direction')[index] ?? null,
      cape: at('cape')[index] ?? null,
      cin: at('convective_inhibition')[index] ?? null,
      pressure: at('pressure_msl')[index] ?? null,
      rain: at('precipitation')[index] ?? null,
    };
  });
}

function nearest(
  values: ReadonlyArray<number | null>,
  times: readonly number[],
  t: number,
): number | null {
  let best = 0;
  for (const [index, time] of times.entries()) {
    if (Math.abs(time - t) < Math.abs((times[best] ?? 0) - t)) best = index;
  }
  return values[best] ?? null;
}

/** The window of sailing, local hours. */
export const WINDOW = { from: 8, to: 18 } as const;

/** One day of the briefing. */
export interface BriefingDay {
  /** Local date, `YYYY-MM-DD`. */
  date: string;
  /** Rank: 0 today. */
  rank: number;
  /** Local hours of the window kept (today: from now). */
  hours: Hour[];
  verdict: DayVerdict;
  force: number | null;
  degree: number | null;
  windMax: number | null;
  gustMax: number | null;
  /** The sentences of the day. */
  lines: string[];
}

const fr = (value: number, digits = 0) =>
  (Math.round(value * 10 ** digits) / 10 ** digits)
    .toString()
    .replace('.', ',');

const max = (values: ReadonlyArray<number | null>) => {
  const kept = values.filter((value): value is number => value != null);
  return kept.length > 0 ? Math.max(...kept) : null;
};

/**
 * The days of the briefing: the window of each day, its light and its
 * sentences.
 * @param data - The data.
 * @param limits - The thresholds of the boat.
 * @param course - Planned course, degrees, or null.
 * @param measure - The measure typed at sea, or null.
 * @param now - Now, epoch ms.
 * @returns Up to 4 days.
 */
export function briefingDays(
  data: BriefingData,
  limits: Thresholds,
  course: number | null,
  measure: SeaMeasure | null,
  now = Date.now(),
): BriefingDay[] {
  const all = hoursOf(data, measure);
  const local = (t: number) => new Date(t + data.offset * 1000);
  const dates = [
    ...new Set(all.map((hour) => local(hour.t).toISOString().slice(0, 10))),
  ];
  const today = local(now).toISOString().slice(0, 10);
  const days: BriefingDay[] = [];
  for (const date of dates) {
    if (date < today) continue;
    const hours = all.filter((hour) => {
      const when = local(hour.t);
      const h = when.getUTCHours();
      return (
        when.toISOString().slice(0, 10) === date &&
        h >= WINDOW.from &&
        h <= WINDOW.to &&
        hour.t >= now - 3_600_000
      );
    });
    if (hours.every((hour) => hour.windKn == null)) continue;
    days.push(
      dayOf(date, days.length, hours, all, limits, course, data.offset),
    );
    if (days.length === 4) break;
  }
  return days;
}

function dayOf(
  date: string,
  rank: number,
  hours: Hour[],
  all: Hour[],
  limits: Thresholds,
  course: number | null,
  offset: number,
): BriefingDay {
  const verdict = dayVerdict(hours, all, limits, course);
  const hourOf = (hour: Hour | undefined) =>
    hour ? `${new Date(hour.t + offset * 1000).getUTCHours()} h` : '';
  const winds = hours.map((hour) => hour.windKn);
  const windMax = max(winds);
  const windMin = Math.min(
    ...winds.filter((value): value is number => value != null),
  );
  const gustMax = max(hours.map((hour) => hour.gustKn));
  const strongest = hours.find((hour) => hour.windKn === windMax);
  const hsMax = max(hours.map((hour) => hour.hs));
  const highest = hours.find((hour) => hour.hs === hsMax);
  const force = windMax == null ? null : bft(windMax);
  const degree = hsMax == null ? null : degreeOfHeight(hsMax);
  const lines: string[] = [];
  if (windMax != null) {
    lines.push(
      `Vent ${strongest?.windFrom == null ? '' : `${fromWord(compassPoint(strongest.windFrom))} `}${fr(windMin)} à ${fr(windMax)} nd (force ${force})${gustMax == null ? '' : `, rafales ${fr(gustMax)} nd`}, au plus fort vers ${hourOf(strongest)}.`,
    );
  }
  const first = hours.find((hour) => hour.pressure != null)?.pressure;
  const last = hours.findLast((hour) => hour.pressure != null)?.pressure;
  if (first != null && last != null && Math.abs(last - first) >= 3) {
    lines.push(
      last > first
        ? `Pression en hausse (+${fr(last - first)} hPa dans la journée) : amélioration.`
        : `Pression en baisse (${fr(last - first)} hPa dans la journée) : dégradation en cours.`,
    );
  }
  if (hsMax == null) {
    lines.push(
      'Mer : pas de prévision de vagues ici (lac, ou modèle de vagues absent).',
    );
  } else if (highest) {
    const parts: string[] = [];
    if (highest.windSeaHs != null) {
      parts.push(`mer du vent ${fr(highest.windSeaHs, 1)} m`);
    }
    if (highest.swellHs != null && highest.swellHs >= 0.2) {
      parts.push(
        `houle ${fr(highest.swellHs, 1)} m${highest.swellDir == null ? '' : ` du ${compassPoint(highest.swellDir)}`}`,
      );
    }
    lines.push(
      `Mer ${force ?? '–'}/${degree}, Hs ${fr(hsMax, 1)} m${highest.period == null ? '' : ` (${fr(highest.period, 1)} s)`} vers ${hourOf(highest)}${parts.length > 0 ? ` : ${parts.join(', ')}` : ''}.`,
    );
  }
  let rain = 0;
  for (const hour of hours) rain += hour.rain ?? 0;
  if (rain >= 1) lines.push(`Pluie : ${fr(rain)} mm sur la fenêtre.`);
  return { date, rank, hours, verdict, force, degree, windMax, gustMax, lines };
}

/**
 * « de NO », « d’O »: the elision before a vowel.
 * @param point - The point of the compass.
 * @returns The words.
 */
function fromWord(point: string): string {
  return /^[AEIOU]/u.test(point) ? `d’${point}` : `de ${point}`;
}

/** The words and sign of a light. */
export const LIGHTS = {
  go: { sign: '🟢', word: 'Go' },
  prudence: { sign: '🟠', word: 'Prudence' },
  nogo: { sign: '🔴', word: 'No-go' },
} as const;

/**
 * The day in words: « ven. 20 ».
 * @param date - `YYYY-MM-DD`.
 * @returns The words.
 */
export function dayName(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('fr-CH', {
    weekday: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * The prompt for a counter-analysis by any AI: the point, the boat, the
 * thresholds, the forecast every 3 h, NavIn's lights; the AI is asked for
 * its own reading for now, J1, J2 and J3.
 * @param data - The data.
 * @param days - The days of the briefing.
 * @param boat - The words of the boat and its thresholds.
 * @returns The text.
 */
export function promptOf(
  data: BriefingData,
  days: readonly BriefingDay[],
  boat: string,
): string {
  const rows = data.t
    .map((time, index) => ({ time, index }))
    .filter(({ index }) => index % 3 === 0)
    .map(({ time, index }) => {
      const value = (name: string, digits = 0) => {
        const found = data.v[name]?.[index];
        return found == null ? '–' : fr(found, digits);
      };
      const when = new Date(time + data.offset * 1000)
        .toISOString()
        .slice(5, 13)
        .replace('T', ' ');
      return `${when} h | ${value('wind_speed_10m')} | ${value('wind_direction_10m')} | ${value('wind_gusts_10m')} | ${value('wave_height', 1)} | ${value('wave_period', 1)} | ${value('pressure_msl')} | ${value('cape')}`;
    });
  return [
    'Tu es un prévisionniste marine expérimenté. Fais une contre-analyse indépendante de la prévision ci-dessous pour une sortie en voilier, en français, sans inventer de données.',
    `Point : ${data.name} (${fr(data.lat, 3)}, ${fr(data.lon, 3)}). Source : ${data.src}, lue le ${new Date(data.at).toLocaleString('fr-CH')}.`,
    `Bateau et seuils : ${boat}. Fenêtre de navigation : ${WINDOW.from} h à ${WINDOW.to} h, heure locale.`,
    '',
    'Prévision toutes les 3 h (heure locale) : date heure | vent moyen nd | direction ° | rafales nd | Hs m | période s | pression hPa | CAPE J/kg',
    ...rows,
    '',
    'Avis de NavIn (règles, sans IA) :',
    ...days.map(
      (day) =>
        `${dayName(day.date)} : ${LIGHTS[day.verdict.light].word}${day.verdict.reasons.length > 0 ? ` (${day.verdict.reasons.join(' ; ')})` : ''}`,
    ),
    '',
    'Donne pour maintenant (t), J1, J2 et J3 : la situation générale probable, le vent et la mer attendus, les risques (grains, orages, mer croisée, vent contre courant), ton feu vert, orange ou rouge pour ce bateau, et où ton avis diffère de celui de NavIn. Termine par les sources officielles à consulter (bulletin côtier, BMS, vigilance).',
  ].join('\n');
}
