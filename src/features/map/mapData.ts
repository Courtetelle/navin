import { dayKey, fmtShortDate, fmtTime, fr, pad } from '../../lib/format.ts';
import { distNM } from '../../lib/geo.ts';
import { windTxt } from '../../lib/wind.ts';
import type { Entry, Position } from '../../model/types.ts';
import { loadTrack, state } from '../../state/index.ts';

import type { LatLngPair } from './constants.ts';
import { escapeHtml } from './escapeHtml.ts';

/** Gap that splits a track at a stopover: 45 minutes. */
const STOPOVER_MS = 45 * 60_000;

/** One point of a drawn line. */
export interface MapPoint {
  /** Epoch milliseconds. */
  t: number;
  lat: number;
  lon: number;
}

/** A logbook entry with coordinates. */
export type PositionedEntry = Entry & {
  v: Entry['v'] & { pos: Position };
};

/** What the map draws for a period. */
export interface MapDataResult {
  /** Recorded track, or the entries joined when there is no track. */
  line: MapPoint[];
  /** Entries with coordinates. */
  ents: PositionedEntry[];
  /** Distance sailed in NM, stopovers excluded. */
  nm: number;
}

/**
 * Track and positioned entries of a day, or of the whole cruise (legacy `mapData`).
 * @param day - Day key (YYYY-MM-DD), or `null` for the whole cruise.
 * @returns The line, the entries and the distance.
 */
export function mapData(day?: string | null): MapDataResult {
  const inDay = (time: number | string) =>
    !day || dayKey(new Date(time)) === day;
  const track = loadTrack();
  let line: MapPoint[] = [];
  for (const [t, lat, lon] of track) {
    if (inDay(t)) line.push({ t, lat, lon });
  }
  const ents: PositionedEntry[] = [];
  for (const entry of state.data.cruise.value?.entries ?? []) {
    const position = entry.v.pos;
    if (inDay(entry.t) && position && !position.text) {
      ents.push(entry as PositionedEntry);
    }
  }
  if (line.length < 2) {
    line = ents.map((entry) => ({
      t: Date.parse(entry.t),
      lat: entry.v.pos.lat,
      lon: entry.v.pos.lon,
    }));
  }
  let nm = 0;
  for (let index = 1; index < line.length; index++) {
    const from = line[index - 1] as MapPoint;
    const to = line[index] as MapPoint;
    if (to.t - from.t < STOPOVER_MS) nm += distNM(from, to);
  }
  return { line, ents, nm };
}

/**
 * Cut a track at the stopovers, so no straight line joins two days (legacy `segments`).
 * @param line - Points in time order.
 * @returns The segments of two points or more, as `[lat, lon]` pairs.
 */
export function segments(line: readonly MapPoint[]): LatLngPair[][] {
  const parts: LatLngPair[][] = [];
  let current: LatLngPair[] = [];
  for (let index = 0; index < line.length; index++) {
    const point = line[index] as MapPoint;
    const previous = line[index - 1];
    if (previous && point.t - previous.t > STOPOVER_MS) {
      if (current.length > 1) parts.push(current);
      current = [];
    }
    current.push([point.lat, point.lon]);
  }
  if (current.length > 1) parts.push(current);
  return parts;
}

/**
 * Colour of an entry on a map: green departure, red arrival, else navy (legacy `entryColor`).
 * @param entry - Logbook entry.
 * @returns A CSS colour.
 */
export function entryColor(entry: Pick<Entry, 'v'>): string {
  const events = entry.v.evt ?? [];
  if (events.includes('Départ')) return '#00a040';
  return events.includes('Arrivée') ? '#d00000' : '#0a2a5c';
}

/**
 * HTML of the popup of an entry on the map (legacy `entryPopup`).
 * @param entry - Logbook entry.
 * @returns The popup content.
 */
export function entryPopup(entry: Entry): string {
  const values = entry.v;
  const wind =
    values.tws !== null && values.tws !== undefined ? windTxt(values.tws) : '';
  const parts = [
    values.cog === null || values.cog === undefined
      ? ''
      : `COG ${pad(values.cog, 3)}°`,
    values.sog === null || values.sog === undefined
      ? ''
      : `${fr(values.sog as number)} nd`,
    values.twd === null || values.twd === undefined
      ? ''
      : `vent ${pad(values.twd, 3)}° ${wind}`,
    values.allure ?? '',
    values.loch === null || values.loch === undefined
      ? ''
      : `loch ${fr(Number(values.loch))} NM`,
  ].filter(Boolean);
  const when = new Date(entry.t);
  const note = values.note ? `<br><i>${escapeHtml(values.note)}</i>` : '';
  const events = escapeHtml((values.evt ?? []).join(', '));
  return `<b>${fmtShortDate(when)} ${fmtTime(when)}</b> ${events}<br>${escapeHtml(parts.join(' · '))}${note}`;
}
