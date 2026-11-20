/**
 * The automatic synchronisation between the devices of the skipper, through
 * their own relay: each device leaves there all its data, encrypted here,
 * and reads what the others left. What one deletes is deleted on the others.
 * The weather keys travel inside the encrypted pack (newest change wins);
 * the other settings stay on each device, the key of the synchronisation
 * travels by QR only. The menus, without any personal data, are left in
 * clear on the relay for the development of NavIn.
 */

import { signal } from '@preact/signals-react';

import {
  removeBoat,
  removeCruise,
  removeMark,
  removeRoute,
  state,
  takeTracesGone,
  tracesGone,
  updateCrewSets,
  updateMembers,
  updateSosLogs,
  withoutGonePoints,
} from '../../state/index.ts';
import { getPhoto, putPhoto } from '../../storage/photos.ts';
import { store } from '../../storage/store.ts';
import { backupAll } from '../data/backup.ts';
import { menusChanges } from '../data/menusChanges.ts';
import { menusFile } from '../data/menusExport.ts';
import type { BackupFile } from '../data/restoreBackup.ts';
import { mergeSynced } from '../data/restoreBackup.ts';
import { relayAddress } from '../onwater/relayRecord.ts';

import { aesKey, hashName, isSyncKey, seal, unseal } from './syncCrypto.ts';
import type { KeysPack } from './syncKeys.ts';
import { keysOfDevice, stampKeys, takeKeys } from './syncKeys.ts';

/** What the synchronisation is doing, for its screen. */
export interface SyncStatus {
  /** `off` without a key or a relay; `error` says why in `said`. */
  kind: 'off' | 'idle' | 'busy' | 'error';
  /** Words for the screen. */
  said: string;
  /** Last time all went through. */
  at?: number;
}

/** The status, shown in Paramétrages. */
export const syncStatus = signal<SyncStatus>({ kind: 'off', said: '' });

/** The kinds of records whose deletions follow. */
const KINDS = [
  'cruises',
  'members',
  'boats',
  'marks',
  'routes',
  'crewSets',
  'sosLogs',
] as const;
type Kind = (typeof KINDS)[number];

/** What was deleted: per kind, the id and when. */
type Gone = Partial<Record<Kind, Record<string, number>>>;

/** A deletion is remembered this long, then forgotten. */
const GONE_MS = 180 * 24 * 3600 * 1000;
/** Sent at most this often, unless asked (2 writes on the relay each time). */
const SEND_EVERY_MS = 10 * 60 * 1000;
/** Photos sent in one round: the free plan allows 1 000 writes a day. */
const PHOTOS_PER_ROUND = 150;
/** Waited for the relay, then given up until the next round. */
const WAIT_MS = 60_000;

/** The pack a device leaves on the relay, before encryption. */
interface SyncPack extends BackupFile {
  /** The device that sent it. */
  from: string;
  /** What it deleted. */
  gone: Gone;
  /** Its photos: id → name on the relay. */
  photoNames: Record<string, string>;
  /** Its weather keys, each with when it changed. */
  keys?: KeysPack;
  /** The traces it deleted (`cruise|first time|last time` → when). */
  tracesGone?: Record<string, number>;
}

/**
 * The key of the synchronisation, empty without one.
 * @returns The key.
 */
export function syncKey(): string {
  const key = state.preferences.settings.peek().windAlert?.syncKey;
  return isSyncKey(key) ? key : '';
}

/**
 * The synchronisation can run: a key and a relay, and not switched off.
 * @returns Whether it can.
 */
export function syncReady(): boolean {
  return (
    Boolean(syncKey() && relayAddress()) &&
    state.preferences.settings.peek().syncAuto !== false
  );
}

/** A name of this device, made once (shared with the recording). */
export function syncDevice(): string {
  let id = store.get<string>('ldb.deviceId', '');
  if (!id) {
    id = Math.random().toString(36).slice(2, 10);
    store.set('ldb.deviceId', id);
  }
  return id;
}

let running: Promise<void> | null = null;
/** Packs whose track waits for the end of the recording here. */
const waiting = new Map<string, SyncPack>();

/**
 * One round: what was deleted here is noted, what the others sent is merged,
 * then what changed here is sent.
 * @param asked - Touched by the user: sent even if sent a moment ago.
 * @returns When done (never rejects).
 */
export function syncRound(asked = false): Promise<void> {
  running ??= round(asked).finally(() => {
    running = null;
  });
  return running;
}

