import { state, toast } from '../../state/index.ts';

import { importGpxFile } from './gpxImport.ts';
import type { ParsedTrack } from './gpxParse.ts';
import { parseNmeaFile } from './nmeaFile.ts';

/**
 * Import a recorded NMEA 0183 file like a GPX track (legacy `nmImportFile`).
 * @param file - The file.
 */
export async function nmeaImportFile(file: File): Promise<void> {
  if (!state.data.cruise.value) {
    toast('Ouvrez d’abord une navigation');
    return;
  }
  let parsed: ParsedTrack;
  try {
    parsed = parseNmeaFile(await file.text());
  } catch {
    toast('Fichier NMEA illisible');
    return;
  }
  if (parsed.pts.length < 2) {
    toast('Aucune position datée (phrases RMC) dans ce fichier');
    return;
  }
  parsed.name = file.name;
  await importGpxFile(file, parsed);
}
