import { pad } from '../../lib/format.ts';
import type { Cruise } from '../../model/types.ts';
import type { TrackPoint } from '../../state/index.ts';
import { loadTrack, state } from '../../state/index.ts';
import { getPhoto } from '../../storage/photos.ts';
import { store } from '../../storage/store.ts';

/** One photo carried by a sync file. */
export interface BackupPhoto {
  id: string;
  /** Photo as stored: a data URL, or a blob for old photos. */
  url: unknown;
}

/** One cruise of a full backup. */
export interface BackupCruise {
  cruise: Cruise;
  track: TrackPoint[];
}

/** Content of a full backup file (`version: 4`), keys in the legacy file order. */
export interface FullBackup {
  app: 'livre-de-bord';
  version: 4;
  all: true;
  saved: string;
  current: string | null;
  cruises: BackupCruise[];
  /** @default undefined */
  photos?: BackupPhoto[];
  [key: string]: unknown;
}

/** A backup ready to deliver. */
export interface BackupPack {
  /** File name. */
  name: string;
  /** Content, before serialization. */
  data: FullBackup;
  /** Serialized content. */
  readonly json: string;
}

/**
 * Text of the single cruise backup (legacy `#jsonBtn`, version 2).
 * @param cruise - Open cruise.
 * @returns The JSON file content.
 */
export function cruiseBackupJson(cruise: Cruise): string {
  return JSON.stringify(
    { app: 'livre-de-bord', version: 2, cruise, track: loadTrack() },
    null,
    1,
  );
}

/**
 * Backup of every cruise and record of this device (legacy `backupAll`).
 * @returns The file name, the content and its JSON text.
 */
export function backupAll(): BackupPack {
  const { data, preferences } = state;
  const cruises: BackupCruise[] = [];
  for (const meta of data.index.value) {
    const cruise = store.get<Cruise | null>(`ldb.cruise.${meta.id}`, null);
    if (!cruise) continue;
    cruises.push({
      cruise,
      track: store.get<TrackPoint[]>(`ldb.track.${meta.id}`, []),
    });
  }
  const date = new Date();
  const content: FullBackup = {
    app: 'livre-de-bord',
    version: 4,
    all: true,
    saved: date.toISOString(),
    current: data.cruise.value?.id ?? null,
    settings: preferences.settings.value,
    boats: data.boats.value,
    members: data.members.value,
    cruises,
    ckLib: data.ckLib.value,
    taskTpl: data.taskTpl.value,
    uiEdits: data.uiEdits.value,
    marks: data.marks.value,
    crewSets: data.crewSets.value,
    mob: store.get('ldb.mob2', null),
    mobMer: store.get('ldb.mob2mer', null),
    sosLogs: data.sosLogs.value,
    sosPwd: store.get('ldb.sosPwd', ''),
    errLog: store.get('ldb.errLog', []),
    mobAt: store.get('ldb.mob.at', ''),
    boatsAt: store.get('ldb.boats.at', ''),
    membersAt: store.get('ldb.members.at', ''),
  };
  return {
    name: `navin-tout-${dateStamp(date)}.json`,
    data: content,
    get json() {
      return JSON.stringify(content);
    },
  };
}

/**
 * Sync file: the full backup with the photos of the cruises when asked, and
 * always the photos of the boat documents (legacy `syncPack`).
 * @param withPhotos - Carry the cruise photos.
 * @param boatPhotos - Reads the boat document photos.
 * @returns The pack, named `navin-synchro-<date>-<time>.json`.
 */
export async function syncPack(
  withPhotos: boolean,
  boatPhotos: () => Promise<BackupPhoto[]>,
): Promise<BackupPack> {
  const pack = backupAll();
  if (withPhotos) {
    pack.data.photos = await cruisePhotos(pack.data.cruises);
  }
  pack.data.photos = [...(pack.data.photos ?? []), ...(await boatPhotos())];
  const date = new Date();
  pack.name = `navin-synchro-${dateStamp(date)}-${pad(date.getHours())}${pad(date.getMinutes())}.json`;
  return pack;
}

async function cruisePhotos(
  cruises: readonly BackupCruise[],
): Promise<BackupPhoto[]> {
  const photos: BackupPhoto[] = [];
  /* eslint-disable no-await-in-loop -- one IndexedDB read at a time, in file order */
  for (const { cruise } of cruises) {
    for (const reference of cruise.photos ?? []) {
      const url = await getPhoto(reference.id);
      if (url) photos.push({ id: reference.id, url });
    }
  }
  /* eslint-enable no-await-in-loop */
  return photos;
}

function dateStamp(date: Date): string {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
}
