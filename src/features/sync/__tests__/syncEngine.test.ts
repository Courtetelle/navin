import { afterAll, beforeAll, expect, test } from 'vitest';

import relay from '../../../../proxy/navin-relay.js';
import { state, updateMembers, updateSettings } from '../../../state/index.ts';
import { createMemoryStorage } from '../../../storage/memoryStorage.ts';
import { setStorageBackend } from '../../../storage/store.ts';
import { aesKey, hashName, newSyncKey, seal, unseal } from '../syncCrypto.ts';
import { syncDevice, syncRound, syncStatus } from '../syncEngine.ts';

const RELAY = 'https://relay.test';
const kv = new Map<string, string>();
const key = newSyncKey();

beforeAll(() => {
  setStorageBackend(createMemoryStorage());
  const env = {
    NAVIN: {
      get: async (name: string) => kv.get(name) ?? null,
      put: async (name: string, value: string) => {
        kv.set(name, value);
      },
    },
  };
  globalThis.fetch = async (url, init) =>
    relay.fetch(
      new Request(url instanceof Request ? url.url : url.toString(), {
        method: init?.method,
        body: init?.body,
        headers: { Origin: 'http://localhost:11106' },
      }),
      env,
    );
  updateSettings((settings) => {
    settings.windAlert = {
      relayUrl: RELAY,
      syncKey: key,
      mfKey: 'SECRET-MF-KEY',
    };
  });
  updateMembers((members) => {
    members.push(
      { id: 'm1', prenom: 'Léa', nom: 'Rochat' },
      { id: 'm2', prenom: 'Marc', nom: 'Muller' },
    );
  });
});

afterAll(() => {
  setStorageBackend(undefined);
});

const ids = () => state.data.members.peek().map((member) => member.id);

/** The pack this device left on the relay. */
async function packOf(): Promise<Record<string, unknown>> {
  const space = await hashName(key, 'space');
  const sealed = kv.get(`sync:${space}:dev:${syncDevice()}`) ?? '';
  return JSON.parse(await unseal(await aesKey(key), sealed)) as Record<
    string,
    unknown
  >;
}

test('a device leaves its data encrypted, without its keys', async () => {
  await syncRound(true);

  expect(syncStatus.peek().kind).toBe('idle');
  const stored = [...kv.values()].join(' ');

  expect(stored).not.toContain('Rochat');
  expect(stored).not.toContain('SECRET-MF-KEY');
  const pack = await packOf();

  expect(pack.settings).toBeUndefined();
  expect((pack.members as Array<{ id: string }>).map((m) => m.id)).toEqual([
    'm1',
    'm2',
  ]);
});

test('what another device sent comes in, what it deleted goes away', async () => {
  const space = await hashName(key, 'space');
  const fromB = {
    all: true,
    from: 'B',
    cruises: [],
    members: [{ id: 'm3', prenom: 'Zoé', nom: 'Aubert' }],
    gone: { members: { m1: Date.now() } },
    photoNames: {},
  };
  await relay.fetch(
    new Request(`${RELAY}/sync/${space}/dev/B`, {
      method: 'PUT',
      body: await seal(await aesKey(key), JSON.stringify(fromB)),
      headers: { Origin: 'http://localhost:11106' },
    }),
    {
      NAVIN: {
        get: async (name: string) => kv.get(name) ?? null,
        put: async (name: string, value: string) => {
          kv.set(name, value);
        },
      },
    },
  );
  await syncRound(true);

  expect(ids()).toEqual(['m2', 'm3']);
});

test('what is deleted here is told to the others', async () => {
  updateMembers((members) => {
    members.splice(
      members.findIndex((member) => member.id === 'm2'),
      1,
    );
  });
  await syncRound(true);
  const pack = await packOf();

  expect(Object.keys((pack.gone as { members: object }).members)).toEqual(
    expect.arrayContaining(['m1', 'm2']),
  );
  expect((pack.members as Array<{ id: string }>).map((m) => m.id)).toEqual([
    'm3',
  ]);
});
