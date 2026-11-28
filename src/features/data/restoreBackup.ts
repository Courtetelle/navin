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
  mergeAlerts,
  mergeBoats,
  mergeCkLib,
  mergeKeyBook,
  mergeMarks,
  mergeMembers,
  mergeRoutes,
  mergeSiteLinks,
  mergeTraceNames,
  mergeTraceVoyages,
  mergeUiEdits,
  mergeVoyages,
  openCruise,
  restoreTraceCuts,
  saveSettings,
  setTaskTpl,
  state,
  updateCrewSets,
  updateSettings,
  updateSosLogs,
} from '../../state/index.ts';
import { getPhoto, putPhoto } from '../../storage/photos.ts';
import { store } from '../../storage/store.ts';
import { mergeRoutings } from '../map/routingState.ts';

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
  routes?: unknown;
  /** @default undefined */
  routings?: unknown;
  /**
   * data › Croisières.
   * @default undefined
   */
  voyages?: unknown;
  /** @default undefined */
  sosLogs?: unknown;
  /**
   * The journal of the alerts.
   * @default undefined
   */
  alerts?: unknown;
  /** @default undefined */
  /** The old password of the SOS logs: no longer used, ignored. */
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
  /** @default undefined */
  traceNames?: unknown;
  traceVoyages?: unknown;
  /** @default undefined */
  keyBook?: unknown;
  /** @default undefined */
  siteLinks?: unknown;
}

/** What a restoration did. */
export interface RestoreResult {
  /** Number of cruises in the file. */
  count: number;
  /** Last cruise merged. */
  last: Cruise | null;
  /** What the restoration did, for its report. */
  report: RestoreReport;
}

/** What a restoration did: added, completed, already here. */
export interface RestoreReport {
  /** Navigations this device did not have. */
  added: string[];
  /** Navigations already here, completed by the file (the duplicates merged). */
  completed: string[];
  /** Navigations already here, identical: nothing to do. */
  same: string[];
  /** Records added: boats, crew members, marks, crews. */
  boats: number;
  members: number;
  marks: number;
  crews: number;
}

/**
 * A stored text as its content alone: keys sorted, empty lists dropped (a
 * merge adds `deleted: []` without changing anything).
 * @param text - JSON text, or null.
 * @returns A text equal for the same content.
 */
function contentOf(text: string | null): string {
  if (text == null) return '';
  const clean = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(clean);
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value)
          .filter(([, inner]) => !(Array.isArray(inner) && inner.length === 0))
          .toSorted(([one], [two]) => one.localeCompare(two))
          .map(([key, inner]) => [key, clean(inner)]),
      );
    }
    return value;
  };
  try {
    return JSON.stringify(clean(JSON.parse(text)));
  } catch {
    return text;
  }
}

function cruiseName(cruise: Cruise): string {
  return cruise.info.name || cruise.id;
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
  const before = {
    boats: data.boats.value.length,
    members: data.members.value.length,
    marks: data.marks.value.length,
    crews: data.crewSets.value.length,
  };
  const report: RestoreReport = {
    added: [],
    completed: [],
    same: [],
    boats: 0,
    members: 0,
    marks: 0,
    crews: 0,
  };
  let last: Cruise | null = null;
  for (const { cruise, track, cuts } of cruises) {
    const known = data.index.value.some((meta) => meta.id === cruise.id);
    const was = known ? contentOf(store.raw(`ldb.cruise.${cruise.id}`)) : '';
    const points = known ? contentOf(store.raw(`ldb.track.${cruise.id}`)) : '';
    last = mergeCruise(cruise, track);
    restoreTraceCuts(cruise.id, cuts);
    const name = cruiseName(last);
    if (!known) {
      report.added.push(name);
    } else if (
      was === contentOf(store.raw(`ldb.cruise.${cruise.id}`)) &&
      points === contentOf(store.raw(`ldb.track.${cruise.id}`))
    ) {
      report.same.push(name);
    } else {
      report.completed.push(name);
    }
  }
  mergeTraceNames(file.traceNames);
  mergeTraceVoyages(file.traceVoyages);
  mergeKeyBook(file.keyBook);
  mergeSiteLinks(file.siteLinks);
  restoreRecords(file);
  await restorePhotos(file.photos);
  if (file.all && file.settings && data.index.value.length === 0) {
    const received = file.settings;
    updateSettings((settings) => {
      Object.assign(settings, received);
    });
  } else {
    restoreMfKey(file.settings);
  }
  saveSettings();
  const pick = pickCruise(currentId, file.current, last);
  if (pick) openCruise(pick);
  report.boats = Math.max(0, data.boats.value.length - before.boats);
  report.members = Math.max(0, data.members.value.length - before.members);
  report.marks = Math.max(0, data.marks.value.length - before.marks);
  report.crews = Math.max(0, data.crewSets.value.length - before.crews);
  return { count: cruises.length, last, report };
}

