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
export const LIGHTNING_RADII_NM = [15, 30, 45, 60] as const;
/** The radius by default, in nautical miles. */
export const LIGHTNING_RADIUS_NM = 30;
/** Kilometres in a nautical mile. */
const KM_PER_NM = 1.852;
/** Kilometres in a degree of latitude. */
const KM_PER_DEG = 111.32;
/** The compass points, in French. */
const POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];

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
  /**
   * The middle of the storm nearest: the flashes within 20 km of the
   * nearest one (to follow it from image to image).
   */
  core?: { lat: number; lon: number } | null;
  /** The time of the image, epoch ms. */
  t?: number;
}

/** How the nearest storm moves, from the images of the last quarter hour. */
export interface LightningMotion {
  /** Where it goes, degrees from north; null when it barely moves. */
  towardDeg: number | null;
  /** Its speed over the water, knots; null when not known. */
  speedKn: number | null;
  /** How fast it comes nearer (negative: it goes away), knots. */
  closingKn: number;
  /** Its distance at the time of the newest image, as the line fits, km. */
  kmAt: number;
}

/** What the last images show around the boat. */
export interface LightningReport extends LightningSpots {
  /** The flashes come nearer than 15 minutes before. */
  nearer: boolean;
  /** The time of the newest image read, epoch ms. */
  at: number;
  /** When it was read, epoch ms. */
  readAt: number;
  /** How the nearest storm moves, null when not known. */
  motion?: LightningMotion | null;
  /** Where NavIn looked from: the boat or the zone. */
  place?: { lat: number; lon: number };
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

/**
 * The point at a distance and a bearing from a place.
 * @param lat - Latitude of the place.
 * @param lon - Its longitude.
 * @param bearing - Degrees from north.
 * @param km - Distance.
 * @returns The point.
 */
export function pointAt(
  lat: number,
  lon: number,
  bearing: number,
  km: number,
): { lat: number; lon: number } {
  const rad = Math.PI / 180;
  const angle = km / 6371;
  const phi = lat * rad;
  const theta = bearing * rad;
  const lat2 = Math.asin(
    Math.sin(phi) * Math.cos(angle) +
      Math.cos(phi) * Math.sin(angle) * Math.cos(theta),
  );
  const lon2 =
    lon * rad +
    Math.atan2(
      Math.sin(theta) * Math.sin(angle) * Math.cos(phi),
      Math.cos(angle) - Math.sin(phi) * Math.sin(lat2),
    );
  return { lat: lat2 / rad, lon: ((lon2 / rad + 540) % 360) - 180 };
}

/**
 * The map that shows the boat (or the zone) and the nearest flashes: the
 * middle between them, wide enough for both.
 * @param place - The boat or the zone.
 * @param storm - The nearest flashes.
 * @returns Middle and half size, km.
 */
export function stormView(
  place: { lat: number; lon: number },
  storm: { lat: number; lon: number },
): { lat: number; lon: number; km: number } {
  const km = distanceKm(place.lat, place.lon, storm.lat, storm.lon);
  return {
    lat: (place.lat + storm.lat) / 2,
    lon: (place.lon + storm.lon) / 2,
    km: Math.max(15, km / 2 + 15),
  };
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
 * Whether a pixel is the black the server lays at the edge of what the
 * satellite sees (no data), not a flash: the flashes go from pale yellow to
 * dark red, never black.
 * @param pixels - RGBA, row after row.
 * @param at - Index of the pixel's red.
 * @returns It is the black of no data.
 */
export function lightningNoData(
  pixels: ArrayLike<number>,
  at: number,
): boolean {
  return (
    (pixels[at] ?? 0) < 60 &&
    (pixels[at + 1] ?? 0) < 60 &&
    (pixels[at + 2] ?? 0) < 60
  );
}

/**
 * Make the black of no data clear in an image, the flashes left as they are.
 * @param pixels - RGBA, row after row, changed in place.
 * @returns How many pixels were cleared.
 */
export function lightningClearNoData(pixels: Uint8ClampedArray): number {
  let cleared = 0;
  for (let at = 0; at < pixels.length; at += 4) {
    if ((pixels[at + 3] ?? 0) > 0 && lightningNoData(pixels, at)) {
      pixels[at + 3] = 0;
      cleared++;
    }
  }
  return cleared;
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
  const lit: Array<{ lat: number; lon: number; km: number }> = [];
  for (let row = 0; row < size; row++) {
    const lat = north - ((row + 0.5) / size) * (north - south);
    for (let col = 0; col < size; col++) {
      const at = (row * size + col) * 4;
      if ((pixels[at + 3] ?? 0) < 40 || lightningNoData(pixels, at)) continue;
      const lon = west + ((col + 0.5) / size) * (east - west);
      const km = distanceKm(area.lat, area.lon, lat, lon);
      if (km > area.km) continue;
      cells++;
      lit.push({ lat, lon, km });
      // 10 flashes and more: orange to red, the green under half.
      if ((pixels[at + 1] ?? 255) < 140) strong = true;
      if (nearestKm == null || km < nearestKm) {
        nearestKm = km;
        bearing = bearingOf(area.lat, area.lon, lat, lon);
      }
    }
  }
  return { nearestKm, bearing, cells, strong, core: coreOf(lit) };
}

/** The flashes this near the nearest one are of the same storm, km. */
const CORE_KM = 20;

/**
 * The middle of the storm nearest: the flashes close to the nearest one.
 * @param lit - The flashes inside the circle.
 * @returns Its middle, or null without flashes.
 */
function coreOf(
  lit: ReadonlyArray<{ lat: number; lon: number; km: number }>,
): { lat: number; lon: number } | null {
  let nearest: (typeof lit)[number] | null = null;
  for (const one of lit) if (!nearest || one.km < nearest.km) nearest = one;
  if (!nearest) return null;
  let lat = 0;
  let lon = 0;
  let count = 0;
  for (const one of lit) {
    if (distanceKm(nearest.lat, nearest.lon, one.lat, one.lon) > CORE_KM) {
      continue;
    }
    lat += one.lat;
    lon += one.lon;
    count++;
  }
  return { lat: lat / count, lon: lon / count };
}

/** A storm faster than this is two storms seen one after the other, knots. */
const MOST_KN = 60;
/** Slower than this, a storm stays where it is, knots. */
const STILL_KN = 3;
/** The motion is known over this time at least. */
const LEAST_SPAN_MS = 9 * 60_000;

/**
 * The line that fits values in time (least squares).
 * @param points - Time and value.
 * @returns Value at the time of the first point, and slope per ms.
 */
function fitLine(points: ReadonlyArray<{ t: number; v: number }>): {
  at: number;
  slope: number;
} {
  const t0 = points[0]?.t ?? 0;
  const n = points.length;
  let st = 0;
  let sv = 0;
  for (const { t, v } of points) {
    st += t - t0;
    sv += v;
  }
  const mt = st / n;
  const mv = sv / n;
  let num = 0;
  let den = 0;
  for (const { t, v } of points) {
    num += (t - t0 - mt) * (v - mv);
    den += (t - t0 - mt) ** 2;
  }
  const slope = den > 0 ? num / den : 0;
  return { at: mv - slope * mt, slope };
}

/**
 * How the nearest storm moves: its distance in time (how fast it comes
 * nearer) and its middle in time (where it goes, how fast).
 * @param images - The images, each with its time.
 * @param area - Where NavIn looked from.
 * @returns The motion, or null with too few images.
 */
export function lightningMotion(
  images: readonly LightningSpots[],
  area: { lat: number; lon: number },
): LightningMotion | null {
  const seen = images
    .filter((one) => one.nearestKm != null && one.t != null)
    .toSorted((a, b) => (b.t ?? 0) - (a.t ?? 0));
  const newest = seen[0];
  const oldest = seen.at(-1);
  if (!newest?.t || !oldest?.t || newest.t - oldest.t < LEAST_SPAN_MS) {
    return null;
  }
  const knPerKmMs = 3_600_000 / KM_PER_NM;
  const fit = fitLine(
    seen.map((one) => ({ t: one.t ?? 0, v: one.nearestKm ?? 0 })),
  );
  const closingKn = -fit.slope * knPerKmMs;
  if (Math.abs(closingKn) > MOST_KN) return null;
  // The middle of the storm, in km east and north of the place.
  const cores = seen.filter((one) => one.core);
  let towardDeg: number | null = null;
  let speedKn: number | null = null;
  if (cores.length >= 2) {
    const cos = Math.cos((area.lat * Math.PI) / 180);
    const east = fitLine(
      cores.map((one) => ({
        t: one.t ?? 0,
        v: ((one.core?.lon ?? 0) - area.lon) * KM_PER_DEG * cos,
      })),
    );
    const north = fitLine(
      cores.map((one) => ({
        t: one.t ?? 0,
        v: ((one.core?.lat ?? 0) - area.lat) * KM_PER_DEG,
      })),
    );
    const speed = Math.hypot(east.slope, north.slope) * knPerKmMs;
    if (speed <= MOST_KN) {
      speedKn = speed;
      towardDeg =
        speed < STILL_KN
          ? null
          : ((Math.atan2(east.slope, north.slope) * 180) / Math.PI + 360) % 360;
    }
  }
  return {
    towardDeg,
    speedKn,
    closingKn,
    kmAt: Math.max(0, fit.at),
  };
}

/** When the storm is on the boat, as NavIn guesses it. */
export interface LightningEta {
  /** Its distance now, the delay of the image counted, km. */
  kmNow: number;
  /** The delay of the image: from its time to now, minutes. */
  delayMin: number;
  /** When it should be on the boat, epoch ms; null when it does not come. */
  etaAt: number | null;
  /** It is on the boat now, as far as NavIn can tell. */
  onUs: boolean;
}

/** Nearer than this, the storm is on the boat, km. */
const ON_US_KM = 3;
/** Coming nearer slower than this, it does not come, knots. */
const COMING_KN = 2;

/**
 * Where the storm is now and when it is on the boat: the images come late
 * (about 10 minutes), so the distance read is moved on by the time gone
 * since, at the speed it comes nearer.
 * @param report - What the images show.
 * @param now - Epoch ms.
 * @returns The guess, or null when its motion is not known.
 */
export function lightningEta(
  report: LightningReport,
  now: number,
): LightningEta | null {
  const { motion, at } = report;
  if (!motion) return null;
  const delayMs = Math.max(0, now - at);
  const closingKmMs = (motion.closingKn * KM_PER_NM) / 3_600_000;
  const kmNow = Math.max(0, motion.kmAt - closingKmMs * delayMs);
  const onUs = kmNow <= ON_US_KM;
  const etaAt =
    onUs || motion.closingKn < COMING_KN
      ? null
      : now + (kmNow - ON_US_KM) / closingKmMs;
  return { kmNow, delayMin: Math.round(delayMs / 60_000), etaAt, onUs };
}

/** The time of arrival is said when the storm is this near, NM… */
const ETA_NEAR_NM = 20;
/** …or due within this time. */
const ETA_SOON_MS = 90 * 60_000;

/**
 * Whether the storm comes very near: its time of arrival worth saying.
 * @param eta - The guess.
 * @param now - Epoch ms.
 * @returns True to say it.
 */
export function lightningEtaShown(eta: LightningEta, now: number): boolean {
  if (eta.onUs) return true;
  if (eta.etaAt == null) return false;
  return eta.kmNow <= nmToKm(ETA_NEAR_NM) || eta.etaAt - now <= ETA_SOON_MS;
}

/**
 * The local time as 14h35.
 * @param time - Epoch ms.
 * @returns The text.
 */
export function hourText(time: number): string {
  const date = new Date(time);
  return `${date.getHours()}h${String(date.getMinutes()).padStart(2, '0')}`;
}

/**
 * A duration as 25 min or 1 h 25.
 * @param ms - The duration.
 * @returns The text.
 */
export function durationText(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const rest = minutes % 60;
  return `${Math.floor(minutes / 60)} h${rest > 0 ? ` ${String(rest).padStart(2, '0')}` : ''}`;
}

/**
 * A compass point in French.
 * @param degrees - From north.
 * @returns N, NE, E, SE, S, SO, O or NO.
 */
export function pointOf(degrees: number): string {
  return POINTS[Math.round(degrees / 45) % 8] ?? 'N';
}

/**
 * Nautical miles, rounded, at least 1.
 * @param km - Kilometres.
 * @returns The NM.
 */
export function nmOf(km: number): number {
  return Math.max(1, Math.round(km / KM_PER_NM));
}

/**
 * The lines of how the nearest storm moves and when it is on the boat.
 * @param report - What the images show.
 * @param now - Epoch ms.
 * @param etaAlways - The time until it is on the boat said however far.
 * @returns The lines, none when its motion is not known.
 */
export function lightningMotionLines(
  report: LightningReport,
  now: number,
  etaAlways = false,
): string[] {
  const { motion, nearestKm } = report;
  if (nearestKm == null || !motion) return [];
  const lines: string[] = [];
  if (motion.speedKn != null) {
    lines.push(
      motion.towardDeg == null
        ? 'L’orage reste sur place.'
        : `L’orage se déplace vers le ${pointOf(motion.towardDeg)} à ${Math.round(motion.speedKn)} nd.`,
    );
  }
  const closing = Math.round(Math.abs(motion.closingKn));
  lines.push(
    motion.closingKn >= COMING_KN
      ? `Vitesse de rapprochement : ${closing} nd.`
      : motion.closingKn <= -COMING_KN
        ? `Il s’éloigne de vous à ${closing} nd.`
        : 'Il ne se rapproche pas de vous.',
  );
  const eta = lightningEta(report, now);
  if (eta) {
    lines.push(
      `Estimé maintenant à ${nmOf(eta.kmNow)} NM (retard de l’image de ${eta.delayMin} min compté).`,
    );
    if (eta.onUs) {
      lines.push('⚠️ Probablement sur vous maintenant.');
    } else if (
      eta.etaAt != null &&
      (etaAlways || lightningEtaShown(eta, now))
    ) {
      const warn = lightningEtaShown(eta, now) ? '⚠️ ' : '';
      lines.push(
        `${warn}Sur vous vers ${hourText(eta.etaAt)} (dans ${durationText(eta.etaAt - now)} environ).`,
      );
    }
  }
  return lines;
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
  read: readonly LightningSpots[],
  readFirst: number,
  readAt: number,
  place?: { lat: number; lon: number },
): LightningReport {
  let images = read;
  let at = read[0]?.t ?? readFirst;
  // The newest time not out yet gives the image before: the same twice.
  const [first, second] = read;
  if (
    first &&
    second &&
    first.cells > 0 &&
    first.cells === second.cells &&
    first.nearestKm === second.nearestKm
  ) {
    images = read.slice(1);
    at = second.t ?? at - STEP_MS;
  }
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
    motion: place ? lightningMotion(images, place) : null,
    ...(place ? { place } : {}),
  };
}

/** The last alert given: its distance and time. */
export interface LightningSignal {
  km: number;
  at: number;
  /** The storm was already under half the distance of the alert. */
  half?: boolean;
}

/**
 * Why the alert sounds: the storm enters, comes under half the distance,
 * much nearer, or is still there.
 */
export type LightningReason = 'first' | 'half' | 'nearer' | 'again';

/** An alert is said again after this time while the storm stays. */
const AGAIN_MS = 15 * 60_000;

/**
 * Whether to sound the alert: flashes inside the circle for the first time,
 * under half the distance of the alert (a second alert), much nearer than at
 * the last alert, or still there 15 minutes after it.
 * @param report - What the images show.
 * @param last - The last alert, or null.
 * @param now - Epoch ms.
 * @param radiusKm - The distance of the alert.
 * @returns Why it sounds, or null.
 */
export function lightningDue(
  report: LightningReport,
  last: LightningSignal | null,
  now: number,
  radiusKm: number,
): LightningReason | null {
  if (report.nearestKm == null) return null;
  if (!last) return 'first';
  if (!last.half && report.nearestKm < radiusKm / 2) return 'half';
  if (report.nearestKm < last.km * 0.6) return 'nearer';
  return now - last.at >= AGAIN_MS ? 'again' : null;
}

/** The end of the alert: no flash inside the circle for this long. */
export const CLEAR_MS = 30 * 60_000;

/**
 * Whether the alert is over: an alert was given, and no flash inside the
 * circle on the images of the last 30 minutes.
 * @param report - What the images show.
 * @param last - The last alert, or null.
 * @param lastFlashAt - Time of the last image with flashes, epoch ms.
 * @returns True to say it is over.
 */
export function lightningClear(
  report: LightningReport,
  last: LightningSignal | null,
  lastFlashAt: number,
): boolean {
  return (
    last != null &&
    report.nearestKm == null &&
    report.at - lastFlashAt >= CLEAR_MS
  );
}

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
    report.bearing == null ? '' : `, direction ${pointOf(report.bearing)}`;
  const strong = report.strong ? ', orage actif' : '';
  const nearer = report.nearer ? ', se rapproche' : '';
  return `⚡ Éclairs à ${nm} NM${point}${strong}${nearer} (image satellite de ${hour} UTC).`;
}
