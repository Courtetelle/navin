/** A latitude / longitude pair, as Leaflet takes it. */
export type LatLngPair = [number, number];

/** Geographic box in degrees: south, north, west, east. */
export interface GeoBox {
  s: number;
  n: number;
  w: number;
  e: number;
}

/** Colour Swiss national map (swisstopo): an option, never chosen by itself. */
export const SWISS_TILES =
  'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg';
/** Shaded relief of the lake beds (swissBATHY3D, swisstopo). */
export const BATHY_TILES =
  'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissbathy3d-reliefschattierung/default/current/3857/{z}/{x}/{y}.png';
/** OpenStreetMap plan, online only (its servers forbid bulk downloads). */
export const OSM_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
/** OpenSeaMap buoyage overlay. */
export const SEAMARK_TILES =
  'https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png';
/** Area covered by the Swiss data. */
export const SWISS_BOUNDS: [LatLngPair, LatLngPair] = [
  [45.75, 5.85],
  [47.9, 10.6],
];
/** Centre of Lake Geneva. */
export const LEMAN_CENTER: LatLngPair = [46.43, 6.55];
/** Online interactive chart of Lake Geneva. */
export const LEMAN_ARCGIS =
  'https://www.arcgis.com/apps/instant/sidebar/index.html?appid=37cabc11c62a446faa17e32a035850c0&locale=fr&center=6.5218;46.366&level=10';
/** Where the map opens on a simulated sea: the Mediterranean off Toulon. */
export const SEA_CENTER: LatLngPair = [43, 5.95];
/** Box around Lake Geneva. */
export const LEMAN_BBOX: GeoBox = { s: 46.18, n: 46.56, w: 6.1, e: 6.95 };

/**
 * Whether a position lies in the area of the Swiss data (legacy `inSwissArea`).
 * @param position - Position, or nothing.
 * @returns `true` inside the area.
 */
export function inSwissArea(
  position: { lat: number; lon: number } | null | undefined,
): boolean {
  return (
    !!position &&
    position.lat > 45.75 &&
    position.lat < 47.9 &&
    position.lon > 5.85 &&
    position.lon < 10.6
  );
}
