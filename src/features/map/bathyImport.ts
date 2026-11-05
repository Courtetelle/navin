import { deliver, toast } from '../../state/index.ts';

import type { AscSource } from './bathyContours.ts';
import { ascContours } from './bathyContours.ts';
import { bathyAscGet, bathyAscNote, bathyAscSave } from './bathyStore.ts';
import { zipAscEntries } from './bathyZip.ts';

/**
 * Compute or import the shallow lines (legacy `bathyAscImport`): a zip or `.asc`
 * swissBATHY3D grid, or the JSON file of another device.
 * @param files - Files chosen.
 * @param say - Shows a progress text.
 * @returns `true` when the lines were kept.
 */
export async function bathyAscImport(
  files: readonly File[],
  say: (text: string) => void,
): Promise<boolean> {
  try {
    const lines: number[][] = [];
    const names: string[] = [];
    /* eslint-disable no-await-in-loop -- one big file at a time: memory */
    for (const file of files) {
      names.push(file.name);
      if (/\.json$/i.test(file.name)) {
        for (const line of await jsonLines(file)) lines.push(line);
        continue;
      }
      for (const source of await sourcesOf(file)) {
        const got = await ascContours(source, (ratio, row, rows) => {
          const percent = Math.min(99, Math.round(ratio * 100));
          say(`${source.name} : ${percent} % (rangée ${row} / ${rows})…`);
        });
        for (const line of got) lines.push(line);
      }
    }
    /* eslint-enable no-await-in-loop */
    if (lines.length === 0) throw new Error('Aucune courbe de 1 à 5 m trouvée');
    await bathyAscSave({ at: new Date().toISOString(), files: names, lines });
    say(bathyAscNote());
    toast(
      `${lines.length} courbes de faible profondeur gardées sur l’appareil`,
    );
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    say(`échec : ${message}`);
    toast(`Lecture impossible : ${message}`);
    return false;
  }
}

/** Send the computed lines to another device (legacy `bathyAscShare`). */
export async function bathyAscShare(): Promise<void> {
  const record = await bathyAscGet();
  if (!record) {
    toast('Pas encore de courbes calculées');
    return;
  }
  await deliver(
    JSON.stringify({
      kind: 'bathy-asc',
      at: record.at,
      src: 'swissBATHY3D (swisstopo), courbes 1 à 5 m calculées dans NavIn',
      files: record.files,
      lines: record.lines,
    }),
    'courbes-leman-1-5m.json',
    'application/json',
  );
}

async function jsonLines(file: File): Promise<number[][]> {
  const parsed = JSON.parse(await file.text()) as {
    kind?: string;
    lines?: number[][];
  };
  if (parsed.kind !== 'bathy-asc' || !Array.isArray(parsed.lines)) {
    throw new Error('Ce fichier JSON ne contient pas de courbes');
  }
  return parsed.lines;
}

async function sourcesOf(file: File): Promise<AscSource[]> {
  if (!/\.zip$/i.test(file.name) && file.type !== 'application/zip') {
    return [
      {
        name: file.name,
        size: file.size,
        stream: () => file.stream(),
      },
    ];
  }
  const entries = await zipAscEntries(file);
  if (entries.length === 0) {
    throw new Error(
      'Pas de fichier .asc dans ce zip (prendre le format ESRI ASCII)',
    );
  }
  return entries;
}
