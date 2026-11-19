import { signal } from '@preact/signals-react';

import { toast } from '../../state/index.ts';
import { store } from '../../storage/store.ts';

import type { SocibStation } from './euStations.ts';
import {
  SOCIB_LIST_KEY,
  SOCIB_THREDDS,
  opendapValues,
  socibStations,
} from './euStations.ts';

/**
 * Every instrument folder of the SOCIB weather catalogue on 15.11.2026, the
 * old ones too: the silent ones of them are not looked at again; a folder
 * not in it is an instrument SOCIB added or put in place of another.
 */
export const SOCIB_KNOWN: ReadonlySet<string> = new Set([
  'buoy_bahiadepalma-scb_met008',
  'buoy_bahiadepalma-scb_met010',
  'buoy_bahiadepalma-scb_met029',
  'buoy_canaldeibiza-scb_met010',
  'buoy_canaldeibiza-scb_met030',
  'buoy_portocolom-scb_met025',
  'buoy_portocolom-scb_met028',
  'buoy_soller-scb_met014',
  'buoy_soller-scb_met024',
  'buoy_soller-scb_met031',
  'mobims_calamillor-scb_met001',
  'mobims_calamillor-scb_met012',
  'mobims_muro-scb_met016',
  'mobims_playadepalma-scb_met003',
  'mobims_playadepalma-scb_met006',
  'mobims_playadepalma-scb_met012',
  'mobims_sonbou-scb_met002',
  'mobims_sonbou-scb_met011',
  'mobims_sonbou-scb_met013',
  'mobims_sonbou-scb_met021',
  'station_barbaria-scb_met006',
  'station_cabrera-scb_met027',
  'station_esporles-scb_met003',
  'station_esporles-scb_met006',
  'station_estellencs-smt_met001',
  'station_galfi-scb_met001',
  'station_galfi-scb_met005',
  'station_galfi-scb_met013',
  'station_galfi-scb_met022',
  'station_lamola-scb_met018',
  'station_parcbit-scb_met003',
  'station_parcbit-scb_met004',
  'station_parcbit-scb_met015',
  'station_parcbit-scb_met023',
  'station_salines-ime_met002',
]);

/** Where the result of the last look is kept. */
const KEY = 'ldb.socibWatch';
/** NavIn looks once a week. */
const EVERY_MS = 7 * 24 * 3_600_000;
/** An instrument silent this long no longer measures. */
const SILENT_MS = 7 * 24 * 3_600_000;
/** The weather folders of the catalogue. */
const CATALOG = `${SOCIB_THREDDS}/catalog/mooring/weather_station`;

/** The last look at the SOCIB catalogue. */
export interface SocibWatch {
  /** When NavIn looked (epoch ms). */
  at: number;
  /** Instruments NavIn added to its list. */
  added: string[];
  /** Instruments NavIn took out of its list: they no longer measure. */
  gone: string[];
  /** The change the skipper has seen (« Vu »). */
  seen?: string;
}

/** The last look, for the Météo menu. */
export const socibWatch = signal<SocibWatch | null>(
  store.get<SocibWatch | null>(KEY, null),
);

/**
 * The instrument folders of the catalogue.
 * @param xml - The THREDDS catalogue.
 * @returns The folders, sorted.
 */
export function socibFolders(xml: string): string[] {
  const found = new Set<string>();
  for (const match of xml.matchAll(/xlink:title="(?<name>[^"]+)"/gu)) {
    const name = match.groups?.name ?? '';
    if (/^[a-z]+_[a-z]+-[a-z]+_met\d+$/u.test(name)) found.add(name);
  }
  return [...found].toSorted();
}

/**
 * The folders worth a look: the new ones, and those of the instruments read
 * (SOCIB may have put a new deployment in them).
 * @param folders - The folders of the catalogue.
 * @param read - The folders of the instruments read.
 * @returns The folders to look at.
 */
export function socibToLook(
  folders: readonly string[],
  read: readonly string[],
): string[] {
  return folders.filter(
    (folder) => !SOCIB_KNOWN.has(folder) || read.includes(folder),
  );
}

/**
 * The latest file of an instrument: the last deployment of its folder.
 * @param xml - The catalogue of its L1 folder.
 * @returns The OPeNDAP path, or null.
 */
export function socibLatest(xml: string): string | null {
  const paths = [...xml.matchAll(/urlPath="(?<path>[^"]+_L1_latest\.nc)"/gu)]
    .map((match) => match.groups?.path ?? '')
    .filter(Boolean)
    .toSorted();
  return paths.at(-1) ?? null;
}

const PLACE_KIND: Readonly<Record<string, string>> = {
  buoy: 'bouée',
  mobims: 'plage',
};

/**
 * The name of a new instrument, from its folder.
 * @param folder - e.g. `buoy_dragonera-scb_met040`.
 * @returns e.g. `Dragonera (bouée)`.
 */
