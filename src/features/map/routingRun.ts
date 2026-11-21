import type { BoatPolar } from '../../model/polars.ts';
import { isBoatPolar, polarSpeed } from '../../model/polars.ts';
import type { RealPolar } from '../../model/realPolar.ts';
import { binKey, binSpeed, isRealPolar } from '../../model/realPolar.ts';
import type { NavRoute } from '../../model/routes.ts';
import type { RoutingResult, SailSpeed } from '../../model/sailRouting.ts';
import { routeSail } from '../../model/sailRouting.ts';
import type { Boat } from '../../model/types.ts';
import { store } from '../../storage/store.ts';

import type { RouteWind } from './routingWeather.ts';
import { fetchRouteWind, windAt } from './routingWeather.ts';

const PREFS_KEY = 'ldb.routingPrefs';

/** What the routing screen remembers (`ldb.routingPrefs`). */
export interface RoutingPrefs {
  /** Under this speed under sail, the motor (knots). */
  motorBelow: number;
  /** Speed under motor (knots). */
  motorKn: number;
  model: string;
  boatId: string;
}

/** By default: the motor under 5 kn, at 6 kn. */
export const DEFAULT_ROUTING: RoutingPrefs = {
  motorBelow: 5,
  motorKn: 6,
  model: 'best_match',
  boatId: '',
};

function number(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/**
 * The routing preferences kept on the device.
 * @returns The preferences.
 */
export function routingPrefs(): RoutingPrefs {
  const kept = store.get<Partial<RoutingPrefs> | null>(PREFS_KEY, null);
  return {
    motorBelow: number(kept?.motorBelow, DEFAULT_ROUTING.motorBelow),
    motorKn: number(kept?.motorKn, DEFAULT_ROUTING.motorKn),
    model: typeof kept?.model === 'string' ? kept.model : DEFAULT_ROUTING.model,
    boatId: typeof kept?.boatId === 'string' ? kept.boatId : '',
  };
}

/**
 * Keep the routing preferences.
 * @param prefs - The preferences.
 */
export function saveRoutingPrefs(prefs: RoutingPrefs): void {
  store.set(PREFS_KEY, prefs);
}

/** A real box counts once the boat sailed it this many minutes. */
const REAL_MINUTES = 3;

/**
 * The speed of the boat under sail: its polar (with the share it makes), or
 * better, a set of sails that made more at sea (real polar).
 * @param polar - The polar of the boat.
 * @param reals - Its real polars.
 * @returns The speed and the sails.
 */
export function boatSailSpeed(
  polar: BoatPolar,
  reals: readonly RealPolar[],
): (twa: number, tws: number) => SailSpeed {
  return (twa, tws) => {
    let best: SailSpeed = {
      kn: polarSpeed(polar.polar, twa, tws, polar.coef),
      sails: 'Polaire',
    };
    const key = binKey(twa, tws);
    if (!key) return best;
    for (const real of reals) {
      const bin = real.bins[key];
      if (!bin || bin.n < REAL_MINUTES) continue;
      const kn = binSpeed(bin);
      if (kn > best.kn) best = { kn, sails: real.sails };
    }
    return best;
  };
}

/** A routing done, or why not. */
export type RoutingRun =
  | { kind: 'result'; result: RoutingResult; wind: RouteWind }
  | { kind: 'error'; error: string };

/**
 * Route a boat along a route from a departure time, with a weather model.
 * @param route - The route drawn.
 * @param boat - The boat and its polars.
 * @param departMs - Departure, epoch ms.
 * @param prefs - Motor and model.
 * @returns The routing, or why not.
 */
export async function runRouting(
  route: NavRoute,
  boat: Boat,
  departMs: number,
  prefs: RoutingPrefs,
): Promise<RoutingRun> {
  if (route.points.length < 2) {
    return {
      kind: 'error',
      error: 'La route doit avoir au moins deux points.',
    };
  }
  const polar = isBoatPolar(boat.polar) ? boat.polar : null;
  if (!polar) {
    return {
      kind: 'error',
      error:
        'Ce bateau n’a pas de polaire : renseignez-la dans Bateaux › ⛵ Polaire.',
    };
  }
  const reals = Array.isArray(boat.realPolars)
    ? boat.realPolars.filter(isRealPolar)
    : [];
  const wind = await fetchRouteWind(route.points, prefs.model);
  if ('error' in wind) return { kind: 'error', error: wind.error };
  const result = routeSail({
    points: route.points,
    departMs,
    windAt: (lat, lon, ms) => windAt(wind, lat, lon, ms),
    sailSpeed: boatSailSpeed(polar, reals),
    polar: polar.polar,
    motorBelow: prefs.motorBelow,
    motorKn: prefs.motorKn,
  });
  return { kind: 'result', result, wind };
}
