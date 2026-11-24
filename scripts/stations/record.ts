/**
 * Stations des zones LiveMétéo (demande de Corban du 23/11/2026) : lit toutes
 * les pastilles de la carte (bouées et stations) des zones actives dans NavIn
 * et les ajoute à l'archive de la branche `stations`.
 *
 * Lancé par .github/workflows/stations.yml :
 *   node scripts/stations/record.ts --store store
 * Variables : ZONES (zones envoyées par NavIn, « aucune » pour aucune, vide
 * pour garder celles de l'archive), MF_KEY, AEMET_KEY, METOFFICE_KEY,
 * FROST_KEY, RELAY_URL (facultatives).
 *
 * Les lecteurs de l'application sont repris tels quels (serveur Vite en mode
 * module) : l'archive garde exactement ce que LiveMétéo montre.
 */
import {
  appendFile,
  mkdir,
  readFile,
  readdir,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';

import { createServer, createServerModuleRunner } from 'vite';

import type * as Zones from '../../src/features/zones/meteoZones.ts';
import type * as Archive from '../../src/features/zones/stationArchive.ts';
import type * as Record from '../../src/features/zones/stationRecord.ts';

const root = path.resolve(import.meta.dirname, '../..');
const storeArg = process.argv.indexOf('--store');
const store = path.resolve(
  storeArg > 0 ? (process.argv[storeArg + 1] ?? 'store') : 'store',
);

/** The site of NavIn, an origin the relay accepts. */
const NAVIN_ORIGIN = 'https://courtetelle.github.io';
const relay = (process.env.RELAY_URL ?? '').trim().replace(/\/$/u, '');

// The files of NavIn (zones, grid of the 500 m) read from public/, as the
// app reads them from its site.
const webFetch = globalThis.fetch;
globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  if (url.startsWith('/')) {
    try {
      const body = await readFile(path.join(root, 'public', url));
      return new Response(body);
    } catch {
      return new Response(null, { status: 404 });
    }
  }
  // The relay of NavIn answers only the pages of NavIn: GitHub says it
  // comes from there (the relay itself is the skipper's own).
  if (relay && url.startsWith(`${relay}/`)) {
    const headers = new Headers(init?.headers);
    headers.set('Origin', NAVIN_ORIGIN);
    return webFetch(input, { ...init, headers });
  }
  return webFetch(input, init);
};
// The phone's own memory of the readings has no place here.
process.on('unhandledRejection', () => undefined);

async function readJson(file: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as unknown;
  } catch {
    return null;
  }
}

const server = await createServer({
  root,
  configFile: false,
  logLevel: 'error',
  appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false },
});
try {
  const runner = createServerModuleRunner(server.environments.ssr, {
    hmr: false,
  });
  const zonesLib = await runner.import<typeof Zones>(
    '/src/features/zones/meteoZones.ts',
  );
  const archive = await runner.import<typeof Archive>(
    '/src/features/zones/stationArchive.ts',
  );
  const recorder = await runner.import<typeof Record>(
    '/src/features/zones/stationRecord.ts',
  );

  const all = zonesLib.parseZones(
    await readJson(path.join(root, 'public/meteo-zones.json')),
  );
  const known = new Set(all.map((zone) => zone.id));
  const activeFile = path.join(store, archive.ACTIVE_FILE);
  const sent = process.env.ZONES?.trim() ?? '';
  let active = archive.parseActive(await readJson(activeFile));
  if (sent) {
    active = {
      ids: archive.activeFromInput(sent, known),
      at: new Date().toISOString(),
    };
    await mkdir(store, { recursive: true });
    await writeFile(activeFile, `${JSON.stringify(active, null, 1)}\n`);
  }
  const zones = all.filter((zone) => active.ids.includes(zone.id));
  const summary: string[] = ['## Stations des zones LiveMétéo', ''];
  if (zones.length === 0) {
    summary.push('Aucune zone active dans NavIn : rien à lire.');
  } else {
    const keys = {
      mf: process.env.MF_KEY ?? '',
      aemet: process.env.AEMET_KEY ?? '',
      metOffice: process.env.METOFFICE_KEY ?? '',
      frost: process.env.FROST_KEY ?? '',
      relay,
    };
    const readings = await recorder.readZoneStations(zones, keys);
    const daysDir = path.join(store, archive.DAYS_DIR);
    await mkdir(daysDir, { recursive: true });
    const days = new Map<string, Archive.ArchiveDay>();
    const listed = await readdir(daysDir);
    const files = listed.filter((file) => file.endsWith('.json'));
    const read = await Promise.all(
      files.map(
        async (file) =>
          (await readJson(
            path.join(daysDir, file),
          )) as Archive.ArchiveDay | null,
      ),
    );
    for (const day of read) {
      if (day?.date && day.stations) days.set(day.date, day);
    }
    const added = archive.addReadings(days, readings, (reading) =>
      recorder.zonesOfPlace(zones, reading.lat, reading.lon),
    );
    const touched = new Set(readings.map((r) => archive.dayOf(r.t)));
    await Promise.all(
      [...touched].map((date) =>
        writeFile(
          path.join(daysDir, `${date}.json`),
          `${JSON.stringify(days.get(date))}\n`,
        ),
      ),
    );
    const index = archive.archiveIndex(
      new Date().toISOString(),
      active.ids,
      readings,
      days.values(),
    );
    await writeFile(
      path.join(store, 'index.json'),
      `${JSON.stringify(index, null, 1)}\n`,
    );
    summary.push(
      `Zones : ${zones.map((zone) => zone.name).join(', ')}.`,
      '',
      `${index.last.stations} stations lues, ${added} mesures nouvelles.`,
      '',
      ...Object.entries(index.last.nets)
        .toSorted((a, b) => b[1] - a[1])
        .map(([net, count]) => `- ${net} : ${count}`),
      '',
      `Sans clé : ${
        [
          keys.mf ? '' : 'Météo-France (MF_KEY)',
          keys.aemet ? '' : 'AEMET (AEMET_KEY)',
          keys.metOffice ? '' : 'Met Office (METOFFICE_KEY)',
          keys.frost ? '' : 'MET Norway (FROST_KEY)',
          keys.relay ? '' : 'relais (RELAY_URL : METAR, bouées NOAA, Pays-Bas)',
        ]
          .filter(Boolean)
          .join(', ') || 'aucune'
      }.`,
    );
  }
  const text = summary.join('\n');
  process.stdout.write(`${text}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, `${text}\n`);
  }
} finally {
  await server.close();
}
