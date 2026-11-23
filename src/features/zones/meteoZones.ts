/**
 * The sea zones of the bulletins of Météo-France (coast up to 20 NM, and
 * offshore), and the Léman, for LiveMétéo: drawn on the map, chosen by a long
 * press on the button of the zone, one or several. Their outlines are cut out
 * of the OpenStreetMap sea by `scripts/shore/build_zones.py` (workflow « Zones
 * Météo-France ») into `public/meteo-zones.json`; each zone carries the
 * circles that cover its coast, on which its stations are read.
 */

/** Sea or lake the zone belongs to. */
export type ZoneBasin = 'manche' | 'atlantique' | 'mediterranee' | 'lac';
/** Coast band (bulletin côte), offshore (bulletin large) or lake. */
export type ZoneKind = 'cote' | 'large' | 'lac';

/** One zone, as the file gives it. */
export interface MeteoZone {
  id: string;
  name: string;
  basin: ZoneBasin;
  kind: ZoneKind;
  /** Polygons, each a list of rings of `[lon, lat]`, the first the outline. */
  polys: Array<Array<Array<[number, number]>>>;
  /** Circles of its coast where the stations are read: `[lat, lon, km]`. */
  reads: Array<[number, number, number]>;
}

/** A circle where stations are read. */
export interface ReadCircle {
  lat: number;
  lon: number;
  km: number;
}

/** A box in degrees. */
export interface ZoneBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

/** A group of zones chosen with one touch. */
export interface ZoneSet {
  id: string;
  label: string;
  ids: (zones: readonly MeteoZone[]) => string[];
}

/** The groups offered in the chooser. */
export const ZONE_SETS: readonly ZoneSet[] = [
  {
    id: 'manche',
    label: 'Manche',
    ids: (zones) => zones.filter((z) => z.basin === 'manche').map((z) => z.id),
  },
  {
    id: 'atlantique',
    label: 'Atlantique',
    ids: (zones) =>
      zones.filter((z) => z.basin === 'atlantique').map((z) => z.id),
  },
  {
    id: 'mediterranee',
    label: 'Méditerranée',
    ids: (zones) =>
      zones.filter((z) => z.basin === 'mediterranee').map((z) => z.id),
  },
  {
    id: 'cotes',
    label: 'Toutes les côtes de France',
    ids: (zones) => zones.filter((z) => z.kind === 'cote').map((z) => z.id),
  },
  {
    id: 'lacs',
    label: 'Léman (tout le lac)',
    ids: (zones) => zones.filter((z) => z.kind === 'lac').map((z) => z.id),
  },
];

/** Names of the basins, in the order of the chooser. */
export const BASIN_NAMES: Readonly<Record<ZoneBasin, string>> = {
  manche: 'Manche',
  atlantique: 'Atlantique',
  mediterranee: 'Méditerranée',
  lac: 'Lacs',
};

/** A station this far outside a zone still belongs to it (inland), km. */
export const ZONE_MARGIN_KM = 1.5;
/** At most this many circles are read at once. */
export const MOST_READS = 16;
/** Two circles nearer than this are read once, km. */
const SAME_READ_KM = 30;

const KM_PER_DEG = 111.195;

/**
 * Whether a point is inside the polygons of a zone (even-odd over all their
 * rings, so that holes stay out).
 * @param zone - The zone.
 * @param lat - Latitude.
 * @param lon - Longitude.
 * @returns `true` inside.
 */
export function inZone(zone: MeteoZone, lat: number, lon: number): boolean {
  let inside = false;
  for (const poly of zone.polys) {
    for (const ring of poly) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i] ?? [0, 0];
        const [xj, yj] = ring[j] ?? [0, 0];
        if (
          yi > lat !== yj > lat &&
          lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
        ) {
          inside = !inside;
        }
      }
    }
  }
  return inside;
}

/**
 * Distance from a point to a zone, 0 inside, in km (flat near the point: the
 * zones are only looked at within a few km).
 * @param zone - The zone.
 * @param lat - Latitude.
 * @param lon - Longitude.
 * @returns Kilometres.
 */
