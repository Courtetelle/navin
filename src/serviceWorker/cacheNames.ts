import { APP_VERSION } from '../model/taskTemplate.ts';

/** Cache of the app files of this version (legacy `livre-de-bord-v453`). */
export const APP_CACHE = `livre-de-bord-${APP_VERSION}`;
/** Map tiles already seen, kept from one version to the next (read by the offline state in settings). */
export const TILE_CACHE = 'livre-de-bord-tuiles';
/** Map areas downloaded by hand, never trimmed (written by the map domain). */
export const ZONE_CACHE = 'livre-de-bord-zones';
