import type { NavRoute } from '../../model/routes.ts';
import type { CruiseMeta, Mark } from '../../model/types.ts';
import {
  state,
  traceVoyageOf,
  traceVoyagesVersion,
  updateRoutes,
} from '../../state/index.ts';
import type { SavedRouting } from '../map/routingState.ts';
import { savedRoutings } from '../map/routingState.ts';
import { traceListVersion } from '../map/traceList.ts';
import type { LakeTrack } from '../map/trackStats.ts';
import { allLakeTracks } from '../map/trackStats.ts';

/** What a cruise gathers, and what could join it. */
export interface VoyageRecords {
  navigations: CruiseMeta[];
  /** The traces, each classed on its own (Corban, 28/11). */
  traces: LakeTrack[];
  routes: NavRoute[];
  routings: SavedRouting[];
  marks: Mark[];
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
    traces: classedTraces()
      .filter((item) => item.voyage === id)
      .map((item) => item.track),
    routes: state.data.routes.value.filter((route) => route.voyage === id),
    routings: savedRoutings.value.filter((routing) => routing.voyage === id),
    marks: state.data.marks.value.filter((mark) => mark.voyage === id),
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
    traces: classedTraces()
      .filter((item) => free(item.voyage))
      .map((item) => item.track),
    routes: state.data.routes.value.filter((route) => free(route.voyage)),
    routings: savedRoutings.value.filter((routing) => free(routing.voyage)),
    marks: state.data.marks.value.filter((mark) => free(mark.voyage)),
  };
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
    route.mod = new Date().toISOString();
  });
}

export { setRoutingVoyage } from '../map/routingState.ts';
export { setMarkVoyage, setNavigationVoyage } from '../../state/index.ts';

/**
 * The navigation and the first time of a trace.
 * @param track - The trace.
 * @returns Its navigation id and the time of its first point.
 */
export function traceOrigin(track: LakeTrack): {
  cruise: string;
  first: number;
} {
  return {
    cruise: track.id.split('#', 1)[0] ?? track.id,
    first: track.track[0]?.[0] ?? 0,
  };
}

/**
 * Every trace with its cruise or outing: the one it was put in, else the one
 * it was recorded in, else the one of its navigation.
 * @returns The traces, newest first.
 */
function classedTraces(): Array<{
  track: LakeTrack;
  voyage: string | undefined;
}> {
  // Read again when a trace is recorded, deleted, renamed or moved.
  if (traceListVersion.value < 0 || traceVoyagesVersion.value < 0) return [];
  const metas = new Map(
    state.data.index.value.map((meta) => [meta.id, meta] as const),
  );
  return allLakeTracks().map((track) => {
    const { cruise, first } = traceOrigin(track);
    const put = traceVoyageOf(cruise, first);
    const own = metas.get(cruise)?.voyage;
    return {
      track,
      voyage:
        put === undefined
          ? typeof own === 'string'
            ? own
            : undefined
          : put || undefined,
    };
  });
}
