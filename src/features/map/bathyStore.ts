import { fmtShortDate } from '../../lib/format.ts';
import { store } from '../../storage/store.ts';

import { docStore } from './external.ts';
import { readRecord, writeRecord } from './idbRecord.ts';
import { resetIsobaths } from './isobath.ts';

/** Shallow lines kept on the device (`ldb-docs`, key `bathy-asc`). */
export interface BathyRecord {
  at: string;
  files: string[];
  /** `[depth, lat, lon, lat, lon, …]`. */
  lines: number[][];
}

/**
 * Keep the computed lines (legacy `bathyAscSave`).
 * @param record - Lines and their origin.
 */
export async function bathyAscSave(record: BathyRecord): Promise<void> {
  const objectStore = await docStore('readwrite');
  await writeRecord(objectStore, 'bathy-asc', record);
  store.set('ldb.bathyAscAt', {
    at: record.at,
    n: record.lines.length,
    files: record.files,
  });
  resetIsobaths();
}

/**
 * The computed lines (legacy `bathyAscGet`).
 * @returns The record, or `null`.
 */
export async function bathyAscGet(): Promise<BathyRecord | null> {
  try {
    const objectStore = await docStore('readonly');
    return await readRecord<BathyRecord>(objectStore, 'bathy-asc');
  } catch {
    return null;
  }
}

/**
 * Sub-text of the import button (legacy `bathyAscNote`).
 * @returns The state of the lines.
 */
export function bathyAscNote(): string {
  const stored = store.get<{ at: string; n: number } | null>(
    'ldb.bathyAscAt',
    null,
  );
  return stored
    ? `calculées le ${fmtShortDate(new Date(stored.at))} (${stored.n} courbes de 1 à 5 m)`
    : 'zip swissBATHY3D ESRI ASCII tel quel (ou .asc), ou fichier de courbes (.json) d’un autre appareil';
}
