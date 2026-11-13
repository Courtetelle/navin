import type { LatLng } from 'leaflet';

import { buzz } from '../../lib/dom.ts';
import { go } from '../../shell/router.ts';
import { herePos, navinSpot, state, toast } from '../../state/index.ts';

import { backToGps } from './gpsZone.ts';
import { lakeCenter } from './lakeCenter.ts';
import { leaflet } from './leaflet.ts';
import { mapOrientation, toggleOrientation } from './mapOrientation.ts';
import { seaCenter } from './seaCenter.ts';
import { setFollow, tracker } from './trackerState.ts';

/** Where a scale is centred: the place of NavIn, or the boat. */
type Centre = 'navin' | 'boat';

/**
 * The scales NavIn and the boat button go through on the tablet: the
 * distance shown across the short side of the map, in nautical miles.
 */
export const SCALES_NM = [0.3, 3, 33, 99] as const;
/** Coming from another screen, the map opens at 3 NM. */
export const FIRST_SCALE = 1;

const METRES_PER_NM = 1852;
const WAIT_STEP_MS = 100;
const WAIT_TRIES = 40;

let scale: number = FIRST_SCALE;
let boatScale: number = FIRST_SCALE;

/**
 * The scale after a touch on NavIn.
 * @param current - Rank of the scale shown.
 * @param onMap - The map was already on screen.
 * @returns Rank of the next scale: 3 NM when coming from elsewhere.
 */
export function nextScale(current: number, onMap: boolean): number {
  return onMap ? (current + 1) % SCALES_NM.length : FIRST_SCALE;
}

/**
 * Text of a scale.
 * @param rank - Rank in {@link SCALES_NM}.
 * @returns For example « 33 NM ».
 */
export function scaleText(rank: number): string {
  const nm = SCALES_NM[rank] ?? 3;
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
  const middle =
    centre === 'boat' && boat ? boat : (navinPlace() ?? map.getCenter());
  // NavIn looks where the map is: it must not be pulled back to the boat.
  setFollow(centre === 'boat');
  const span = (SCALES_NM[rank] ?? 3) * METRES_PER_NM;
  map.fitBounds(leaflet().latLng(middle).toBounds(span), { padding: [0, 0] });
}

/**
 * Where NavIn looks: the place the map was last moved to with the fingers,
 * else the place of the zone chosen in the settings.
 * @returns The place, or `null` to stay where the map is.
 */
function navinPlace(): LatLng | null {
  const L = leaflet();
  const spot = navinSpot();
  if (spot) return L.latLng(spot.lat, spot.lon);
  const zone = state.view.zoneSimV.peek();
  if (zone === 'lac') return L.latLng(...lakeCenter());
  if (zone === 'mer') return L.latLng(...seaCenter());
  return null;
}

function onMap(): boolean {
  return state.view.currentView.value === 'tracker';
}

/**
 * NavIn on the tablet: back to the map at 3 NM, or on the map the next
 * scale (0,3 NM, 3 NM, 33 NM, 99 NM, then 0,3 NM again), always on the
 * place of NavIn (where the fingers last left the map, else the place of the
 * settings), never back on the boat.
 * @param shown - The map was already on screen.
 */
export function navinScaleTap(shown: boolean): void {
  buzz();
  scale = nextScale(scale, shown);
  if (!shown) go('tracker');
  apply(scale, 'navin');
  toast(scaleText(scale));
}

/**
 * The boat button of the tablet: back on the GPS, the map on the boat,
 * followed, at 3 NM; touched again, the next scale on the boat.
 */
export function boatScaleTap(): void {
  buzz();
  backToGps();
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
 * The arrow of the landscape tablet: the first touch brings the map back on
 * the boat and follows it, the zoom unchanged; each further touch, the boat
 * already followed, zooms out one level, and stays at the widest.
 */
export function boatArrowTap(): void {
  buzz();
  backToGps();
  const shown = onMap();
  const map = tracker.current?.map;
  const following = Boolean(tracker.current?.follow);
  if (!shown || !map) {
    go('tracker');
    apply(boatScale, 'boat');
    return;
  }
  const here = herePos();
  const boat =
    tracker.current?.me?.getLatLng() ??
    (here ? leaflet().latLng(here.lat, here.lon) : null);
  if (!boat) {
    toast('Position du bateau inconnue : attendez le GPS.');
    return;
  }
  if (!following) {
    setFollow(true);
    map.setView(boat, map.getZoom());
    toast('Bateau suivi');
    return;
  }
  if (map.getZoom() <= map.getMinZoom()) {
    map.setView(boat, map.getZoom());
    toast('Zoom le plus large');
    return;
  }
  map.setView(boat, map.getZoom() - 1);
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
