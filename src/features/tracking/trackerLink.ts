import { errorContext } from '../../shell/errorContext.ts';
import { noteError } from '../../storage/errLog.ts';
import type * as MapExports from '../map/index.ts';
import type * as OnwaterExports from '../onwater/index.ts';

/*
 * The recording must go on whatever happens to the code of other domains, and
 * these domains are not needed before the first point: they load late, and a
 * failure on their side never reaches the GPS logic.
 */
type MapDomain = typeof MapExports;
type OnwaterDomain = typeof OnwaterExports;

const loaded: { map?: MapDomain; onwater?: OnwaterDomain } = {};

/**
 * Load the map and wind domains, so that the next calls are synchronous.
 */
export function loadLinkedDomains(): void {
  withMap(() => undefined);
  withOnwater(() => undefined);
}

/**
 * Refresh the open tracker at every point (legacy `trackerTick`).
 */
export function trackerTick(): void {
  withMap((map) => map.trackerTick());
}

/**
 * Show the instruments position on the open tracker (legacy `trkFix`).
 * @param fix - Position.
 */
export function trkFix(fix: MapExports.TrackerFix): void {
  withMap((map) => map.trkFix(fix));
}

/**
 * Redraw the buttons of the tracker (legacy `drawTrkButtons`).
 */
export function drawTrkButtons(): void {
  withMap((map) => map.drawTrkButtons());
}

/**
 * Ask whether to extend the last track (legacy `trkChooseStart`).
 */
export function trkChooseStart(): void {
  withMap((map) => map.trkChooseStart());
}

/**
 * Recentre the tracker on the zone chosen (legacy `trkZoneRecenter`).
 * @param zone - `lac`, `mer` or `auto`.
 */
export function trkZoneRecenter(zone: string): void {
  withMap((map) => map.trkZoneRecenter(zone));
}

/**
 * Redraw the tracker after a stop from the top tab (prep.js:334-335).
 */
export function afterStop(): void {
  withMap((map) => {
    map.trkReset();
    map.drawTrkButtons();
    map.updateTrkDash();
    map.drawTrkList();
  });
}

/**
 * Depth contours of the device (legacy `isobathLoad`).
 * @returns The contours.
 */
export async function isobathLoad(): Promise<MapExports.IsobathLine[]> {
  const map = await import('../map/index.ts');
  return map.isobathLoad();
}

/**
 * End of a track: the wind alerts are active again (legacy `windMuteEnd`).
 */
export function windMuteEnd(): void {
  withOnwater((onwater) => onwater.windMuteEnd());
}

function withMap(action: (map: MapDomain) => void): void {
  if (loaded.map) {
    guarded(action, loaded.map);
    return;
  }
  import('../map/index.ts')
    .then((map) => {
      loaded.map = map;
      action(map);
    })
    .catch(noteFailure);
}

function withOnwater(action: (onwater: OnwaterDomain) => void): void {
  if (loaded.onwater) {
    guarded(action, loaded.onwater);
    return;
  }
  import('../onwater/index.ts')
    .then((onwater) => {
      loaded.onwater = onwater;
      action(onwater);
    })
    .catch(noteFailure);
}

function guarded<Domain>(action: (domain: Domain) => void, domain: Domain) {
  try {
    action(domain);
  } catch (error) {
    noteFailure(error);
  }
}

function noteFailure(error: unknown): void {
  noteError(
    error instanceof Error ? error.message : error,
    'tracking link',
    errorContext,
  );
}