/**
 * Merge what another device sent by the synchronisation, quietly: no trace
 * stopped, the open cruise stays the open one, the settings and the keys of
 * this device are left as they are.
 * @param file - The data of the other device.
 * @param tracked - The cruise whose track is being recorded here: its track
 * points wait for the end of the recording.
 */
export function mergeSynced(file: BackupFile, tracked?: string): void {
  const currentId = state.data.cruise.peek()?.id;
  for (const { cruise, track, cuts } of cruisesOf(file)) {
    mergeCruise(cruise, cruise.id === tracked ? [] : track);
    restoreTraceCuts(cruise.id, cuts);
  }
  mergeTraceNames(file.traceNames);
  mergeTraceVoyages(file.traceVoyages);
  mergeSiteLinks(file.siteLinks);
  restoreRecords(file);
  // Saving a merged cruise marks it current: the open one stays so.
  if (currentId) store.set('ldb.current', currentId);
  else store.del('ldb.current');
}

function cruisesOf(
  file: BackupFile,
): Array<{ cruise: Cruise; track: unknown; cuts?: unknown }> {
  const list = file.all
    ? file.cruises
    : [{ cruise: file.cruise, track: file.track }];
  const cruises: Array<{ cruise: Cruise; track: unknown; cuts?: unknown }> = [];
  for (const item of (list ?? []) as Array<{
    cruise?: Cruise;
    track?: unknown;
    cuts?: unknown;
  } | null>) {
    if (item?.cruise?.id && Array.isArray(item.cruise.entries)) {
      cruises.push({ cruise: item.cruise, track: item.track, cuts: item.cuts });
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
  if (file.routes) mergeRoutes(file.routes);
  if (file.routings) mergeRoutings(file.routings);
  if (file.voyages) mergeVoyages(file.voyages);
  if (Array.isArray(file.sosLogs)) restoreSosLogs(file);
  mergeAlerts(file.alerts);
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
}

function restoreCrewSets(received: ReadonlyArray<CrewSet | null>): void {
  const stamp = (set: CrewSet) => set.mod || set.at || '';
  updateCrewSets((sets) => {
    for (const set of received) {
      if (!set?.id) continue;
      if (set._sig === undefined) set._sig = crewSig(set);
      const at = sets.findIndex((known) => known.id === set.id);
      if (at === -1) sets.push(set);
      // Changed later on the other device: its version replaces this one.
      else if (stamp(set) > stamp(sets[at] as CrewSet)) sets[at] = set;
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

/**
 * The keys of a backup (Météo-France, AEMET, Met Office) come back on a
 * device that has none,
 * whatever else the device keeps of its own settings.
 * @param received - Settings of the backup.
 */
export function restoreMfKey(received: Partial<Settings> | undefined): void {
  // The keys of the networks, each one when the device has none.
  for (const name of [
    'mfKey',
    'aemetKey',
    'metOfficeKey',
    'frostKey',
    'githubKey',
  ] as const) {
    const key = received?.windAlert?.[name];
    if (typeof key !== 'string' || !key) continue;
    updateSettings((settings) => {
      if (settings.windAlert?.[name]) return;
      settings.windAlert = { ...settings.windAlert, [name]: key };
    });
  }
}
