import { pad } from './format.ts';

/** A box of the zone table: south, north, west, east, in degrees. */
type Box = [s: number, n: number, w: number, e: number];

/**
 * Legal time zones of the waters sailed, first match wins. Approximate on
 * purpose: coasts and lakes are right, land borders only roughly; outside
 * Europe and the Mediterranean the nautical zone is used.
 */
const ZONES: ReadonlyArray<[zone: string, boxes: Box[]]> = [
  ['Atlantic/Canary', [[27, 29.6, -18.5, -13]]],
  ['Atlantic/Madeira', [[32, 33.5, -17.5, -16]]],
  ['Atlantic/Azores', [[36.5, 40, -31.5, -24.5]]],
  ['Atlantic/Reykjavik', [[63, 67, -25, -13]]],
  ['Europe/Lisbon', [[36.8, 42.2, -10.5, -7.45]]],
  // Great Britain and Ireland, without the French coast from Dieppe to Calais.
  [
    'Europe/London',
    [
      [51, 61.5, -11, 1.8],
      [49.85, 51, -11, 1],
    ],
  ],
  ['Africa/Casablanca', [[27.6, 35.95, -13, -1.2]]],
  ['Africa/Algiers', [[18, 37.2, -1.2, 8.6]]],
  ['Africa/Tunis', [[30, 37.6, 8.6, 11.6]]],
  ['Africa/Tripoli', [[19, 33.2, 11.6, 25]]],
  ['Africa/Cairo', [[22, 31.7, 25, 35]]],
  ['Asia/Nicosia', [[34.5, 35.8, 32, 34.7]]],
  // Turkey: the Aegean coast east of the Greek islands, the Marmara.
  [
    'Europe/Istanbul',
    [
      [36, 42.3, 28.5, 45],
      [40, 42.3, 26.6, 28.5],
    ],
  ],
  // North Cape and the north of Sweden stay on Central European time.
  [
    'Europe/Oslo',
    [
      [69.6, 72, 4, 32],
      [63, 69.6, 10, 24],
    ],
  ],
  ['Europe/Moscow', [[59.5, 61, 28.5, 40]]],
  // Greece and Corfu, Bulgaria, Romania, the Black Sea, Baltic states, Finland.
  [
    'Europe/Athens',
    [
      [34, 41, 20.4, 28.5],
      [39.3, 39.82, 19.6, 20.4],
      [41, 48.3, 25, 41],
      [53.9, 70, 21, 32],
    ],
  ],
  ['Europe/Paris', [[35, 72, -10, 32]]],
];

const formats = new Map<string, Intl.DateTimeFormat>();

/**
 * The legal time zone of a place (approximate, see the table above).
 * @param lat - Latitude.
 * @param lon - Longitude.
 * @returns An IANA zone, `Etc/GMT±N` (the nautical zone) out of the table.
 */
export function placeZone(lat: number, lon: number): string {
  for (const [zone, boxes] of ZONES) {
    for (const [s, n, w, e] of boxes) {
      if (lat >= s && lat < n && lon >= w && lon < e) return zone;
    }
  }
  const offset = Math.round(lon / 15);
  if (offset === 0) return 'Etc/GMT';
  // The `Etc` zones count the other way round.
  return `Etc/GMT${offset > 0 ? '-' : '+'}${Math.abs(offset)}`;
}

/**
 * `HH:MM` of a moment in the legal time of a place.
 * @param date - Moment.
 * @param lat - Latitude.
 * @param lon - Longitude.
 * @returns The text; the phone's time when the zone is unknown to the browser.
 */
export function placeTimeText(date: Date, lat: number, lon: number): string {
  const zone = placeZone(lat, lon);
  let format = formats.get(zone);
  if (!format) {
    try {
      format = new Intl.DateTimeFormat('en-GB', {
        timeZone: zone,
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      });
    } catch {
      return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }
    formats.set(zone, format);
  }
  return format.format(date);
}
