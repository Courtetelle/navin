import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import {
  OPEN_METEO_KEEP_MS,
  OPEN_METEO_KEEP_NOW_MS,
  OPEN_METEO_PAUSE_MS,
  forgetOpenMeteo,
  openMeteoFetch,
} from '../openMeteo.ts';

let calls: string[];
let status: number;

beforeEach(() => {
  forgetOpenMeteo();
  vi.useFakeTimers({ now: Date.UTC(2026, 10, 20, 12), toFake: ['Date'] });
  calls = [];
  status = 200;
  vi.stubGlobal('fetch', (url: string) => {
    calls.push(url);
    return Promise.resolve(Response.json({ n: calls.length }, { status }));
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const FORECAST = 'https://api.open-meteo.com/v1/forecast?latitude=48.6';
const NOW = 'https://api.open-meteo.com/v1/forecast?latitude=48.6&current=x';

async function bodyOf(url: string): Promise<unknown> {
  const reply = await openMeteoFetch(url);
  return reply.json();
}

async function statusOf(url: string): Promise<number> {
  const reply = await openMeteoFetch(url);
  return reply.status;
}

test('the same forecast is asked once in 30 minutes', async () => {
  expect(await bodyOf(FORECAST)).toStrictEqual({ n: 1 });
  expect(await bodyOf(FORECAST)).toStrictEqual({ n: 1 });
  expect(calls).toHaveLength(1);
  vi.setSystemTime(Date.now() + OPEN_METEO_KEEP_MS);
  expect(await bodyOf(FORECAST)).toStrictEqual({ n: 2 });
});

test('a reading of now is kept 10 minutes only', async () => {
  await openMeteoFetch(NOW);
  vi.setSystemTime(Date.now() + OPEN_METEO_KEEP_NOW_MS);
  await openMeteoFetch(NOW);
  expect(calls).toHaveLength(2);
});

test('after a refusal NavIn waits 10 minutes before asking again', async () => {
  status = 429;
  expect(await statusOf(FORECAST)).toBe(429);
  status = 200;
  expect(await statusOf(NOW)).toBe(429);
  expect(calls).toHaveLength(1);
  vi.setSystemTime(Date.now() + OPEN_METEO_PAUSE_MS);
  expect(await statusOf(NOW)).toBe(200);
  expect(calls).toHaveLength(2);
});

test('a failed reply is not kept', async () => {
  status = 500;
  await openMeteoFetch(FORECAST);
  status = 200;
  expect(await statusOf(FORECAST)).toBe(200);
  expect(calls).toHaveLength(2);
});

test('two pages asking the same forecast at once make one request', async () => {
  const [one, two] = await Promise.all([bodyOf(FORECAST), bodyOf(FORECAST)]);
  expect(one).toStrictEqual({ n: 1 });
  expect(two).toStrictEqual({ n: 1 });
  expect(calls).toHaveLength(1);
});