export function socibName(folder: string): string {
  const [kind = '', rest = ''] = folder.split('_');
  const place = rest.split('-', 1)[0] ?? rest;
  const name = place.charAt(0).toUpperCase() + place.slice(1);
  const what = PLACE_KIND[kind];
  return what ? `${name} (${what})` : name;
}

/**
 * What changed, in one text: the same text is a change already seen.
 * @param watch - A look.
 * @returns The text, empty when nothing changed.
 */
export function socibChangeText(watch: SocibWatch | null): string {
  if (!watch) return '';
  const parts: string[] = [];
  if (watch.added.length > 0) parts.push(`ajoutés : ${watch.added.join(', ')}`);
  if (watch.gone.length > 0) parts.push(`retirés : ${watch.gone.join(', ')}`);
  return parts.join(' · ');
}

/**
 * A change not seen yet: the Météo menu shows it with « Vu ».
 * @param watch - A look.
 * @returns Whether it is to be shown.
 */
export function socibToSay(watch: SocibWatch | null): boolean {
  const text = socibChangeText(watch);
  return text !== '' && watch?.seen !== text;
}

/** The change is seen: it is no longer said, until another one. */
export function socibSeen(): void {
  const watch = socibWatch.peek();
  if (!watch) return;
  const next = { ...watch, seen: socibChangeText(watch) };
  store.set(KEY, next);
  socibWatch.value = next;
}

async function textOf(url: string): Promise<string> {
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`${response.status}`);
  return response.text();
}

/**
 * An instrument as NavIn reads it, while it measures the wind: its latest
 * file answers, has the wind, and its last measurement is less than a week
 * old; its place is read in its file.
 * @param folder - Its folder.
 * @param name - Its name, kept from the list when it was there.
 * @param now - Epoch ms.
 * @returns The instrument, or null.
 */
async function socibLive(
  folder: string,
  name: string,
  now: number,
): Promise<SocibStation | null> {
  try {
    const path = socibLatest(
      await textOf(`${CATALOG}/${folder}/L1/catalog.xml`),
    );
    if (!path) return null;
    const base = `${SOCIB_THREDDS}/dodsC/${path}`;
    const dds = await textOf(`${base}.dds`);
    const size = Number(/time\[time = (?<size>\d+)\]/u.exec(dds)?.groups?.size);
    if (!Number.isFinite(size) || size < 1 || !dds.includes(' WIN_SPE[')) {
      return null;
    }
    const values = opendapValues(
      await textOf(`${base}.ascii?time%5B${size - 1}%5D,LAT,LON`),
    );
    const seconds = values.time?.[0];
    const lat = values.LAT?.[0];
    const lon = values.LON?.[0];
    if (seconds == null || lat == null || lon == null) return null;
    if (now - seconds * 1000 >= SILENT_MS) return null;
    return { id: folder, name, lat, lon, path };
  } catch {
    return null;
  }
}

/**
 * Once a week NavIn makes its list of SOCIB instruments again, by itself:
 * an instrument added, or put in place of another, joins it; one silent for
 * a week leaves it. What changed is said in a bubble and in the Météo menu
 * until « Vu ». Without network nothing changes; NavIn looks again at the
 * next start.
 * @param now - Epoch ms.
 */
export async function checkSocib(now = Date.now()): Promise<void> {
  const last = socibWatch.peek();
  if (last && now - last.at < EVERY_MS) return;
  let folders: string[];
  try {
    folders = socibFolders(await textOf(`${CATALOG}/catalog.xml`));
  } catch {
    return;
  }
  const current = socibStations();
  const live: SocibStation[] = [];
  /* eslint-disable no-await-in-loop -- SOCIB refuses the bursts */
  for (const folder of socibToLook(
    folders,
    current.map((one) => one.id),
  )) {
    const known = current.find((one) => one.id === folder);
    const station = await socibLive(
      folder,
      known?.name ?? socibName(folder),
      now,
    );
    if (station) live.push(station);
  }
  /* eslint-enable no-await-in-loop */
  // Nothing measures: rather the network than SOCIB; the list stays.
  if (live.length === 0) return;
  const added = live
    .filter((one) => !current.some((old) => old.path === one.path))
    .map((one) => one.name);
  const gone = current
    .filter((old) => !live.some((one) => one.id === old.id))
    .map((old) => old.name);
  store.set(SOCIB_LIST_KEY, live);
  const watch: SocibWatch = {
    at: now,
    added,
    gone,
    ...(last?.seen ? { seen: last.seen } : {}),
  };
  store.set(KEY, watch);
  socibWatch.value = watch;
  if (socibToSay(watch)) {
    toast(
      'SOCIB (Baléares) : NavIn a mis à jour la liste de ses instruments (Paramétrages › Alertes › Alerte vent)',
    );
  }
}
