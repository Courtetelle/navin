/*
 * The warnings of MeteoSwiss for the lakes: the same that light the warning
 * lights on the shores (40 flashes a minute for a strong wind warning, 90
 * for a storm warning). MeteoSwiss shows them on its map of dangers; NavIn
 * reads the same file, through the relay (MeteoSwiss does not let a page
 * of another site read it). Not a documented open-data product: it may
 * change without notice.
 */

/** Where MeteoSwiss puts its products. */
const OUTPUT = 'https://www.meteoschweiz.admin.ch/product/output';
/** The product of the map of dangers. */
const PRODUCT = 'versioned/danger/v3';

/** One warning of a lake. */
export interface LakeWarning {
  /** The lake, as MeteoSwiss names it (« Grand Lac », « Lac de Bienne »). */
  name: string;
  /** 2 strong wind (25 to 33 kt), 3 storm (34 kt and more). */
  level: number;
  /** From, epoch ms. */
  onset: number;
  /** Until, epoch ms. */
  expires: number;
  /** Only an outlook, the lights stay off. */
  outlook: boolean;
  /** What MeteoSwiss says, in French. */
  text: string;
}

/** A lake and the middle of it, for its light on the map. */
interface LakeSpot {
  /** Words of its name, lower case without accents. */
  match: string;
  lat: number;
  lon: number;
}

/** The lakes watched by MeteoSwiss and where their light is drawn. */
const LAKES: readonly LakeSpot[] = [
  { match: 'petit lac', lat: 46.33, lon: 6.22 },
  { match: 'grand lac', lat: 46.44, lon: 6.55 },
  { match: 'haut lac', lat: 46.43, lon: 6.83 },
  { match: 'neuchatel', lat: 46.9, lon: 6.85 },
  { match: 'bienne', lat: 47.09, lon: 7.17 },
  { match: 'morat', lat: 46.93, lon: 7.08 },
  { match: 'joux', lat: 46.63, lon: 6.28 },
  { match: 'thoune', lat: 46.69, lon: 7.71 },
  { match: 'brienz', lat: 46.73, lon: 7.97 },
  { match: 'quatre-cantons', lat: 47, lon: 8.45 },
  { match: 'zoug', lat: 47.13, lon: 8.49 },
  { match: 'zurich', lat: 47.25, lon: 8.65 },
  { match: 'walenstadt', lat: 47.12, lon: 9.2 },
  { match: 'untersee', lat: 47.68, lon: 9.05 },
  { match: 'constance', lat: 47.6, lon: 9.4 },
  { match: 'sempach', lat: 47.14, lon: 8.15 },
  { match: 'hallwil', lat: 47.28, lon: 8.22 },
  { match: 'baldegg', lat: 47.2, lon: 8.26 },
  { match: 'sihl', lat: 47.14, lon: 8.78 },
  { match: 'ageri', lat: 47.12, lon: 8.63 },
  { match: 'greifen', lat: 47.35, lon: 8.68 },
  { match: 'pfaffikon', lat: 47.35, lon: 8.78 },
  { match: 'majeur', lat: 46.1, lon: 8.72 },
  { match: 'lugano', lat: 45.98, lon: 8.97 },
];

