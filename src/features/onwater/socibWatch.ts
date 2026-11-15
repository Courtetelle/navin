import { signal } from '@preact/signals-react';

import { toast } from '../../state/index.ts';
import { store } from '../../storage/store.ts';

import { SOCIB_STATIONS, SOCIB_THREDDS, opendapValues } from './euStations.ts';

/**
 * Every instrument folder of the SOCIB weather catalogue on 15.11.2026, the
 * old ones too: a folder not in it is an instrument SOCIB added or put in
 * place of another.
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
/** An instrument of NavIn silent this long no longer measures. */
const SILENT_MS = 7 * 24 * 3_600_000;

/** The last look at the SOCIB catalogue. */
export interface SocibWatch {
  /** When NavIn looked (epoch ms). */
  at: number;
  /** Folders SOCIB added since the list of NavIn. */
  added: string[];
  /** Instruments of NavIn that no longer measure. */
  gone: string[];
  /** The change the skipper has seen (« Vu »). */
  seen?: string;
}

/** The last look, for Réglages. */
export const socibWatch = signal<SocibWatch | null>(
  store.get<SocibWatch | null>(KEY, null),
);

/**
 * The instrument folders of the catalogue that NavIn does not know.
 * @param xml - The THREDDS catalogue.
 * @returns The new folders, sorted.
 */
export function socibAdded(xml: string): string[] {
  const found = new Set<string>();
  for (const match of xml.matchAll(/xlink:title="(?<name>[^"]+)"/gu)) {
    const name = match.groups?.name ?? '';
    if (/^[a-z]+_[a-z]+-[a-z]+_met\d+$/u.test(name) && !SOCIB_KNOWN.has(name)) {
      found.add(name);
    }
  }
  return [...found].toSorted();
}

/**
 * What changed, in one text: the same text is a change already seen.
 * @param watch - A look.
 * @returns The text, empty when nothing changed.
 */
export function socibChangeText(watch: SocibWatch | null): string {
  if (!watch) return '';
  const parts: string[] = [];
  if (watch.added.length > 0) {
    parts.push(`nouveaux instruments : ${watch.added.join(', ')}`);
  }
  if (watch.gone.length > 0) {
    parts.push(`ne mesurent plus : ${watch.gone.join(', ')}`);
  }
  return parts.join(' · ');
}

/**
 * A change not seen yet: Réglages shows it with « Vu ».
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
 * Whether an instrument of NavIn still measures: its file answers and its
 * last measurement is less than a week old.
 * @param path - Its file.
 * @param now - Epoch ms.
 * @returns True while it measures.
 */
async function measures(path: string, now: number): Promise<boolean> {
  try {
    const base = `${SOCIB_THREDDS}/dodsC/${path}`;
    const dds = await textOf(`${base}.dds`);
    const size = Number(/time\[time = (?<size>\d+)\]/u.exec(dds)?.groups?.size);
    if (!Number.isFinite(size) || size < 1) return false;
    const values = opendapValues(
      await textOf(`${base}.ascii?time%5B${size - 1}%5D`),
    );
    const seconds = values.time?.[0];
    return seconds != null && now - seconds * 1000 < SILENT_MS;
  } catch {
    return false;
  }
}

/**
 * Once a week, NavIn looks at the SOCIB catalogue: an instrument added or
 * put in place of another, or one of its own silent for a week, is said in
 * a bubble and in Réglages › Alertes, until « Vu ». Without network nothing
 * is kept and NavIn looks again at the next start.
 * @param now - Epoch ms.
 */
export async function checkSocib(now = Date.now()): Promise<void> {
  const last = socibWatch.peek();
  if (last && now - last.at < EVERY_MS) return;
  let added: string[];
  try {
    added = socibAdded(
      await textOf(
        `${SOCIB_THREDDS}/catalog/mooring/weather_station/catalog.xml`,
      ),
    );
  } catch {
    return;
  }
  const gone: string[] = [];
  /* eslint-disable no-await-in-loop -- SOCIB refuses the bursts */
  for (const station of SOCIB_STATIONS) {
    if (!(await measures(station.path, now))) gone.push(station.name);
  }
  /* eslint-enable no-await-in-loop */
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
      'SOCIB (Baléares) a changé ses instruments : la liste de NavIn est à mettre à jour (Réglages › Alertes)',
    );
  }
}
