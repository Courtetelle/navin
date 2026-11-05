import { angDiff, bearing, distNM } from '../../lib/geo.ts';
import { inFrenchLeman } from '../../model/contacts.ts';

import {
  LEMAN_LINES,
  LEMAN_MARKS,
  SEA_ZONE1_MARKS,
  SOS_DIRS,
  SOS_PLACES,
} from './sosPlaceMarks.ts';

/** A position, as the place words need it. */
interface LatLon {
  lat: number;
  lon: number;
}

/**
 * French « of » before a place name (legacy `deN`).
 * @param name - Place name.
 * @returns e.g. `du Bouveret`, `d’Évian`, `de Lausanne`.
 */
export function ofPlace(name: string): string {
  if (name.startsWith('Le ')) return `du ${name.slice(3)}`;
  if (name.startsWith('Les ')) return `des ${name.slice(4)}`;
  if (name.startsWith('La ')) return `de la ${name.slice(3)}`;
  if (/^(?:cap|phare|port)\b/.test(name)) return `du ${name}`;
  if (name.startsWith('Hermance')) return `d’${name}`;
  return /^[AEIOUYÉÈÊÂÎaeiouyéèî]/.test(name) ? `d’${name}` : `de ${name}`;
}

/**
 * Position said in words for the rescue services (legacy `sosPlaceWords`):
 * the detailed zones first (Lake Geneva, first sea zone), else the nearest
 * known places.
 * @param position - Position.
 * @returns The sentence, `''` when no known place is near.
 */
export function sosPlaceWords(
  position: { lat?: number | null; lon?: number | null } | null | undefined,
): string {
  if (position?.lat == null || position.lon == null) return '';
  const here = { lat: position.lat, lon: position.lon };
  const zone = sosZoneWords(here);
  if (zone) return zone;
  const places = SOS_PLACES.map(([name, lat, lon]) => {
    const place = { lat, lon };
    return {
      name,
      km: distNM(here, place) * 1.852,
      towards: bearing(here, place),
      from: bearing(place, here),
    };
  }).toSorted((first, second) => first.km - second.km);
  const nearest = places[0];
  if (!nearest || nearest.km > 60) return '';
  const opposite = places
    .slice(1)
    .find(
      (place) =>
        place.km < 30 &&
        place.km < nearest.km * 6 &&
        angDiff(place.towards, nearest.towards) > 110,
    );
  if (opposite && nearest.km >= 0.5) {
    return `entre ${nearest.name} et ${opposite.name}, à ${kmText(nearest.km)} ${ofPlace(nearest.name)}`;
  }
  return `à ${kmText(nearest.km)} ${directionFrom(nearest.from)} ${ofPlace(nearest.name)}`;
}

function kmText(km: number): string {
  if (km < 1) return 'moins de 1 km';
  const rounded = km < 10 ? Math.round(km * 2) / 2 : Math.round(km);
  return `environ ${String(rounded).replace('.', ',')} km`;
}

function kmWord(km: number): string {
  const rounded = km < 10 ? Math.round(km * 10) / 10 : Math.round(km);
  return String(rounded).replace('.', ',');
}

function directionFrom(degrees: number): string {
  return SOS_DIRS[Math.round(degrees / 45) % 8] as string;
}

function lemanLineWords(position: LatLon): string {
  const kmPerLon = 111.32 * Math.cos((position.lat * Math.PI) / 180);
  const kmPerLat = 110.57;
  let best: {
    first: string;
    second: string;
    along: number;
    distance: number;
    length: number;
    side: string;
  } | null = null;
  for (const [first, second] of LEMAN_LINES) {
    const start = LEMAN_MARKS[first];
    const end = LEMAN_MARKS[second];
    if (!start || !end) continue;
    const startX = start[1] * kmPerLon;
    const startY = start[0] * kmPerLat;
    const lineX = end[1] * kmPerLon - startX;
    const lineY = end[0] * kmPerLat - startY;
    const pointX = position.lon * kmPerLon - startX;
    const pointY = position.lat * kmPerLat - startY;
    const squared = lineX * lineX + lineY * lineY;
    if (!squared) continue;
    const along = (pointX * lineX + pointY * lineY) / squared;
    if (along < 0 || along > 1) continue;
    const distance =
      Math.abs(pointX * lineY - pointY * lineX) / Math.sqrt(squared);
    if (!best || distance < best.distance) {
      best = {
        first,
        second,
        along,
        distance,
        length: Math.sqrt(squared),
        side: pointX - along * lineX > 0 ? 'est' : 'ouest',
      };
    }
  }
  if (!best || best.distance > 1.5) return '';
  const near = best.along <= 0.5 ? best.first : best.second;
  const fromNear =
    (best.along <= 0.5 ? best.along : 1 - best.along) * best.length;
  const offset =
    best.distance < 1
      ? `${Math.round(best.distance * 10) * 100} m`
      : `${kmWord(best.distance)} km`;
  const side =
    best.distance > 0.3 ? `, à ${offset} à l’${best.side} de l’axe` : '';
  const along = fromNear < 0.3 ? 'moins de 300 m' : `${kmWord(fromNear)} km`;
  return `dans l’axe entre ${best.first} et ${best.second}, à ${along} ${ofPlace(near)}${side}`;
}

function sosZoneWords(position: LatLon): string | null {
  if (
    position.lat > 46.19 &&
    position.lat < 46.56 &&
    position.lon > 6.1 &&
    position.lon < 6.96
  ) {
    const waters = inFrenchLeman(position) ? 'eaux françaises' : 'eaux suisses';
    const line = lemanLineWords(position);
    if (line) return `${line[0]?.toUpperCase()}${line.slice(1)} · ${waters}`;
    const nearest = nearestMark(LEMAN_MARKS, position);
    const km = nearest.nm * 1.852;
    const distance = km < 0.3 ? 'moins de 300 m' : `environ ${kmWord(km)} km`;
    return `À ${distance} ${directionFrom(nearest.from)} ${ofPlace(nearest.name)} · ${waters}`;
  }
  const mark = nearestMark(SEA_ZONE1_MARKS, position);
  if (mark.nm >= 12) return null;
  if (mark.nm < 0.15) return `Tout près ${ofPlace(mark.name)}`;
  const miles = String(mark.nm < 10 ? mark.nm.toFixed(1) : Math.round(mark.nm))
    .replace('.0', '')
    .replace('.', ',');
  const heading = String(Math.round(mark.from) % 360).padStart(3, '0');
  return `À ${miles} mille${mark.nm >= 1.95 ? 's' : ''} dans le ${heading}° ${ofPlace(mark.name)}`;
}

function nearestMark(
  marks: Readonly<Record<string, readonly [number, number]>>,
  position: LatLon,
): { name: string; nm: number; from: number } {
  let nearest = { name: '', nm: Infinity, from: 0 };
  for (const [name, [lat, lon]] of Object.entries(marks)) {
    const mark = { lat, lon };
    const nm = distNM(position, mark);
    if (nm < nearest.nm) nearest = { name, nm, from: bearing(mark, position) };
  }
  return nearest;
}
