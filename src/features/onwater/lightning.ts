/*
 * Lightning seen from space: the Lightning Imager of the European satellite
 * MTG (EUMETSAT), shown by EUMETView without key. Each image adds up the
 * flashes of 5 minutes on a 2 km grid; it comes out about 10 minutes late.
 * It is a help to see a storm coming, not a warning system.
 */

/** The map server of EUMETView. */
export const LIGHTNING_WMS = 'https://view.eumetsat.int/geoserver/ows';
/** The layer of the flashes: Accumulated Flash Area, every 5 minutes. */
export const LIGHTNING_LAYER = 'mtg_fd:li_afa';
/** One image every 5 minutes. */
const STEP_MS = 5 * 60_000;
/** The radii offered for the alert, in nautical miles. */
export const LIGHTNING_RADII_NM = [15, 30, 60] as const;
/** The radius by default, in nautical miles. */
export const LIGHTNING_RADIUS_NM = 30;
/** Kilometres in a nautical mile. */
const KM_PER_NM = 1.852;
/** Kilometres in a degree of latitude. */
const KM_PER_DEG = 111.32;

/** Settings of the lightning alert (`settings.lightning`). */
export interface LightningSettings {
  /** The alert is on; yes unless false. */
  on?: boolean;
  /** Its radius, in nautical miles. */
  radiusNm?: number;
  /** The flashes on the map; yes unless false. */
  map?: boolean;
}

/** A point and the circle around it. */
export interface LightningArea {
  lat: number;
  lon: number;
  /** Radius in km. */
  km: number;
}

/** What one image shows inside the circle. */
export interface LightningSpots {
  /** The nearest flash area, in km, or null without any. */
  nearestKm: number | null;
  /** Its bearing from the centre, in degrees. */
  bearing: number | null;
  /** Grid cells with flashes inside the circle. */
  cells: number;
  /** Some cell had 10 flashes or more in 5 minutes. */
  strong: boolean;
}

/** What the last images show around the boat. */
export interface LightningReport extends LightningSpots {
  /** The flashes come nearer than 15 minutes before. */
  nearer: boolean;
  /** The time of the newest image read, epoch ms. */
  at: number;
  /** When it was read, epoch ms. */
  readAt: number;
}

/**
 * The radius chosen, in NM.
 * @param settings - The lightning settings.
 * @returns Nautical miles.
 */
export function lightningRadiusNm(
  settings: LightningSettings | undefined,
): number {
  const chosen = Number(settings?.radiusNm);
  return (LIGHTNING_RADII_NM as readonly number[]).includes(chosen)
    ? chosen
    : LIGHTNING_RADIUS_NM;
}

/**
 * Whether the alert is on (Météo › Alerte foudre), yes by default.
 * @param settings - The lightning settings.
 * @returns True to sound it.
 */
export function lightningAlertOn(
  settings: LightningSettings | undefined,
): boolean {
  return settings?.on !== false;
}

/**
 * Whether the flashes are on the map (Météo › Alerte foudre), yes by default.
 * @param settings - The lightning settings.
 * @returns True to show them.
 */
export function lightningOnMap(
  settings: LightningSettings | undefined,
): boolean {
  return settings?.map !== false;
}

/**
 * Nautical miles in km.
 * @param nm - Nautical miles.
 * @returns Kilometres.
 */
export function nmToKm(nm: number): number {
  return nm * KM_PER_NM;
}

/**
 * The square of the image around the circle, in degrees.
 * @param area - Centre and radius.
 * @returns West, south, east, north.
 */
export function lightningBox(
  area: LightningArea,
): [number, number, number, number] {
  const dLat = area.km / KM_PER_DEG;
  const dLon =
    area.km /
    (KM_PER_DEG * Math.max(0.1, Math.cos((area.lat * Math.PI) / 180)));
  return [area.lon - dLon, area.lat - dLat, area.lon + dLon, area.lat + dLat];
}

/**
 * The times of the images of the last quarter of an hour, newest first: a
 * time not out yet gives the newest image (the server takes the nearest).
 * @param now - Epoch ms.
 * @returns Four times, epoch ms.
 */
export function lightningTimes(now: number): number[] {
  const newest = Math.floor(now / STEP_MS) * STEP_MS - STEP_MS;
  return [0, 1, 2, 3].map((back) => newest - back * STEP_MS);
}

/**
 * The address of one image.
 * @param area - Centre and radius.
 * @param size - Width and height in pixels.
 * @param time - The time of the image, epoch ms.
 * @returns The URL.
 */
export function lightningUrl(
  area: LightningArea,
  size: number,
  time: number,
): string {
  const params = new URLSearchParams({
    service: 'WMS',
    version: '1.3.0',
    request: 'GetMap',
    layers: LIGHTNING_LAYER,
    styles: '',
    crs: 'CRS:84',
    bbox: lightningBox(area)
      .map((value) => value.toFixed(4))
      .join(','),
    width: String(size),
    height: String(size),
    format: 'image/png',
    transparent: 'true',
    time: new Date(time).toISOString().replace('.000Z', 'Z'),
  });
  return `${LIGHTNING_WMS}?${params.toString()}`;
}

