import type { TrackEvent } from '../tracking/index.ts';

/*
 * The tracker is the first screen: it must open whatever happens to the code of
 * other domains, which is only needed once the user acts. Hence loading them late.
 */
const onwater = () => import('../onwater/index.ts');
const prep = () => import('../prep/index.ts');
const tracking = () => import('../tracking/index.ts');

const instruments: { fresh: (() => boolean) | null } = { fresh: null };

/**
 * Object store of the `ldb-docs` database (onwater domain).
 * @param mode - Transaction mode.
 * @returns The object store.
 */
export async function docStore(
  mode: IDBTransactionMode,
): Promise<IDBObjectStore> {
  const domain = await onwater();
  return domain.docStore(mode);
}

/**
 * Sound the alarm (onwater domain).
 * @param level - Alarm level.
 */
export async function playAlarm(level: number): Promise<void> {
  const domain = await onwater();
  domain.playAlarm(level);
}

export { lastWindAlertAt } from '../onwater/lastWindAlert.ts';

/** Show again the text of the last automatic wind alert (onwater domain). */
export async function replayWindAlert(): Promise<void> {
  const domain = await onwater();
  domain.replayWindAlert();
}

/** Start a track at once (prep domain). */
export async function quickStart(): Promise<void> {
  const domain = await prep();
  domain.quickStart();
}

/** Moor: end of the track, then the check-out (prep domain). */
export async function moorNow(): Promise<void> {
  const domain = await prep();
  await domain.moorNow();
}

/**
 * Write an automatic entry (tracking domain).
 * @param event - Detected event.
 * @param lochBase - Log at the start of the trip.
 * @returns The entry.
 */
export async function addAutoEntry(event: TrackEvent, lochBase: number) {
  const domain = await tracking();
  return domain.addAutoEntry(event, lochBase);
}

/** Resume the previous track (tracking domain). */
export async function extendLastTrip(): Promise<void> {
  const domain = await tracking();
  domain.extendLastTrip();
}

/**
 * Start recording (tracking domain).
 * @param resume - Continue the current trip.
 */
export async function startTracking(resume: boolean): Promise<void> {
  const domain = await tracking();
  domain.startTracking(resume);
}

/**
 * Whether the boat instruments give a fresh position (tracking domain). A GPS
 * fix is shown at once: until the domain is there, no instrument can be connected.
 * @returns `true` when they do.
 */
export function nmeaPosFresh(): boolean {
  if (instruments.fresh) return instruments.fresh();
  tracking()
    .then((domain) => {
      instruments.fresh = domain.nmeaPosFresh;
    })
    .catch(() => undefined);
  return false;
}

/**
 * Forecast at a point (tracking domain).
 * @param lat - Latitude.
 * @param lon - Longitude.
 * @param hours - Rows wanted.
 * @returns The forecast.
 */
export async function wxNext(lat: number, lon: number, hours: number) {
  const domain = await tracking();
  return domain.wxNext(lat, lon, hours);
}
