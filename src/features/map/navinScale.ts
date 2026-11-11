import { buzz } from '../../lib/dom.ts';
import { go } from '../../shell/router.ts';
import { herePos, state, toast } from '../../state/index.ts';

import { leaflet } from './leaflet.ts';
import { mapOrientation, toggleOrientation } from './mapOrientation.ts';
import { setFollow, tracker } from './trackerState.ts';

/** Where a scale is centred: the map as shown, or the boat. */
type Centre = 'view' | 'boat';

/**
 * The scales NavIn and the boat button go through on the tablet: the
 * distance shown across the short side of the map, in nautical miles.
 */
export const SCALES_NM = [2, 30, 58] as const;
/** Coming from another screen, the map opens at 2 NM. */
export const FIRST_SCALE = 0;

const METRES_PER_NM = 1852;
const WAIT_STEP_MS = 100;
const WAIT_TRIES = 40;

let scale: number = FIRST_SCALE;
let boatScale: number = FIRST_SCALE;

/**
 * The scale after a touch on NavIn.
 * @param current - Rank of the scale shown.
 * @param onMap - The map was already on screen.
 * @returns Rank of the next scale: 2 NM when coming from elsewhere.
 */
export function nextScale(current: number, onMap: boolean): number {
  return onMap ? (current + 1) % SCALES_NM.length : FIRST_SCALE;
}

/**
 * Text of a scale.
 * @param rank - Rank in {@link SCALES_NM}.
 * @returns For example « 30 NM ».
 */
export function scaleText(rank: number): string {
  const nm = SCALES_NM[rank] ?? 2;
  return `${String(nm).replace('.', ',')} NM`;
}

function apply(rank: number, centre: Centre, tries = WAIT_TRIES): void {
  const handle = tracker.current;
  const map = handle?.map;
  if (!map) {
    if (tries > 0) {
      setTimeout(() => apply(rank, centre, tries - 1), WAIT_STEP_MS);
    }
    return;
  }
  const here = herePos();
  const boat =
    handle.me?.getLatLng() ??
    (here ? leaflet().latLng(here.lat, here.lon) : null);
  const middle = centre === 'boat' && boat ? boat : map.getCenter();
  // NavIn looks where the map is: it must not be pulled back to the boat.
  setFollow(centre === 'boat');
  const span = (SCALES_NM[rank] ?? 2) * METRES_PER_NM;
  map.fitBounds(leaflet().latLng(middle).toBounds(span), { padding: [0, 0] });
}

function onMap(): boolean {
  return state.view.currentView.value === 'tracker';
}

/**
 * NavIn on the tablet: back to the map at 2 NM, or on the map the next
 * scale (2 NM, 30 NM, 58 NM, then 2 NM again), always where
 * the map is looking, never back on the boat.
 * @param shown - The map was already on screen.
 */
export function navinScaleTap(shown: boolean): void {
  buzz();
  scale = nextScale(scale, shown);
  if (!shown) go('tracker');
  apply(scale, 'view');
  toast(scaleText(scale));
}

/**
 * The boat button of the tablet: the map on the boat, followed, at 2 NM;
 * touched again, the next scale on the boat.
 */
export function boatScaleTap(): void {
  buzz();
  const shown = onMap();
  const following = Boolean(tracker.current?.follow);
  boatScale = nextScale(boatScale, shown && following);
  if (!shown) go('tracker');
  if (!tracker.current?.me && !herePos()) {
    toast('Position du bateau inconnue : attendez le GPS.');
    return;
  }
  apply(boatScale, 'boat');
  toast(`Bateau · ${scaleText(boatScale)}`);
}

/**
 * Long press on the boat button: the map turned to the course of the boat,
 * or north up again.
 * @returns Whether the course is now up.
 */
export function boatOrientPress(): boolean {
  buzz();
  const map = tracker.current?.map;
  if (map) toggleOrientation(map);
  else toast('Ouvrez la carte NavIn pour l’orienter.');
  return mapOrientation() === 'course';
}
