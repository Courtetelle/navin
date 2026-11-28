import { pad } from '../../lib/format.ts';
import type { Cruise } from '../../model/types.ts';
import type { TrackPoint } from '../../state/index.ts';
import {
  alertLog,
  allVoyageDocIds,
  keyBook,
  loadTrack,
  siteLinkEdits,
  state,
  traceCutTimes,
  traceNames,
  traceVoyages,
  voyagesChanged,
} from '../../state/index.ts';
import { getPhoto } from '../../storage/photos.ts';
import { store } from '../../storage/store.ts';
import { savedRoutings } from '../map/routingState.ts';

/** One photo carried by a sync file. */
interface BackupPhoto {
  id: string;
  /** Photo as stored: a data URL, or a blob for old photos. */
  url: unknown;
}

/** One cruise of a full backup. */
interface BackupCruise {
  cruise: Cruise;
  track: TrackPoint[];
  /**
   * Times where the recording is cut into several traces.
   * @default undefined
   */
  cuts?: number[];
}

/** Content of a full backup file (`version: 4`), keys in the legacy file order. */
interface FullBackup {
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
interface BackupPack {
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
    const cuts = traceCutTimes(meta.id);
    cruises.push({
      cruise,
      track: store.get<TrackPoint[]>(`ldb.track.${meta.id}`, []),
      // Only when the recording holds several traces.
      ...(cuts.length > 0 ? { cuts } : {}),
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
    // The routes only when there are some: an empty list keeps the file the
    // one of the first app.
    ...(data.routes.value.length > 0 ? { routes: data.routes.value } : {}),
    // The weather routings of « Routages », as the routes.
    ...(savedRoutings.value.length > 0
      ? { routings: savedRoutings.value }
      : {}),
    crewSets: data.crewSets.value,
    // data › Croisières, only once changed: an untouched one keeps the file
    // the one of the first app.
    ...(voyagesChanged() ? { voyages: data.voyageStore.value } : {}),
    mob: store.get('ldb.mob2', null),
    mobMer: store.get('ldb.mob2mer', null),
    sosLogs: data.sosLogs.value,
    // The journal of the alerts, only when it holds some: an empty one
    // keeps the file the one of the first app.
    ...(alertLog.value.length > 0 ? { alerts: alertLog.value } : {}),
    // Kept for the format shared with the first app; no longer used.
    sosPwd: store.get('ldb.sosPwd', ''),
    errLog: store.get('ldb.errLog', []),
    mobAt: store.get('ldb.mob.at', ''),
    boatsAt: store.get('ldb.boats.at', ''),
    membersAt: store.get('ldb.members.at', ''),
  };
  // The texts given to traces, only when there are some.
  const names = traceNames();
  if (Object.keys(names).length > 0) content.traceNames = names;
  // The cruise or outing of each trace, when some were classed.
  const classed = traceVoyages();
  if (Object.keys(classed).length > 0) content.traceVoyages = classed;
  // The accounts of the sites of the keys and their guides, when there are
  // some: they go to another device with the backup.
  const book = keyBook();
  if (book) content.keyBook = book;
  // The links to sites changed with their pencil.
  const links = siteLinkEdits();
  if (Object.keys(links).length > 0) content.siteLinks = links;
  return {
    name: `NavIn-tout-${dateStamp(date)}.json`,
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
 * @returns The pack, named `NavIn-synchro-<date>-<time>.json`.
 */
export async function syncPack(
  withPhotos: boolean,
  boatPhotos: () => Promise<BackupPhoto[]>,
): Promise<BackupPack> {
  const pack = backupAll();
  if (withPhotos) {
    pack.data.photos = await cruisePhotos(pack.data.cruises);
  }
  pack.data.photos = [
    ...(pack.data.photos ?? []),
    ...(await boatPhotos()),
    ...(await voyagePhotos()),
  ];
  const date = new Date();
  pack.name = `NavIn-synchro-${dateStamp(date)}-${pad(date.getHours())}${pad(date.getMinutes())}.json`;
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

/**
 * The PDF and photos of data › Croisières: they always go with the sync
 * file, like the documents of the boats.
 * @returns The stored files.
 */
async function voyagePhotos(): Promise<BackupPhoto[]> {
  const photos: BackupPhoto[] = [];
  /* eslint-disable no-await-in-loop -- one IndexedDB read at a time */
  for (const id of allVoyageDocIds()) {
    const url = await getPhoto(id);
    if (url) photos.push({ id, url });
  }
  /* eslint-enable no-await-in-loop */
  return photos;
}

function dateStamp(date: Date): string {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
}
