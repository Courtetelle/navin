import { fmtDur, fr } from '../../lib/format.ts';
import type { LatLon } from '../../lib/geo.ts';
import { bearing, distNM } from '../../lib/geo.ts';
import { herePos } from '../../state/index.ts';

/** Distance and course from my position, as shown (legacy `relTxt`). */
export interface RelativeParts {
  distance: string;
  bearing: string;
  /** ` · 1 h 05 à 4,5 nd` when under way. */
  eta: string;
}

/**
 * True bearing on three digits (legacy `brg3`).
 * @param value - Bearing in degrees.
 * @returns e.g. `045°`.
 */
export function bearingText(value: number): string {
  return `${String(Math.round(value) % 360).padStart(3, '0')}°`;
}

/**
 * A distance in metres under 0.1 NM, else in NM.
 * @param miles - Distance in NM.
 * @returns e.g. `120 m` or `2,3 NM`.
 */
export function distanceText(miles: number): string {
  return miles < 0.1 ? `${Math.round(miles * 1852)} m` : `${fr(miles)} NM`;
}

/**
 * Distance, course and time to a point from my position.
 * @param point - Target.
 * @returns The parts, or `null` while waiting for the GPS.
 */
export function relativeParts(point: LatLon): RelativeParts | null {
  const me = herePos();
  if (!me) return null;
  const distance = distNM(me, point);
  const speed = Number(me.sog);
  const eta =
    speed > 0.5
      ? ` · ${fmtDur((distance / speed) * 3_600_000)} à ${fr(speed)} nd`
      : '';
  return {
    distance: distanceText(distance),
    bearing: bearingText(bearing(me, point)),
    eta,
  };
}

/**
 * The same as HTML, for Leaflet popups (legacy `relTxt`).
 * @param point - Target.
 * @returns The HTML.
 */
export function relativeHtml(point: LatLon): string {
  const parts = relativeParts(point);
  if (!parts) return 'Ma position : en attente du GPS…';
  return `<b>${parts.distance}</b> · cap à suivre <b>${parts.bearing}</b> (vrai)${parts.eta}`;
}
