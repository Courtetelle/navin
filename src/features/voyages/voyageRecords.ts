import type { NavRoute } from '../../model/routes.ts';
import type { Cruise, CruiseMeta } from '../../model/types.ts';
import { saveCruiseRecord, state, updateRoutes } from '../../state/index.ts';
import { store } from '../../storage/store.ts';
import type { SavedRouting } from '../map/routingState.ts';
import { savedRoutings } from '../map/routingState.ts';

/** What a cruise gathers, and what could join it. */
export interface VoyageRecords {
  navigations: CruiseMeta[];
  routes: NavRoute[];
  routings: SavedRouting[];
}

/**
 * The navigations (with their traces and photos), routes and routings of a
 * cruise.
 * @param id - Cruise id.
 * @returns Its records.
 */
export function voyageRecords(id: string): VoyageRecords {
  return {
    navigations: state.data.index.value.filter((meta) => meta.voyage === id),
    routes: state.data.routes.value.filter((route) => route.voyage === id),
    routings: savedRoutings.value.filter((routing) => routing.voyage === id),
  };
}

/**
 * The records of no cruise, which can join one.
 * @returns The free records.
 */
export function freeRecords(): VoyageRecords {
  const ids = new Set(state.data.voyageStore.value.list.map((item) => item.id));
  const free = (voyage: unknown) =>
    typeof voyage !== 'string' || !ids.has(voyage);
  return {
    navigations: state.data.index.value.filter((meta) => free(meta.voyage)),
    routes: state.data.routes.value.filter((route) => free(route.voyage)),
    routings: savedRoutings.value.filter((routing) => free(routing.voyage)),
  };
}

/**
 * Put a navigation into a cruise, or take it out.
 * @param id - Navigation id.
 * @param voyage - Cruise id, or undefined.
 */
export function setNavigationVoyage(
  id: string,
  voyage: string | undefined,
): void {
  const open = state.data.cruise.peek();
  const cruise =
    open?.id === id ? open : store.get<Cruise | null>(`ldb.cruise.${id}`, null);
  if (!cruise) return;
  const { voyage: _old, ...rest } = cruise;
  const current = store.get<string | null>('ldb.current', null);
  saveCruiseRecord(voyage ? { ...rest, voyage } : rest, true);
  // Saving marks it current: the current one stays so.
  if (current) store.set('ldb.current', current);
  else store.del('ldb.current');
}

/**
 * Put a route into a cruise, or take it out.
 * @param id - Route id.
 * @param voyage - Cruise id, or undefined.
 */
export function setRouteVoyage(id: string, voyage: string | undefined): void {
  updateRoutes((routes) => {
    const route = routes.find((item) => item.id === id);
    if (!route) return;
    if (voyage) route.voyage = voyage;
    else Reflect.deleteProperty(route, 'voyage');
  });
}

export { setRoutingVoyage } from '../map/routingState.ts';