/**
 * Pixels for an image: about 2 km each, as the grid of the satellite.
 * @param km - Radius.
 * @returns Width and height.
 */
export function lightningSize(km: number): number {
  return Math.min(300, Math.max(80, Math.ceil(km)));
}

function distanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)));
}

function bearingOf(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const rad = Math.PI / 180;
  const y = Math.sin((lon2 - lon1) * rad) * Math.cos(lat2 * rad);
  const x =
    Math.cos(lat1 * rad) * Math.sin(lat2 * rad) -
    Math.sin(lat1 * rad) * Math.cos(lat2 * rad) * Math.cos((lon2 - lon1) * rad);
  return (Math.atan2(y, x) / rad + 360) % 360;
}

/**
 * The flashes one image shows inside the circle. The colours go from pale
 * yellow (1 flash in 5 minutes) to dark red (20 and more): the green fades.
 * @param pixels - RGBA of the image, row after row from the north.
 * @param size - Width and height.
 * @param area - Centre and radius.
 * @returns The spots.
 */
export function lightningSpots(
  pixels: ArrayLike<number>,
  size: number,
  area: LightningArea,
): LightningSpots {
  const [west, south, east, north] = lightningBox(area);
  let nearestKm: number | null = null;
  let bearing: number | null = null;
  let cells = 0;
  let strong = false;
  for (let row = 0; row < size; row++) {
    const lat = north - ((row + 0.5) / size) * (north - south);
    for (let col = 0; col < size; col++) {
      const at = (row * size + col) * 4;
      if ((pixels[at + 3] ?? 0) < 40) continue;
      const lon = west + ((col + 0.5) / size) * (east - west);
      const km = distanceKm(area.lat, area.lon, lat, lon);
      if (km > area.km) continue;
      cells++;
      // 10 flashes and more: orange to red, the green under half.
      if ((pixels[at + 1] ?? 255) < 140) strong = true;
      if (nearestKm == null || km < nearestKm) {
        nearestKm = km;
        bearing = bearingOf(area.lat, area.lon, lat, lon);
      }
    }
  }
  return { nearestKm, bearing, cells, strong };
}

/**
 * The images of the last quarter of an hour put together: where the flashes
 * are now (the three newest), and whether they come nearer than 15 minutes
 * before (the newest against the oldest).
 * @param images - Spots of each image, newest first.
 * @param at - Time of the newest, epoch ms.
 * @param readAt - When read, epoch ms.
 * @returns The report.
 */
export function lightningReport(
  images: readonly LightningSpots[],
  at: number,
  readAt: number,
): LightningReport {
  const recent = images.slice(0, 3);
  let nearest: LightningSpots = {
    nearestKm: null,
    bearing: null,
    cells: 0,
    strong: false,
  };
  let cells = 0;
  let strong = false;
  for (const image of recent) {
    cells = Math.max(cells, image.cells);
    strong ||= image.strong;
    if (
      image.nearestKm != null &&
      (nearest.nearestKm == null || image.nearestKm < nearest.nearestKm)
    ) {
      nearest = image;
    }
  }
  const newest = images[0]?.nearestKm ?? images[1]?.nearestKm ?? null;
  const oldest = images.at(-1)?.nearestKm ?? null;
  const nearer =
    newest != null &&
    (oldest == null ? images.length > 1 : newest < oldest - 5);
  return {
    nearestKm: nearest.nearestKm,
    bearing: nearest.bearing,
    cells,
    strong,
    nearer,
    at,
    readAt,
  };
}

/** The last alert given: its distance and time. */
export interface LightningSignal {
  km: number;
  at: number;
}

/** An alert is said again after this time while the storm stays. */
const AGAIN_MS = 15 * 60_000;

/**
 * Whether to sound the alert: flashes inside the circle for the first time,
 * much nearer than at the last alert, or still there 15 minutes after it.
 * @param report - What the images show.
 * @param last - The last alert, or null.
 * @param now - Epoch ms.
 * @returns True to sound it.
 */
export function lightningDue(
  report: LightningReport,
  last: LightningSignal | null,
  now: number,
): boolean {
  if (report.nearestKm == null) return false;
  if (!last) return true;
  return report.nearestKm < last.km * 0.6 || now - last.at >= AGAIN_MS;
}

const POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];

/**
 * The words of a report, in French.
 * @param report - What the images show.
 * @param radiusNm - The radius of the alert.
 * @returns One line.
 */
export function lightningText(
  report: LightningReport,
  radiusNm: number,
): string {
  const hour = new Date(report.at).toISOString().slice(11, 16);
  if (report.nearestKm == null) {
    return `Aucun éclair à moins de ${radiusNm} NM (image satellite de ${hour} UTC).`;
  }
  const nm = Math.max(1, Math.round(report.nearestKm / KM_PER_NM));
  const point =
    report.bearing == null
      ? ''
      : `, direction ${POINTS[Math.round(report.bearing / 45) % 8]}`;
  const strong = report.strong ? ', orage actif' : '';
  const nearer = report.nearer ? ', se rapproche' : '';
  return `⚡ Éclairs à ${nm} NM${point}${strong}${nearer} (image satellite de ${hour} UTC).`;
}
