import { fixedAlertById } from '../../model/fixedAlerts.ts';
import type { RoutePoint } from '../../model/routes.ts';
import { store } from '../../storage/store.ts';

import type { AvoidZone, Box } from './waterGrid.ts';
import { buildWaterGrid } from './waterGrid.ts';
import { bendLegs, cellMetres } from './waterRoute.ts';

/** How a route goes round the land. */
export interface AutoOptions {
  /** Least distance to the shore, metres. */
  marginM: number;
  /** Keep out of the offshore wind farms. */
  avoidFarms: boolean;
}

const DEFAULTS: AutoOptions = { marginM: 200, avoidFarms: true };

/** The wind farms of the fixed alerts (their zone on the map). */
const WIND_FARMS = ['eolien-st-brieuc'];

/** Room around the route, in nautical miles, for the way round. */
const PAD_NM = 3;
/** A point may lie this far from the water (a port, a quay), metres. */
const PORT_REACH_M = 3000;

/**
 * The options chosen last time.
 * @returns Margin and zones.
 */
export function autoOptions(): AutoOptions {
  return {
    ...DEFAULTS,
    ...store.get<Partial<AutoOptions>>('ldb.routeAuto', {}),
  };
}

/**
 * Keep the options for next time.
 * @param options - Margin and zones.
 */
export function saveAutoOptions(options: AutoOptions): void {
  store.set('ldb.routeAuto', options);
}

/**
 * The box searched: the route, a fifth of its size around it, and at least
 * {@link PAD_NM} nautical miles.
 * @param points - The route.
 * @returns South, north, west, east.
 */
export function routeBox(points: readonly RoutePoint[]): Box {
  const lats = points.map((point) => point.lat);
  const lons = points.map((point) => point.lon);
  const s = Math.min(...lats);
  const n = Math.max(...lats);
  const w = Math.min(...lons);
  const e = Math.max(...lons);
  const cos = Math.cos((((s + n) / 2) * Math.PI) / 180);
  const padLat = Math.max(PAD_NM / 60, (n - s) / 5);
  const padLon = Math.max(PAD_NM / 60 / cos, (e - w) / 5);
  return { s: s - padLat, n: n + padLat, w: w - padLon, e: e + padLon };
}

/**
 * The zones a route keeps out of.
 * @param options - The options.
 * @returns Round zones.
 */
export function avoidZones(options: AutoOptions): AvoidZone[] {
  if (!options.avoidFarms) return [];
  const zones: AvoidZone[] = [];
  for (const id of WIND_FARMS) {
    const zone = fixedAlertById(id)?.zone;
    if (zone) zones.push({ lat: zone.lat, lon: zone.lon, m: zone.km * 1000 });
  }
  return zones;
}

/** What the way round gave. */
export type AutoAnswer =
  | {
      kind: 'done';
      points: RoutePoint[];
      /** Legs that went round. */
      bent: number;
      /** Legs with no way found, from 0. */
      failed: number[];
    }
  | { kind: 'clear' }
  | { kind: 'short' }
  | { kind: 'no-map' }
  | { kind: 'no-water' };

/**
 * Bend every leg of a route that crosses the land, the margin to the shore
 * or a zone to avoid, with the water of the map file of the device.
 * @param points - The route.
 * @param options - Margin and zones.
 * @returns The new points, or why nothing was done.
 */
export async function aroundLand(
  points: readonly RoutePoint[],
  options: AutoOptions,
): Promise<AutoAnswer> {
  if (points.length < 2) return { kind: 'short' };
  const box = routeBox(points);
  const lats = points.map((point) => point.lat);
  const lons = points.map((point) => point.lon);
  const answer = await buildWaterGrid({
    ...box,
    inner: {
      s: Math.min(...lats),
      n: Math.max(...lats),
      w: Math.min(...lons),
      e: Math.max(...lons),
    },
    marginM: options.marginM,
    avoid: avoidZones(options),
  });
  if (answer.kind !== 'grid') return { kind: answer.kind };
  const { grid, loose } = answer;
  const reach = Math.ceil(
    PORT_REACH_M / cellMetres(grid.zoom, (box.s + box.n) / 2),
  );
  const bent = bendLegs(grid, points, reach, loose);
  if (bent.bent === 0 && bent.failed.length === 0) return { kind: 'clear' };
  return {
    kind: 'done',
    points: bent.points.map((point) => ({ ...point })),
    bent: bent.bent,
    failed: bent.failed,
  };
}
