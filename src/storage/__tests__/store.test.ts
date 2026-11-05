import { afterEach, expect, test, vi } from 'vitest';

import { attachErrorLog, noteError } from '../errLog.ts';
import { createMemoryStorage } from '../memoryStorage.ts';
import {
  STORE_FULL_MESSAGE,
  setStorageBackend,
  setStoreFullHandler,
  store,
} from '../store.ts';

afterEach(() => {
  setStorageBackend(undefined);
  setStoreFullHandler(null);
});

const context = { version: () => 'v453', view: () => 'tracker' };

test('reads never throw and fall back on damaged or missing values', () => {
  setStorageBackend(
    createMemoryStorage({
      'ldb.ok': { a: 1 },
      'ldb.bad': '{not json',
      'ldb.text': 'plain',
    }),
  );
  expect(store.get('ldb.ok', null)).toStrictEqual({ a: 1 });
  expect(store.get('ldb.bad', 'fallback')).toBe('fallback');
  expect(store.get('ldb.missing', 3)).toBe(3);
  expect(store.raw('ldb.text')).toBe('plain');
  setStorageBackend(null);
  expect(store.get('ldb.ok', 'blocked')).toBe('blocked');
  expect(store.raw('ldb.ok')).toBeNull();
  expect(store.keys()).toStrictEqual([]);
});

test('arr keeps only plain objects and survives a failing fix', () => {
  setStorageBackend(
    createMemoryStorage({
      'ldb.list': [{ id: 'a' }, 3, null, [1], 'x', { id: 'b' }],
      'ldb.notList': { id: 'c' },
    }),
  );
  expect(store.arr('ldb.list')).toStrictEqual([{ id: 'a' }, { id: 'b' }]);
  expect(store.arr('ldb.notList')).toStrictEqual([]);
  const fixed = store.arr<{ id: string; n?: number }>('ldb.list', (item) => {
    if (item.id === 'b') throw new Error('broken');
    item.n = 1;
    return item;
  });
  expect(fixed).toStrictEqual([{ id: 'a', n: 1 }, { id: 'b' }]);
});

test('a refused write reports the full memory and returns false', () => {
  const messages: string[] = [];
  setStoreFullHandler((message) => messages.push(message));
  setStorageBackend(createMemoryStorage({}, { quota: 20 }));
  expect(store.set('ldb.a', 'short')).toBe(true);
  expect(store.set('ldb.big', 'x'.repeat(50))).toBe(false);
  expect(messages).toStrictEqual([STORE_FULL_MESSAGE]);
  expect(store.setRaw('ldb.big', 'x'.repeat(50))).toBe(false);
  expect(messages).toHaveLength(1);
  store.del('ldb.a');
  expect(store.keys()).toStrictEqual([]);
});

test('the error log keeps the 50 last errors', () => {
  const backend = createMemoryStorage();
  setStorageBackend(backend);
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-07-15T08:30:00.000Z'));
  for (let count = 0; count < 52; count++) {
    noteError(`error ${count}`, 'app.js:1', context);
  }
  noteError('x'.repeat(400), { toString: () => 'object source' }, context);
  vi.useRealTimers();
  const log = JSON.parse(backend.getItem('ldb.errLog') ?? '[]') as Array<{
    msg: string;
    src: string;
  }>;
  expect(log).toHaveLength(50);
  expect(log[0]).toStrictEqual({
    t: '2026-07-15T08:30:00.000Z',
    v: 'v453',
    view: 'tracker',
    msg: 'error 3',
    src: 'app.js:1',
  });
  expect(log.at(-1)?.msg).toHaveLength(300);
  expect(log.at(-1)?.src).toBe('[object Object]');
});

test('attachErrorLog records window errors and rejections', () => {
  const backend = createMemoryStorage();
  setStorageBackend(backend);
  const target = new EventTarget() as unknown as Window;
  const detach = attachErrorLog(target, context);
  const error = new Event('error') as ErrorEvent;
  Object.assign(error, {
    message: 'boom',
    filename: 'http://localhost/src/app.js',
    lineno: 12,
  });
  target.dispatchEvent(error);
  const rejection = new Event('unhandledrejection') as PromiseRejectionEvent;
  Object.assign(rejection, { reason: { message: 'refused' } });
  target.dispatchEvent(rejection);
  detach();
  target.dispatchEvent(error);
  const log = JSON.parse(backend.getItem('ldb.errLog') ?? '[]') as Array<{
    msg: string;
    src: string;
  }>;
  expect(log.map((item) => [item.msg, item.src])).toStrictEqual([
    ['boom', 'app.js:12'],
    ['refused', 'promise'],
  ]);
});
