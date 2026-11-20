import { fmtPos } from '../../lib/geo.ts';
import type { Fetch } from '../../model/fetchWaves.ts';
import { fetchOf, fetchSea } from '../../model/fetchWaves.ts';
import { lastKnownPos, state } from '../../state/index.ts';
import { contextPlace } from '../map/contextPlace.ts';
import { lakePlace } from '../map/lakeCenter.ts';
import { seaPlace } from '../map/seaCenter.ts';
import { wxNext } from '../tracking/weatherSources.ts';

import type { SeaNow } from './seaNow.ts';
import { seaNow } from './seaNow.ts';
import { farFromShore, shoreGrid } from './shoreFar.ts';

/** Where the point comes from. */
export type PointKind = 'cross' | 'zone-sea' | 'zone-lake' | 'gps' | 'map';

/** The point the scales are read at. */
export interface ScalePoint {
  lat: number;
  lon: number;
  kind: PointKind;
  /** Its name: the place of the zone, else its position. */
  name: string;
}

/** A GPS position older than this no longer tells where one sails. */
const FRESH_MS = 12 * 3600e3;

/**
 * The point of the Beaufort and Douglas page: the point of the cross when
 * opened from it; else the place of the zone chosen with NavIn (sea or
 * lake); else a recent GPS position; else the place of the menus.
 * @param cross - The point of the cross, or null.
 * @returns The point.
 */
export function scalePoint(
  cross: { lat: number; lon: number } | null,
): ScalePoint {
  if (cross) return { ...cross, kind: 'cross', name: fmtPos(cross) };
  const forced = state.view.zoneSimV.peek();
  if (forced === 'mer') {
    const { lat, lon, name } = seaPlace();
    return { lat, lon, kind: 'zone-sea', name };
  }
  if (forced === 'lac') {
    const { lat, lon, name } = lakePlace();
    return { lat, lon, kind: 'zone-lake', name };
  }
  const known = lastKnownPos();
  if (known && (!known.at || Date.now() - Date.parse(known.at) < FRESH_MS)) {
    return { lat: known.lat, lon: known.lon, kind: 'gps', name: fmtPos(known) };
  }
  const { lat, lon } = contextPlace();
  return { lat, lon, kind: 'map', name: fmtPos({ lat, lon }) };
}

/** The wind and the sea read at a point. */
export interface PointSea {
  /** Wind of the model for the hour: knots, direction it comes from, gusts. */
  wind: { kn: number; from: number; gust: number | null; src: string } | null;
  /** Sea of the Open-Meteo marine model, null on a lake or without network. */
  sea: SeaNow | null;
  /** Fetch of that wind at the point, null without wind or on land. */
  fetch: Fetch | null;
  /** The sea that wind raises over that fetch, null without fetch. */
  fetchSea: { hs: number; period: number } | null;
}

/**
 * Read the wind (model of the hour), the sea (Open-Meteo marine) and the
 * fetch of that wind at a point. Each part that fails is null.
 * @param point - The point.
 * @param point.lat - Latitude.
 * @param point.lon - Longitude.
 * @param lake - On a lake: no sea model there.
 * @returns What could be read.
 */
export async function readPointSea(
  point: { lat: number; lon: number },
  lake: boolean,
): Promise<PointSea> {
  const [forecast, sea, grid] = await Promise.all([
    wxNext(point.lat, point.lon, 2).catch(() => null),
    lake ? null : seaNow(point).catch(() => null),
    shoreGrid(),
  ]);
  const now = Date.now();
  const rows = (forecast?.rows ?? []).filter(
    (row) => row.tws != null && row.twd != null,
  );
  // The hour now: the row closest to now.
  const row = rows
    .toSorted((one, two) => Math.abs(one.t - now) - Math.abs(two.t - now))
    .at(0);
  const wind =
    row && forecast
      ? {
          kn: row.tws as number,
          from: row.twd as number,
          gust: row.gust ?? null,
          src: forecast.src,
        }
      : null;
  const fetch =
    wind && grid
      ? fetchOf(
          (lat, lon) => farFromShore(grid, lat, lon),
          point.lat,
          point.lon,
          wind.from,
        )
      : null;
  return {
    wind,
    sea,
    fetch,
    fetchSea: wind && fetch ? fetchSea(wind.kn, fetch.km) : null,
  };
}