export function zoneDistanceKm(
  zone: MeteoZone,
  lat: number,
  lon: number,
): number {
  if (inZone(zone, lat, lon)) return 0;
  const kx = KM_PER_DEG * Math.cos((lat * Math.PI) / 180);
  const ky = KM_PER_DEG;
  let best = Infinity;
  for (const poly of zone.polys) {
    for (const ring of poly) {
      for (let i = 1; i < ring.length; i++) {
        const [x1, y1] = ring[i - 1] ?? [0, 0];
        const [x2, y2] = ring[i] ?? [0, 0];
        const ax = (x1 - lon) * kx;
        const ay = (y1 - lat) * ky;
        const bx = (x2 - lon) * kx;
        const by = (y2 - lat) * ky;
        const dx = bx - ax;
        const dy = by - ay;
        const length = dx * dx + dy * dy;
        const t =
          length === 0
            ? 0
            : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / length));
        const px = ax + t * dx;
        const py = ay + t * dy;
        best = Math.min(best, Math.hypot(px, py));
      }
    }
  }
  return best;
}

/**
 * The zones a place stands in: its coast zone (or zones) and its offshore
 * zone; on land near the sea, the zones within the margin. A lake place
 * (`lake`) gets its lake.
 * @param zones - All the zones.
 * @param lat - Latitude.
 * @param lon - Longitude.
 * @param lake - The place is on a lake.
 * @returns The ids, coast first; empty far from every zone.
 */
export function zonesAt(
  zones: readonly MeteoZone[],
  lat: number,
  lon: number,
  lake = false,
): string[] {
  if (lake) {
    const lakes = zones.filter((z) => z.kind === 'lac');
    const near = lakes.filter((z) => zoneDistanceKm(z, lat, lon) <= 10);
    return near.map((z) => z.id);
  }
  const sea = zones.filter((z) => z.kind !== 'lac');
  const coast = sea.filter(
    (z) => z.kind === 'cote' && zoneDistanceKm(z, lat, lon) <= ZONE_MARGIN_KM,
  );
  const large = sea.filter(
    (z) => z.kind === 'large' && zoneDistanceKm(z, lat, lon) <= ZONE_MARGIN_KM,
  );
  // Inside a coast band the offshore zone around it is not read: the
  // stations of the coast are those of the band.
  if (coast.length > 0) return coast.map((z) => z.id);
  return large.slice(0, 1).map((z) => z.id);
}

/**
 * The zones LiveMétéo shows: those chosen (long press on the button),
 * else those of the place.
 * @param zones - All the zones.
 * @param chosen - The ids chosen, empty for « where I am ».
 * @param place - The boat (or the zone of NavIn).
 * @param lake - The place is on a lake.
 * @returns The zones.
 */
export function shownZones(
  zones: readonly MeteoZone[],
  chosen: readonly string[],
  place: { lat: number; lon: number },
  lake = false,
): MeteoZone[] {
  const wanted = new Set(
    chosen.length > 0 ? chosen : zonesAt(zones, place.lat, place.lon, lake),
  );
  return zones.filter((z) => wanted.has(z.id));
}

/**
 * The circles to read for some zones, one only where two are near, at most
 * {@link MOST_READS}, nearest to the place first.
 * @param zones - The zones shown.
 * @param place - The boat.
 * @param most - Circles at most ({@link MOST_READS} without it).
 * @returns The circles.
 */
export function readCircles(
  zones: readonly MeteoZone[],
  place: { lat: number; lon: number },
  most = MOST_READS,
): ReadCircle[] {
  const all = zones
    .flatMap((z) => z.reads)
    .map(([lat, lon, km]) => ({ lat, lon, km }));
  const far = (a: ReadCircle) =>
    Math.hypot(
      (a.lat - place.lat) * KM_PER_DEG,
      (a.lon - place.lon) * KM_PER_DEG * Math.cos((place.lat * Math.PI) / 180),
    );
  const kept: ReadCircle[] = [];
  for (const circle of all.toSorted((a, b) => far(a) - far(b))) {
    const kx = KM_PER_DEG * Math.cos((circle.lat * Math.PI) / 180);
    const twin = kept.some(
      (k) =>
        Math.hypot(
          (k.lat - circle.lat) * KM_PER_DEG,
          (k.lon - circle.lon) * kx,
        ) < SAME_READ_KM,
    );
    if (!twin) kept.push(circle);
    if (kept.length >= most) break;
  }
  return kept;
}

/**
 * Whether a station belongs to the zones shown: in one, or on land within
 * {@link ZONE_MARGIN_KM} of one.
 * @param zones - The zones shown.
 * @param lat - Latitude of the station.
 * @param lon - Longitude of the station.
 * @returns `true` when it belongs.
 */