async function round(asked: boolean): Promise<void> {
  if (!syncReady()) {
    syncStatus.value = { kind: 'off', said: offWhy() };
    return;
  }
  const relay = relayAddress();
  const key = syncKey();
  const before = syncStatus.peek().at;
  try {
    syncStatus.value = {
      kind: 'busy',
      said: 'Synchronisation en cours…',
      at: before,
    };
    const aes = await aesKey(key);
    const space = `${relay}/sync/${await hashName(key, 'space')}`;
    noteDeletions();
    await stampKeys();
    await receive(space, aes);
    noteKnown();
    const photosLeft = await send(space, aes, key, asked);
    // A relay not yet updated has no place for them: the sync goes on.
    await sendMenus(relay).catch(() => undefined);
    syncStatus.value = {
      kind: 'idle',
      said:
        photosLeft > 0
          ? `Synchronisé · encore ${photosLeft} photos à envoyer`
          : 'Synchronisé',
      at: Date.now(),
    };
  } catch (error) {
    syncStatus.value = {
      kind: 'error',
      said: errorText(error),
      at: before,
    };
  }
}

function offWhy(): string {
  if (state.preferences.settings.peek().syncAuto === false) {
    return 'Synchronisation automatique coupée';
  }
  if (!relayAddress()) {
    return 'Il faut d’abord le relais (Clés météos et compte relais)';
  }
  return 'Pas encore de clé de synchronisation sur cet appareil';
}

function errorText(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  if (text.includes('relais 400') || text.includes('relais 403')) {
    return 'Le relais doit être mis à jour : Clés météos et compte relais › « 📋 Copier le code du relais », puis Déployer sur Cloudflare';
  }
  if (text.includes('501')) {
    return 'Le relais n’a pas de stockage « NAVIN » : voir le guide du relais';
  }
  if (text.includes('decrypt') || text.includes('OperationError')) {
    return 'Les données du relais ont une autre clé : partager la clé de cet appareil par QR code';
  }
  return !navigator.onLine
    ? 'Hors connexion : la synchronisation reprendra avec du réseau'
    : `Synchronisation impossible pour l’instant (${text.slice(0, 80)})`;
}

async function ask(url: string, init?: RequestInit): Promise<Response> {
  const answer = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(WAIT_MS),
  });
  if (!answer.ok && answer.status !== 404) {
    throw new Error(`relais ${answer.status}`);
  }
  return answer;
}

/* ---------- What was deleted here ---------- */

function idsOf(kind: Kind): string[] {
  const { data } = state;
  if (kind === 'cruises') return data.index.peek().map((line) => line.id);
  const list = data[kind].peek() as ReadonlyArray<{ id?: string }>;
  return list.map((item) => item.id ?? '').filter(Boolean);
}

function gone(): Gone {
  const kept = store.get<Gone>('ldb.syncGone', {});
  const limit = Date.now() - GONE_MS;
  for (const kind of KINDS) {
    const ids = kept[kind] ?? {};
    for (const [id, at] of Object.entries(ids)) {
      if (at < limit) Reflect.deleteProperty(ids, id);
    }
  }
  return kept;
}

/** What was here at the last round and is no longer: deleted here. */
function noteDeletions(): void {
  const known = store.get<Partial<Record<Kind, string[]>>>('ldb.syncKnown', {});
  const kept = gone();
  const now = Date.now();
  for (const kind of KINDS) {
    const here = new Set(idsOf(kind));
    for (const id of known[kind] ?? []) {
      if (!here.has(id)) kept[kind] = { ...kept[kind], [id]: now };
    }
  }
  store.set('ldb.syncGone', kept);
}

function noteKnown(): void {
  store.set(
    'ldb.syncKnown',
    Object.fromEntries(KINDS.map((kind) => [kind, idsOf(kind)])),
  );
}

/* ---------- What the others sent ---------- */

async function receive(space: string, aes: CryptoKey): Promise<void> {
  const listed = await ask(`${space}/index`);
  const index = (await listed.json()) as Record<string, { at?: number }>;
  const seen = store.get<Record<string, number>>('ldb.syncSeen', {});
  const me = syncDevice();
  for (const [device, { at = 0 }] of Object.entries(index)) {
    if (device === me || at <= (seen[device] ?? 0)) continue;
    // eslint-disable-next-line no-await-in-loop -- one device at a time, in memory once
    const answer = await ask(`${space}/dev/${device}`);
    if (answer.status === 404) continue;
    // eslint-disable-next-line no-await-in-loop -- idem
    const pack = JSON.parse(await unseal(aes, await answer.text())) as SyncPack;
    // eslint-disable-next-line no-await-in-loop -- idem
    await take(space, aes, pack);
    seen[device] = at;
    store.set('ldb.syncSeen', seen);
  }
  // The track of a cruise recorded here is merged once the recording ends.
  if (!state.view.tracking.peek()) {
    for (const [device, pack] of waiting) {
      waiting.delete(device);
      mergeSynced(pack);
    }
  }
}

