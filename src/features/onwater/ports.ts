import { pad } from '../../lib/format.ts';
import { distKm } from '../../lib/geo.ts';
import { state } from '../../state/index.ts';

/** Sea areas of the outing names: code, label (legacy `ZONES`). */
export const ZONES: ReadonlyArray<readonly [string, string]> = [
  ['M', 'Méditerranée'],
  ['A', 'Atlantique, Manche'],
  ['N', 'Mer du Nord'],
  ['B', 'Baltique'],
  ['X', 'Autre'],
];

// Known ports, to name the place of departure without network.
export const PORTS: ReadonlyArray<readonly [string, number, number]> = [
  ['Genève', 46.208, 6.153],
  ['Genève Port-Noir', 46.213, 6.17],
  ['Versoix', 46.283, 6.168],
  ['Coppet', 46.316, 6.193],
  ['Nyon', 46.383, 6.241],
  ['Rolle', 46.459, 6.338],
  ['Saint-Prex', 46.481, 6.457],
  ['Morges', 46.508, 6.498],
  ['Saint-Sulpice', 46.51, 6.556],
  ['Lausanne-Vidy', 46.516, 6.597],
  ['Lausanne-Ouchy', 46.505, 6.627],
  ['Pully', 46.507, 6.66],
  ['Lutry', 46.502, 6.685],
  ['Cully', 46.488, 6.73],
  ['Vevey', 46.461, 6.843],
  ['La Tour-de-Peilz', 46.455, 6.857],
  ['Montreux', 46.433, 6.909],
  ['Villeneuve', 46.396, 6.927],
  ['Le Bouveret', 46.387, 6.857],
  ['Saint-Gingolph', 46.393, 6.806],
  ['Évian', 46.401, 6.59],
  ['Thonon', 46.379, 6.483],
  ['Sciez', 46.343, 6.383],
  ['Yvoire', 46.371, 6.326],
  ['Nernier', 46.364, 6.301],
  ['Hermance', 46.302, 6.244],
  ['Anières', 46.277, 6.222],
  ['Corsier-Port', 46.263, 6.214],
  ['La Belotte', 46.231, 6.185],
  ['St-Malo', 48.646, -2.017],
  ['Dinard', 48.635, -2.05],
  ['Granville', 48.833, -1.6],
  ['Cherbourg', 49.645, -1.62],
  ['Le Havre', 49.485, 0.105],
  ['Brest', 48.38, -4.49],
  ['Camaret', 48.278, -4.595],
  ['Concarneau', 47.871, -3.917],
  ['Lorient', 47.735, -3.36],
  ['La Trinité-sur-Mer', 47.585, -3.025],
  ['Port-Crouesty', 47.543, -2.895],
  ['Pornic', 47.113, -2.103],
  ['Les Sables-d’Olonne', 46.497, -1.792],
  ['La Rochelle', 46.146, -1.168],
  ['Arcachon', 44.66, -1.165],
  ['Port-Vendres', 42.519, 3.11],
  ['Port-Camargue', 43.519, 4.13],
  ['Marseille', 43.293, 5.365],
  ['La Ciotat', 43.174, 5.607],
  ['Bandol', 43.135, 5.752],
  ['Toulon', 43.119, 5.931],
  ['Hyères', 43.08, 6.158],
  ['Porquerolles', 43, 6.203],
  ['Le Lavandou', 43.137, 6.37],
  ['Saint-Tropez', 43.272, 6.637],
  ['Cannes', 43.548, 7.017],
  ['Antibes', 43.585, 7.128],
  ['Nice', 43.696, 7.285],
  ['Ajaccio', 41.919, 8.74],
  ['Bonifacio', 41.388, 9.16],
  ['Calvi', 42.566, 8.758],
  ['Palma', 39.566, 2.634],
  ['Split', 43.503, 16.44],
  ['Trogir', 43.514, 16.25],
  ['Kaštela', 43.548, 16.38],
  ['Šibenik', 43.733, 15.892],
  ['Zadar', 44.118, 15.23],
  ['Pula', 44.871, 13.84],
  ['Dubrovnik', 42.668, 18.083],
  ['Lefkada', 38.833, 20.71],
  ['Athènes Alimos', 37.91, 23.705],
  ['Kos', 36.893, 27.29],
  ['Kiel', 54.323, 10.14],
  ['Rostock Warnemünde', 54.18, 12.085],
  ['Copenhague', 55.69, 12.6],
  ['Gdańsk', 54.352, 18.66],
  ['Visby', 57.64, 18.285],
  ['Stockholm', 59.325, 18.08],
  ['Mariehamn', 60.097, 19.935],
  ['Helsinki', 60.16, 24.95],
  ['Tallinn', 59.445, 24.765],
  ['Göteborg', 57.7, 11.95],
];