function plain(text: string): string {
  return text
    .normalize('NFD')
    .replaceAll(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/**
 * Where the light of a lake is drawn.
 * @param name - The lake, as MeteoSwiss names it.
 * @returns Its middle, or null when unknown.
 */
export function lakeSpot(name: string): { lat: number; lon: number } | null {
  const words = plain(name);
  const spot = LAKES.find((lake) => words.includes(lake.match));
  return spot ? { lat: spot.lat, lon: spot.lon } : null;
}

/**
 * The address of the newest map of dangers, from the versions file.
 * @param versions - `versions.json` of MeteoSwiss.
 * @returns The URL of its French file, or null.
 */
export function dangersUrl(versions: unknown): string | null {
  const version =
    versions && typeof versions === 'object'
      ? (versions as Record<string, unknown>)[PRODUCT]
      : null;
  if (typeof version !== 'string' || !/^\d{8}_\d{4}$/u.test(version)) {
    return null;
  }
  return `${OUTPUT}/${PRODUCT}/version__${version}/fr/dangers.json`;
}

/** The address of the versions file of MeteoSwiss. */
export const VERSIONS_URL = `${OUTPUT}/versions.json`;

function stripHtml(text: string): string {
  return text
    .replaceAll(/<br\s*\/?>/giu, ' ')
    .replaceAll(/<[^>]+>/gu, '')
    .replaceAll(/\s+/gu, ' ')
    .trim();
}

/**
 * The warnings of the lakes in the map of dangers.
 * @param dangers - `dangers.json`.
 * @returns The warnings.
 */
export function lakeWarningsOf(dangers: unknown): LakeWarning[] {
  const lakes =
    dangers && typeof dangers === 'object'
      ? (dangers as { lakes?: unknown }).lakes
      : null;
  if (!Array.isArray(lakes)) return [];
  const warnings: LakeWarning[] = [];
  for (const raw of lakes as Array<Record<string, unknown>>) {
    const {
      name,
      warnlevel,
      onset,
      expires,
      description,
      is_outlook: isOutlook,
    } = raw;
    if (typeof name !== 'string' || typeof warnlevel !== 'number') continue;
    if (typeof onset !== 'number' || typeof expires !== 'number') continue;
    warnings.push({
      name,
      level: warnlevel,
      onset: onset * 1000,
      expires: expires * 1000,
      outlook: isOutlook === true,
      text: typeof description === 'string' ? stripHtml(description) : '',
    });
  }
  return warnings;
}

/**
 * The warnings in force now: the lights are on.
 * @param warnings - All of them.
 * @param now - Epoch ms.
 * @returns Those lit, the strongest first.
 */
export function litWarnings(
  warnings: readonly LakeWarning[],
  now: number,
): LakeWarning[] {
  return warnings
    .filter(
      (warning) =>
        !warning.outlook &&
        warning.level >= 2 &&
        warning.onset <= now &&
        now < warning.expires,
    )
    .toSorted((a, b) => b.level - a.level);
}

/**
 * How the lights flash for a level.
 * @param level - 2 strong wind, 3 storm.
 * @returns Its words and flashes per minute.
 */
export function lightOf(level: number): { words: string; perMinute: number } {
  return level >= 3
    ? { words: 'TEMPÊTE', perMinute: 90 }
    : { words: 'VENT FORT', perMinute: 40 };
}

/**
 * A time of a warning: the hour today, else the day and the hour.
 * @param t - Epoch ms.
 * @param now - Epoch ms.
 * @returns e.g. `14:00`, `demain 14:00`, `mer. 14:00`.
 */
export function whenText(t: number, now: number): string {
  const hour = new Date(t).toLocaleTimeString('fr-CH', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const day = (time: number) => new Date(time).toDateString();
  if (day(t) === day(now)) return hour;
  if (day(t) === day(now + 86_400_000)) return `demain ${hour}`;
  if (day(t) === day(now - 86_400_000)) return `hier ${hour}`;
  const weekday = new Date(t).toLocaleDateString('fr-CH', { weekday: 'short' });
  return `${weekday} ${hour}`;
}

/**
 * A warning in one line, in French.
 * @param warning - The warning.
 * @returns The line.
 */
export function lakeWarningText(warning: LakeWarning): string {
  const { words, perMinute } = lightOf(warning.level);
  const until = whenText(warning.expires, Date.now());
  return `${warning.name} : avis de ${words.toLowerCase()} (feux ${perMinute} éclats/min) jusqu’à ${until}.`;
}

/**
 * The key of a warning: a new one (another lake, another start, a higher
 * level) sounds the alert again.
 * @param warning - The warning.
 * @returns Its key.
 */
export function warningKey(warning: LakeWarning): string {
  return `${warning.name}|${warning.onset}|${warning.level}`;
}

function distanceKm(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** A lake whose middle is this near the boat is the boat's lake. */
const NEAR_KM = 25;

/**
 * The lit warnings of the lakes near a place, the nearest first.
 * @param warnings - The lit warnings.
 * @param place - The boat or the zone.
 * @returns Those within reach.
 */
export function warningsNear(
  warnings: readonly LakeWarning[],
  place: { lat: number; lon: number },
): LakeWarning[] {
  const near: Array<{ warning: LakeWarning; km: number }> = [];
  for (const warning of warnings) {
    const spot = lakeSpot(warning.name);
    if (!spot) continue;
    const km = distanceKm(place, spot);
    if (km <= NEAR_KM) near.push({ warning, km });
  }
  return near.toSorted((a, b) => a.km - b.km).map(({ warning }) => warning);
}

/** What each light means, as on the shore. */
export const LIGHT_MEANINGS = [
  {
    level: 2,
    perMinute: 40,
    title: 'Avis de vent fort',
    text: 'rafales de 25 à 33 nœuds (46 à 60 km/h) attendues sur le lac. Prudence : petites embarcations, rejoindre la rive ; les autres, se préparer à rentrer.',
  },
  {
    level: 3,
    perMinute: 90,
    title: 'Avis de tempête',
    text: 'rafales de 34 nœuds et plus (plus de 60 km/h) attendues. Danger : gagner un abri ou la rive sans attendre.',
  },
] as const;
