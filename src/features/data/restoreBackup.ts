import type { Settings } from '../../model/settings.ts';
import type {
  Boat,
  ChecklistBase,
  CrewSet,
  Cruise,
  Member,
  SosLog,
  TaskTemplate,
} from '../../model/types.ts';
import {
  crewSig,
  hooks,
  mergeBoats,
  mergeCkLib,
  mergeMarks,
  mergeMembers,
  mergeUiEdits,
  openCruise,
  saveSettings,
  setTaskTpl,
  state,
  updateCrewSets,
  updateSettings,
  updateSosLogs,
} from '../../state/index.ts';
import { getPhoto, putPhoto } from '../../storage/photos.ts';
import { store } from '../../storage/store.ts';

import { mergeCruise } from './mergeCruise.ts';

/** Man overboard procedures of a backup. */
interface BackupMob {
  /** @default undefined */
  real?: Array<{ steps?: unknown }>;
  [key: string]: unknown;
}

/** A backup file as read: every part is optional and untrusted. */
export interface BackupFile {
  /** @default undefined */
  all?: boolean;
  /** @default undefined */
  version?: number;
  /** @default undefined */
  cruises?: unknown;
  /** @default undefined */
  cruise?: unknown;
  /** @default undefined */
  track?: unknown;
  /** @default undefined */
  boats?: unknown;
  /** @default undefined */
  boatsAt?: string;
  /** @default undefined */
  members?: unknown;
  /** @default undefined */
  membersAt?: string;
  /** @default undefined */
  ckLib?: unknown;
  /** @default undefined */
  uiEdits?: Record<string, unknown>;
  /** @default undefined */
  marks?: unknown;
  /** @default undefined */
  sosLogs?: unknown;
  /** @default undefined */
  sosPwd?: string;
  /** @default undefined */
  crewSets?: unknown;
  /** @default undefined */
  mob?: BackupMob;
  /** @default undefined */
  mobMer?: BackupMob;
  /** @default undefined */
  mobAt?: string;
  /** @default undefined */
  taskTpl?: TaskTemplate;
  /** @default undefined */
  photos?: unknown;
  /** @default undefined */
  settings?: Partial<Settings>;
  /** @default undefined */
  current?: string;
}

/** What a restoration did. */
export interface RestoreResult {
  /** Number of cruises in the file. */
  count: number;
  /** Last cruise merged. */
  last: Cruise | null;
}

/**
 * Merge a backup into this device (legacy `restoreFile`): a cruise that already
 * exists is completed, never replaced, and the records follow their own merge
 * rules. The sheets are copied to `ldb.preRestore` first.
 * @param file - Parsed backup.
 * @returns The cruises restored.
 * @throws When the file holds no cruise and no sheet.
 */
export async function restoreBackup(file: BackupFile): Promise<RestoreResult> {
  const cruises = cruisesOf(file);
  if (
    cruises.length === 0 &&
    !(file.all && (Array.isArray(file.boats) || Array.isArray(file.members)))
  ) {
    throw new Error('not a backup file');
  }
  const { data, view } = state;
  if (view.tracking.value) void hooks.stopTracking?.(false);
  store.setRaw(
    'ldb.preRestore',
    JSON.stringify({
      t: new Date().toISOString(),
      boats: data.boats.value,
      members: data.members.value,
      crewSets: data.crewSets.value,
    }),
  );
  const currentId = data.cruise.value?.id;
  let last: Cruise | null = null;
  for (const { cruise, track } of cruises) last = mergeCruise(cruise, track);
  restoreRecords(file);
  await restorePhotos(file.photos);
  if (file.all && file.settings && data.index.value.length === 0) {
    const received = file.settings;
    updateSettings((settings) => {
      Object.assign(settings, received);
    });
  }
  saveSettings();
  const pick = pickCruise(currentId, file.current, last);
  if (pick) openCruise(pick);
  return { count: cruises.length, last };
}

function cruisesOf(
  file: BackupFile,
): Array<{ cruise: Cruise; track: unknown }> {
  const list = file.all
    ? file.cruises
    : [{ cruise: file.cruise, track: file.track }];
  const cruises: Array<{ cruise: Cruise; track: unknown }> = [];
  for (const item of (list ?? []) as Array<{
    cruise?: Cruise;
    track?: unknown;
  } | null>) {
    if (item?.cruise?.id && Array.isArray(item.cruise.entries)) {
      cruises.push({ cruise: item.cruise, track: item.track });
    }
  }
  return cruises;
}

function restoreRecords(file: BackupFile): void {
  if (Array.isArray(file.boats)) {
    mergeBoats(file.boats as Boat[], file.boatsAt);
  }
  if (Array.isArray(file.members)) {
    mergeMembers(file.members as Member[], file.membersAt);
  }
  if (Array.isArray(file.ckLib)) mergeCkLib(file.ckLib as ChecklistBase[]);
  if (file.uiEdits) mergeUiEdits(file.uiEdits);
  if (file.marks) mergeMarks(file.marks);
  if (Array.isArray(file.sosLogs)) restoreSosLogs(file);
  if (Array.isArray(file.crewSets)) restoreCrewSets(file.crewSets as CrewSet[]);
  restoreMob(file);
  const { taskTpl } = file;
  if (
    taskTpl?.tasks &&
    (taskTpl.at || '') > (state.data.taskTpl.value?.at || '')
  ) {
    setTaskTpl(taskTpl);
  }
}

function restoreSosLogs(file: BackupFile): void {
  updateSosLogs((logs) => {
    for (const log of file.sosLogs as Array<SosLog | null>) {
      if (log?.id && !logs.some((known) => known.id === log.id)) logs.push(log);
    }
  });
  if (file.sosPwd && !store.get('ldb.sosPwd', '')) {
    store.set('ldb.sosPwd', file.sosPwd);
  }
}

function restoreCrewSets(received: ReadonlyArray<CrewSet | null>): void {
  updateCrewSets((sets) => {
    for (const set of received) {
      if (!set?.id || sets.some((known) => known.id === set.id)) continue;
      if (set._sig === undefined) set._sig = crewSig(set);
      sets.push(set);
    }
  });
}

function restoreMob(file: BackupFile): void {
  const { mob, mobMer, mobAt } = file;
  if (
    !Array.isArray(mob?.real) ||
    !mob.real[0]?.steps ||
    (mobAt || '') <= store.get('ldb.mob.at', '')
  ) {
    return;
  }
  store.set('ldb.mob2', mob);
  if (Array.isArray(mobMer?.real)) store.set('ldb.mob2mer', mobMer);
  store.set('ldb.mob.at', mobAt);
}

async function restorePhotos(photos: unknown): Promise<void> {
  if (!Array.isArray(photos)) return;
  /* eslint-disable no-await-in-loop -- one IndexedDB write at a time, as the file lists them */
  for (const photo of photos as Array<{ id?: string; url?: string } | null>) {
    if (photo?.id && photo.url && !(await getPhoto(photo.id))) {
      await putPhoto(photo.id, photo.url);
    }
  }
  /* eslint-enable no-await-in-loop */
}

function pickCruise(
  currentId: string | undefined,
  current: string | undefined,
  last: Cruise | null,
): string | undefined {
  if (isListed(currentId)) return currentId;
  return isListed(current) ? current : last?.id;
}

function isListed(id: string | undefined): boolean {
  return Boolean(id) && state.data.index.value.some((meta) => meta.id === id);
}