export function stationInZones(
  zones: readonly MeteoZone[],
  lat: number,
  lon: number,
): boolean {
  return zones.some((z) => zoneDistanceKm(z, lat, lon) <= ZONE_MARGIN_KM);
}

/**
 * The box that holds the zones.
 * @param zones - The zones.
 * @returns The box, `null` without zones.
 */
export function zonesBox(zones: readonly MeteoZone[]): ZoneBox | null {
  let box: ZoneBox | null = null;
  for (const zone of zones) {
    for (const poly of zone.polys) {
      for (const [lon, lat] of poly[0] ?? []) {
        box = box
          ? {
              south: Math.min(box.south, lat),
              west: Math.min(box.west, lon),
              north: Math.max(box.north, lat),
              east: Math.max(box.east, lon),
            }
          : { south: lat, west: lon, north: lat, east: lon };
      }
    }
  }
  return box;
}

/** Short names on the button, by zone. */
const SHORT: Readonly<Record<string, string>> = {
  'belge-somme': 'BS',
  'somme-hague': 'SH',
  'hague-penmarch': 'HP',
  'penmarch-aiguillon': 'PA',
  'aiguillon-espagne': 'AE',
  'espagne-camargue': 'EC',
  'camargue-straphael': 'CR',
  'straphael-menton': 'RM',
  corse: 'Co',
  'pas-de-calais': 'PdC',
  antifer: 'Ant',
  casquets: 'Cas',
  ouessant: 'Oue',
  iroise: 'Iro',
  yeu: 'Yeu',
  rochebonne: 'Roc',
  cantabrico: 'Can',
  pazenn: 'Paz',
  finisterre: 'Fin',
  sole: 'Sol',
  lion: 'Lio',
  provence: 'Pro',
  ligure: 'Lig',
  'corse-large': 'Cor',
  elbe: 'Elb',
  maddalena: 'Mad',
  sardaigne: 'Sar',
  minorque: 'Min',
  baleares: 'Bal',
  'est-cabrera': 'Cab',
  leman: 'Lém',
};

/**
 * What the button shows: the short name of the zone, or how many.
 * @param zones - The zones shown.
 * @returns A short text.
 */
export function zonesButtonText(zones: readonly MeteoZone[]): string {
  if (zones.length === 0) return '–';
  if (zones.length === 1) {
    const [zone] = zones;
    return zone ? (SHORT[zone.id] ?? zone.name.slice(0, 3)) : '–';
  }
  return String(zones.length);
}

/**
 * The zones in words, for the band and the reader of the screen.
 * @param zones - The zones shown.
 * @returns « Casquets », « Casquets et Ouessant », « Manche (5 zones) »…
 */
export function zonesText(zones: readonly MeteoZone[]): string {
  const names = zones.map((z) => z.name);
  if (names.length === 0) return 'aucune zone';
  if (names.length <= 2) return names.join(' et ');
  return `${names.slice(0, 2).join(', ')} et ${names.length - 2} autre${names.length > 3 ? 's' : ''}`;
}

/**
 * Read the file of the zones.
 * @param value - The parsed JSON.
 * @returns The zones, empty when the file is not one.
 */
export function parseZones(value: unknown): MeteoZone[] {
  if (!value || typeof value !== 'object') return [];
  const zones = (value as { zones?: unknown }).zones;
  if (!Array.isArray(zones)) return [];
  return zones.filter(
    (z): z is MeteoZone =>
      !!z &&
      typeof z === 'object' &&
      typeof (z as MeteoZone).id === 'string' &&
      typeof (z as MeteoZone).name === 'string' &&
      Array.isArray((z as MeteoZone).polys) &&
      Array.isArray((z as MeteoZone).reads),
  );
}

let loading: Promise<MeteoZone[]> | null = null;

/**
 * The zones, read once (again next time when the file could not be read).
 * @returns The zones, empty when unreadable.
 */
export function meteoZones(): Promise<MeteoZone[]> {
  if (loading) return loading;
  const reading = fetch(`${import.meta.env.BASE_URL}meteo-zones.json`)
    .then((response) => (response.ok ? response.json() : null))
    .then(parseZones)
    .catch(() => []);
  loading = reading;
  void reading.then((zones) => {
    if (zones.length === 0 && loading === reading) loading = null;
  });
  return reading;
}
