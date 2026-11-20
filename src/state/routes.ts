import { produce } from 'immer';

import { uid } from '../lib/format.ts';
import type { NavRoute, RoutePoint } from '../model/routes.ts';
import { DEFAULT_ROUTE_SPEED, isRoute } from '../model/routes.ts';
import { store } from '../storage/store.ts';

import { data } from './data.ts';

/** Load the routes kept on this device. */
export function loadRoutes(): void {
  data.routes.value = store.arr<NavRoute>('ldb.routes').filter(isRoute);
}

/** Persist the routes. */
export function saveRoutes(): void {
  store.set('ldb.routes', data.routes.value);
}

/**
 * Change the routes with an immer recipe, then save them.
 * @param recipe - Mutates the draft list.
 */
export function updateRoutes(recipe: (routes: NavRoute[]) => void): void {
  data.routes.value = produce(data.routes.value, recipe);
  saveRoutes();
}

/**
 * The name of a new route: « Route 3 », one after the highest kept.
 * @param routes - The routes kept.
 * @returns The name.
 */
export function nextRouteName(routes: readonly NavRoute[]): string {
  let highest = 0;
  for (const route of routes) {
    const numbered = /^Route (?<number>\d+)$/u.exec(route.name.trim())?.groups;
    if (numbered) highest = Math.max(highest, Number(numbered.number));
  }
  return `Route ${highest + 1}`;
}

function rounded(points: readonly RoutePoint[]): RoutePoint[] {
  return points.map((point) => {
    const kept: RoutePoint = {
      lat: Math.round(point.lat * 1e6) / 1e6,
      lon: Math.round(point.lon * 1e6) / 1e6,
    };
    if (point.name?.trim()) kept.name = point.name.trim();
    return kept;
  });
}

/**
 * Save a route: a new one gets an id and a name, a known one is replaced.
 * @param route - The route, without id when new.
 * @returns The route kept.
 */
export function saveRoute(
  route: Partial<NavRoute> & { points: readonly RoutePoint[] },
): NavRoute {
  const now = new Date().toISOString();
  const known = route.id
    ? data.routes.value.find((item) => item.id === route.id)
    : undefined;
  const kept: NavRoute = {
    ...known,
    ...route,
    id: route.id || uid(),
    name: route.name?.trim() || known?.name || nextRouteName(data.routes.value),
    at: known?.at || route.at || now,
    mod: now,
    points: rounded(route.points),
    speed:
      route.speed && route.speed > 0
        ? route.speed
        : (known?.speed ?? DEFAULT_ROUTE_SPEED),
  };
  updateRoutes((routes) => {
    const at = routes.findIndex((item) => item.id === kept.id);
    if (at === -1) routes.push(kept);
    else routes[at] = kept;
  });
  return kept;
}

/**
 * Rename a route; an empty text keeps its name.
 * @param id - Route id.
 * @param text - The new name.
 */
export function renameRoute(id: string, text: string): void {
  if (!text.trim()) return;
  updateRoutes((routes) => {
    const found = routes.find((route) => route.id === id);
    if (!found) return;
    found.name = text.trim();
    found.mod = new Date().toISOString();
  });
}

/**
 * Delete a route.
 * @param id - Route id.
 */
export function removeRoute(id: string): void {
  data.routes.value = data.routes.value.filter((route) => route.id !== id);
  saveRoutes();
}

/**
 * Routes from a backup or another device: unknown ones are added, a known
 * one is replaced when it was changed later there.
 * @param list - Untrusted list.
 */
export function mergeRoutes(list: unknown): void {
  if (!Array.isArray(list)) return;
  const received = list.filter(isRoute);
  if (received.length === 0) return;
  updateRoutes((routes) => {
    for (const route of received) {
      const at = routes.findIndex((item) => item.id === route.id);
      if (at === -1) routes.push(route);
      else if ((route.mod || '') > (routes[at]?.mod || '')) routes[at] = route;
    }
  });
}
