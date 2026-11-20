/**
 * The weather keys follow the synchronisation, inside its encrypted pack:
 * a key entered (or erased) on one device comes to the others. The newest
 * change wins. The relay address and the key of the synchronisation itself
 * never travel this way: without them nothing could be read.
 */

import { state, updateSettings } from '../../state/index.ts';
import { store } from '../../storage/store.ts';

import { hashName } from './syncCrypto.ts';

/** The weather keys carried, by their setting. */
export const SYNC_KEYS = [
  'mfKey',
  'aemetKey',
  'metOfficeKey',
  'frostKey',
] as const;
type SyncedKey = (typeof SYNC_KEYS)[number];

/** A key as it travels: its value and when it was last changed. */
export type KeysPack = Partial<Record<SyncedKey, { v: string; at: number }>>;

/** When each key last changed here, by a short hash of its value. */
type Stamps = Partial<Record<SyncedKey, { sum: string; at: number }>>;

const STAMPS = 'ldb.syncKeysAt';

function valueOf(name: SyncedKey): string {
  const value = state.preferences.settings.peek().windAlert?.[name];
  return typeof value === 'string' ? value : '';
}

async function sumOf(value: string): Promise<string> {
  return value ? hashName(value, 'key', 16) : '';
}

/**
 * Note the keys changed here since the last round (a key never stamped and
 * empty counts as never changed, so that it does not erase the others).
 * @returns When done.
 */
export async function stampKeys(): Promise<void> {
  const stamps = store.get<Stamps>(STAMPS, {});
  for (const name of SYNC_KEYS) {
    // eslint-disable-next-line no-await-in-loop -- four short hashes
    const sum = await sumOf(valueOf(name));
    const old = stamps[name];
    if (old?.sum === sum) continue;
    stamps[name] = { sum, at: old || sum ? Date.now() : 0 };
  }
  store.set(STAMPS, stamps);
}

/**
 * The keys of this device, for its pack.
 * @returns Each key with its time.
 */
export function keysOfDevice(): KeysPack {
  const stamps = store.get<Stamps>(STAMPS, {});
  const pack: KeysPack = {};
  for (const name of SYNC_KEYS) {
    const at = stamps[name]?.at ?? 0;
    if (at > 0) pack[name] = { v: valueOf(name), at };
  }
  return pack;
}

/**
 * Take the keys of another device changed after those of this one.
 * @param keys - The keys of its pack.
 * @returns When done.
 */
export async function takeKeys(keys: KeysPack | undefined): Promise<void> {
  if (!keys) return;
  const stamps = store.get<Stamps>(STAMPS, {});
  const taken: Partial<Record<SyncedKey, string>> = {};
  for (const name of SYNC_KEYS) {
    const sent = keys[name];
    if (!sent || typeof sent.v !== 'string' || !(sent.at > 0)) continue;
    if (sent.at <= (stamps[name]?.at ?? 0)) continue;
    taken[name] = sent.v;
    // eslint-disable-next-line no-await-in-loop -- four short hashes
    stamps[name] = { sum: await sumOf(sent.v), at: sent.at };
  }
  store.set(STAMPS, stamps);
  if (Object.keys(taken).length === 0) return;
  updateSettings((settings) => {
    const next = { ...settings.windAlert };
    for (const [name, value] of Object.entries(taken)) {
      if (value) next[name as SyncedKey] = value;
      else Reflect.deleteProperty(next, name);
    }
    settings.windAlert = next;
  });
}
