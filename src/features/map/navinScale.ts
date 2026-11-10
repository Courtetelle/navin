import { buzz } from '../../lib/dom.ts';
import { go } from '../../shell/router.ts';
import { toast } from '../../state/index.ts';

import { leaflet } from './leaflet.ts';
import { tracker } from './trackerState.ts';

/**
 * The scales NavIn goes through on the tablet: the distance shown across the
 * short side of the map, in nautical miles. The first is the detailed map.
 */
export const SCALES_NM = [0.5, 2, 30, 58] as const;
/** Coming from another screen, the map opens at 2 NM. */
export const FIRST_SCALE = 1;

const METRES_PER_NM = 1852;
const WAIT_STEP_MS = 100;
const WAIT_TRIES = 40;

let scale: number = FIRST_SCALE;

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
 * @returns For example « Carte détaillée · 0,5 NM » or « 30 NM ».
 */
export function scaleText(rank: number): string {
  const nm = SCALES_NM[rank] ?? 2;
  const shown = `${String(nm).replace('.', ',')} NM`;
  return rank === 0 ? `Carte détaillée · ${shown}` : shown;
}

function apply(rank: number, tries = WAIT_TRIES): void {
  const handle = tracker.current;
  const map = handle?.map;
  if (!map) {
    if (tries > 0) setTimeout(() => apply(rank, tries - 1), WAIT_STEP_MS);
    return;
  }
  const center = handle.me?.getLatLng() ?? map.getCenter();
  const span = (SCALES_NM[rank] ?? 2) * METRES_PER_NM;
  map.fitBounds(leaflet().latLng(center).toBounds(span), { padding: [0, 0] });
}

/**
 * NavIn on the tablet: back to the map at 2 NM, or on the map the next
 * scale (detailed, 2 NM, 30 NM, 58 NM, then detailed again).
 * @param onMap - The map was already on screen.
 */
export function navinScaleTap(onMap: boolean): void {
  buzz();
  scale = nextScale(scale, onMap);
  if (!onMap) go('tracker');
  apply(scale);
  toast(scaleText(scale));
}