async function take(
  space: string,
  aes: CryptoKey,
  pack: SyncPack,
): Promise<void> {
  const kept = gone();
  // Deleted there: deleted here. Deleted here: not brought back.
  for (const kind of KINDS) {
    for (const [id, at] of Object.entries(pack.gone?.[kind] ?? {})) {
      kept[kind] = { ...kept[kind], [id]: Math.max(at, kept[kind]?.[id] ?? 0) };
    }
  }
  store.set('ldb.syncGone', kept);
  const tracked = state.view.tracking.peek()
    ? state.data.cruise.peek()?.id
    : undefined;
  deleteHere(kept, tracked);
  // A trace deleted there goes here; deleted here, it does not come back.
  takeTracesGone(pack.tracesGone, tracked);
  const kept2 = withoutGone(pack, kept);
  mergeSynced(kept2, tracked);
  if (tracked) waiting.set(pack.from, kept2);
  await takeKeys(pack.keys);
  await fetchPhotos(space, aes, pack.photoNames ?? {});
}

function deleteHere(kept: Gone, tracked: string | undefined): void {
  const ids = (kind: Kind) => new Set(Object.keys(kept[kind] ?? {}));
  for (const id of ids('cruises')) {
    // The cruise being recorded stays until the recording ends.
    if (id !== tracked && idsOf('cruises').includes(id)) removeCruise(id);
  }
  for (const id of ids('boats')) {
    if (idsOf('boats').includes(id)) removeBoat(id);
  }
  for (const id of ids('marks')) {
    if (idsOf('marks').includes(id)) removeMark(id);
  }
  for (const id of ids('routes')) {
    if (idsOf('routes').includes(id)) removeRoute(id);
  }
  const members = ids('members');
  if (idsOf('members').some((id) => members.has(id))) {
    updateMembers((list) => {
      for (let at = list.length - 1; at >= 0; at--) {
        if (members.has(list[at]?.id ?? '')) list.splice(at, 1);
      }
    });
  }
  const sets = ids('crewSets');
  if (idsOf('crewSets').some((id) => sets.has(id))) {
    updateCrewSets((list) => {
      for (let at = list.length - 1; at >= 0; at--) {
        if (sets.has(list[at]?.id ?? '')) list.splice(at, 1);
      }
    });
  }
  const logs = ids('sosLogs');
  if (idsOf('sosLogs').some((id) => logs.has(id))) {
    updateSosLogs((list) => {
      for (let at = list.length - 1; at >= 0; at--) {
        if (logs.has(list[at]?.id ?? '')) list.splice(at, 1);
      }
    });
  }
}

function withoutGone(pack: SyncPack, kept: Gone): SyncPack {
  const out = (kind: Kind, list: unknown) =>
    Array.isArray(list)
      ? (list as Array<{ id?: string }>).filter(
          (item) => !kept[kind]?.[item?.id ?? ''],
        )
      : list;
  return {
    ...pack,
    cruises: Array.isArray(pack.cruises)
      ? (pack.cruises as Array<{ cruise?: { id?: string }; track?: unknown }>)
          .filter((item) => !kept.cruises?.[item?.cruise?.id ?? ''])
          .map((item) =>
            Array.isArray(item.track)
              ? {
                  ...item,
                  track: withoutGonePoints(item.cruise?.id ?? '', item.track),
                }
              : item,
          )
      : pack.cruises,
    members: out('members', pack.members),
    boats: out('boats', pack.boats),
    marks: out('marks', pack.marks),
    routes: out('routes', pack.routes),
    crewSets: out('crewSets', pack.crewSets),
    sosLogs: out('sosLogs', pack.sosLogs),
  };
}

async function fetchPhotos(
  space: string,
  aes: CryptoKey,
  names: Record<string, string>,
): Promise<void> {
  /* eslint-disable no-await-in-loop -- one photo in memory at a time on a phone */
  for (const [id, name] of Object.entries(names)) {
    if (await getPhoto(id)) continue;
    const answer = await ask(`${space}/ph/${name}`);
    if (answer.status === 404) continue;
    await putPhoto(id, await unseal(aes, await answer.text()));
  }
  /* eslint-enable no-await-in-loop */
}

/* ---------- What is sent from here ---------- */

