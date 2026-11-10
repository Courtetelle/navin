import { PORTS } from '../../features/onwater/ports.ts';
import {
  LEMAN_MARKS,
  SEA_ZONE1_MARKS,
  SOS_PLACES,
} from '../../features/safety/sosPlaceMarks.ts';
import {
  tilesWithCruise,
  tilesWithoutCruise,
} from '../../pages/more/moreTiles.ts';
import { state } from '../../state/index.ts';

/** A function of the app to open. */
export interface FunctionEntry {
  /** View opened. */
  key: string;
  title: string;
  /** More words it is found by. */
  sub: string;
}

/** A place to show on the map. */
export interface PlaceEntry {
  name: string;
  lat: number;
  lon: number;
  /** South, north, west, east, for a country or a region. */
  bounds?: [number, number, number, number];
}

const MAX_RESULTS = 8;
const OTHER_FUNCTIONS: readonly FunctionEntry[] = [
  { key: 'tracker', title: '🧭 Carte et suivi', sub: 'navigation trace gps' },
  { key: 'sos', title: '🆘 SOS', sub: 'détresse secours urgence' },
  { key: 'mob', title: '🛟 Homme à la mer', sub: 'mob secours' },
  { key: 'vhf', title: '📻 Appels VHF', sub: 'radio canal' },
  {
    key: 'cartes',
    title: '🗺 Mes cartes',
    sub: 'zones hors ligne offline supprimer',
  },
  {
    key: 'settings',
    title: '⚙️ Réglages',
    sub: 'alarme profondeur sonde mode nuit sauvegarde',
  },
  { key: 'marks', title: '◆ Mes repères', sub: 'points marques' },
  {
    key: 'meteo',
    title: '🌬 Conditions météo, live',
    sub: 'vent stations mesures rafales',
  },
  { key: 'beaufort', title: '💨 Échelle de Beaufort', sub: 'vent' },
  { key: 'douglas', title: '🌊 Échelle de Douglas', sub: 'mer vagues' },
  { key: 'alpha', title: '🔤 Alphabet phonétique', sub: 'épeler radio' },
];

/**
 * A text without accents or capitals, as searches compare it.
 * @param text - The text.
 * @returns The plain text.
 */
export function plain(text: string): string {
  return text
    .normalize('NFD')
    .replaceAll(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

/**
 * The functions of the app.
 * @returns Each function once.
 */
export function functionEntries(): FunctionEntry[] {
  const tiles = state.data.cruise.value
    ? tilesWithCruise()
    : tilesWithoutCruise();
  const known = new Map<string, FunctionEntry>();
  for (const entry of [...OTHER_FUNCTIONS, ...tiles]) {
    if (!known.has(entry.key)) known.set(entry.key, entry);
  }
  return [...known.values()];
}

/**
 * The places known without network.
 * @returns Each place once.
 */
export function placeEntries(): PlaceEntry[] {
  const known = new Map<string, PlaceEntry>();
  const add = (name: string, lat: number, lon: number) => {
    const key = plain(name);
    if (!known.has(key)) known.set(key, { name, lat, lon });
  };
  for (const mark of state.data.marks.value) add(mark.name, mark.lat, mark.lon);
  for (const marks of [LEMAN_MARKS, SEA_ZONE1_MARKS]) {
    for (const [name, [lat, lon]] of Object.entries(marks)) add(name, lat, lon);
  }
  for (const [name, lat, lon] of PORTS) add(name, lat, lon);
  for (const [name, lat, lon] of SOS_PLACES) add(name, lat, lon);
  return [...known.values()];
}

/**
 * The entries matching a search: all its words must be found, names starting
 * with it first.
 * @param query - The search.
 * @param entries - Where to look.
 * @param textOf - The text of an entry.
 * @returns The first matches.
 */
export function matches<T>(
  query: string,
  entries: readonly T[],
  textOf: (entry: T) => string,
): T[] {
  const words = plain(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const scored: Array<[number, T]> = [];
  for (const entry of entries) {
    const text = plain(textOf(entry));
    if (words.every((word) => text.includes(word))) {
      const start = text.replace(/^[^\p{L}\p{N}]+/u, '');
      scored.push([start.startsWith(words[0] as string) ? 0 : 1, entry]);
    }
  }
  return scored
    .toSorted((first, second) => first[0] - second[0])
    .slice(0, MAX_RESULTS)
    .map(([, entry]) => entry);
}

/** One answer of the geographic search. */
interface NominatimPlace {
  // eslint-disable-next-line @typescript-eslint/naming-convention -- name in the API
  display_name?: string;
  lat?: string;
  lon?: string;
  boundingbox?: [string, string, string, string];
}

/**
 * Places found on the network (OpenStreetMap Nominatim).
 * @param query - The search.
 * @param signal - Cancels the request.
 * @returns The places, empty when the network does not answer.
 */
export async function onlinePlaces(
  query: string,
  signal: AbortSignal,
): Promise<PlaceEntry[]> {
  try {
    const reply = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&accept-language=fr&q=${encodeURIComponent(query)}`,
      { signal },
    );
    if (!reply.ok) return [];
    const found = (await reply.json()) as NominatimPlace[];
    const places: PlaceEntry[] = [];
    for (const place of found) {
      const lat = Number(place.lat);
      const lon = Number(place.lon);
      if (place.display_name && Number.isFinite(lat) && Number.isFinite(lon)) {
        const name = place.display_name.split(',').slice(0, 3).join(',');
        const box = place.boundingbox?.map(Number);
        places.push(
          box?.length === 4 && box.every(Number.isFinite)
            ? {
                name,
                lat,
                lon,
                bounds: box as [number, number, number, number],
              }
            : { name, lat, lon },
        );
      }
    }
    return places;
  } catch {
    return [];
  }
}