const DOW = ['DI', 'LU', 'MA', 'ME', 'JE', 'VE', 'SA'];

/**
 * Closest known port (legacy `nearestPort`).
 * @param lat - Latitude.
 * @param lon - Longitude.
 * @param maxKm - Search radius in km.
 * @returns Its name, or null.
 */
export function nearestPort(
  lat: number,
  lon: number,
  maxKm: number,
): string | null {
  let best: string | null = null;
  let bestDistance = maxKm;
  for (const [name, portLat, portLon] of PORTS) {
    const distance = distKm(lat, lon, portLat, portLon);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = name;
    }
  }
  return best;
}

/**
 * Probable sea area of a position, to be corrected if needed (legacy `guessZone`).
 * @param lat - Latitude.
 * @param lon - Longitude.
 * @returns Area code of {@link ZONES}.
 */
export function guessZone(lat: number, lon: number): string {
  if (lat > 53.5 && lat < 66 && lon >= 9.5 && lon < 31) return 'B';
  if (lat > 51 && lat < 61 && lon > -2 && lon < 9) return 'N';
  if (lon < -1) return 'A';
  if (lat > 30 && lat < 46 && lon > -5.5 && lon < 37) return 'M';
  return 'X';
}

/**
 * Departure place: the built-in list first; with network, the municipality
 * from OpenStreetMap otherwise (legacy `findStartPlace`).
 * @param mode - `'mer'`, `'lacj'` or `'lacc'`.
 * @param done - Receives the place (or null) and the probable sea area.
 */
export function findStartPlace(
  mode: string,
  done: (place: string | null, zone?: string) => void,
): void {
  if (!('geolocation' in navigator)) {
    done(null);
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (fix) => {
      const { latitude: lat, longitude: lon } = fix.coords;
      const known = nearestPort(lat, lon, mode === 'mer' ? 10 : 5);
      const named =
        known || !navigator.onLine ? null : reverseGeocode(lat, lon);
      void Promise.resolve(named).then((place) =>
        done(known ?? place, guessZone(lat, lon)),
      );
    },
    () => done(null),
    { enableHighAccuracy: true, timeout: 10_000, maximumAge: 120_000 },
  );
}

/**
 * Automatic name of an outing:
 * `[AA][number of the year][water][c if cruise]_[boat] [port] [day] [d/m]`,
 * e.g. `2607L_Savannah Morges JE 9/7` or `2609Ac_Inspiration St-Malo SA 11/7`.
 * The number follows the highest one still stored for the year, so deleting the
 * last outings frees their numbers (legacy `autoOutingName`).
 * @param mode - `'mer'`, `'lacj'` or `'lacc'`.
 * @param boatName - Boat name.
 * @param place - Departure place.
 * @param zone - Sea area code.
 * @param when - Date of the outing (now by default).
 * @returns The name.
 */
export function autoOutingName(
  mode: string,
  boatName: string,
  place: string,
  zone?: string,
  when: Date = new Date(),
): string {
  const year = String(when.getFullYear()).slice(2);
  const numbered = new RegExp(String.raw`^${year}(\d{2,3})`);
  let highest = 0;
  for (const meta of state.data.index.value) {
    if (new Date(meta.created).getFullYear() !== when.getFullYear()) continue;
    const match = numbered.exec(meta.name || '');
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  const water = mode === 'mer' ? zone || 'M' : 'L';
  const code = `${year}${pad(highest + 1)}${water}${mode === 'lacj' ? '' : 'c'}`;
  const label = [boatName, place].filter(Boolean).join(' ');
  const date = `${when.getDate()}/${when.getMonth() + 1}`;
  return `${code}_${label} ${DOW[when.getDay()]} ${date}`.replace('_ ', '_');
}

async function reverseGeocode(
  lat: number,
  lon: number,
): Promise<string | null> {
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 4000);
    const reply = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=12&lat=${lat}&lon=${lon}&accept-language=fr`,
      { signal: controller.signal },
    );
    if (!reply.ok) return null;
    const json = (await reply.json()) as { address?: Record<string, string> };
    const address = json.address ?? {};
    return (
      address.town ||
      address.city ||
      address.village ||
      address.municipality ||
      null
    );
  } catch {
    return null;
  }
}