/** Ids of every photo of this device: cruises, boats, cards, crews. */
function photoIds(pack: SyncPack): string[] {
  const ids: string[] = [];
  for (const { cruise } of (pack.cruises ?? []) as Array<{
    cruise: { photos?: Array<{ id: string }> };
  }>) {
    for (const photo of cruise.photos ?? []) ids.push(photo.id);
  }
  for (const boat of state.data.boats.peek()) {
    for (const key of ['docs', 'photos'] as const) {
      const list = boat[key] as Array<{ id?: string }> | undefined;
      for (const item of list ?? []) if (item?.id) ids.push(item.id);
    }
  }
  for (const member of state.data.members.peek()) {
    const photos = (member.photos ?? []) as Array<{ id: string }>;
    for (const photo of photos) ids.push(photo.id);
  }
  for (const crew of state.data.crewSets.peek()) {
    if (typeof crew.photo === 'string') ids.push(crew.photo);
  }
  return [...new Set(ids)];
}

/**
 * The data of this device as it leaves: its weather keys, but no other
 * setting, no relay, no key of the synchronisation, no password.
 * @returns The pack, before its photo names.
 */
export function packOfDevice(): SyncPack {
  const data = { ...backupAll().data } as Record<string, unknown>;
  for (const kept of ['settings', 'keyBook', 'errLog', 'sosPwd', 'saved']) {
    Reflect.deleteProperty(data, kept);
  }
  return {
    ...(data as BackupFile),
    from: syncDevice(),
    gone: gone(),
    photoNames: {},
    keys: keysOfDevice(),
    tracesGone: tracesGone(),
  };
}

async function send(
  space: string,
  aes: CryptoKey,
  key: string,
  asked: boolean,
): Promise<number> {
  const pack = packOfDevice();
  const ids = photoIds(pack);
  for (const id of ids) {
    // eslint-disable-next-line no-await-in-loop -- small hashes, in order
    pack.photoNames[id] = await hashName(key, `photo:${id}`, 40);
  }
  const photosLeft = await sendPhotos(space, aes, pack.photoNames);
  const text = JSON.stringify(pack);
  const sum = await hashName(text, 'sum');
  const sent = store.get<{ sum?: string; at?: number }>('ldb.syncSent', {});
  const recent = Date.now() - (sent.at ?? 0) < SEND_EVERY_MS;
  if (sum === sent.sum || (recent && !asked)) return photosLeft;
  await ask(`${space}/dev/${syncDevice()}`, {
    method: 'PUT',
    body: await seal(aes, text),
  });
  store.set('ldb.syncSent', { sum, at: Date.now() });
  return photosLeft;
}

/**
 * The menus, in clear (no personal data), on the relay: read from the Mac
 * for the development of NavIn. Sent only when they changed.
 * @param relay - The relay address.
 * @returns When done.
 */
async function sendMenus(relay: string): Promise<void> {
  const file = menusFile();
  const { at: _at, ...kept } = file;
  // With what changed since the last time they were taken into NavIn.
  const menus = { ...kept, changes: menusChanges(file) };
  const text = JSON.stringify(menus);
  const sum = await hashName(text, 'menus', 16);
  if (store.get('ldb.syncMenus', '') === sum) return;
  await ask(`${relay}/menus`, {
    method: 'PUT',
    body: JSON.stringify({ ...menus, at: new Date().toISOString() }),
  });
  store.set('ldb.syncMenus', sum);
}

async function sendPhotos(
  space: string,
  aes: CryptoKey,
  names: Record<string, string>,
): Promise<number> {
  const up = new Set(store.get<string[]>('ldb.syncPhotosUp', []));
  const todo = Object.entries(names).filter(([, name]) => !up.has(name));
  /* eslint-disable no-await-in-loop -- one photo in memory at a time on a phone */
  for (const [id, name] of todo.slice(0, PHOTOS_PER_ROUND)) {
    const photo = await getPhoto(id);
    const text = typeof photo === 'string' ? photo : await asDataUrl(photo);
    if (text) {
      await ask(`${space}/ph/${name}`, {
        method: 'PUT',
        body: await seal(aes, text),
      });
    }
    up.add(name);
    store.set('ldb.syncPhotosUp', [...up]);
  }
  /* eslint-enable no-await-in-loop */
  return Math.max(0, todo.length - PHOTOS_PER_ROUND);
}

async function asDataUrl(photo: unknown): Promise<string> {
  if (!(photo instanceof Blob)) return '';
  return new Promise((done) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      done(typeof reader.result === 'string' ? reader.result : '');
    });
    reader.addEventListener('error', () => {
      done('');
    });
    reader.readAsDataURL(photo);
  });
}
