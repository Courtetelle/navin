import { beforeEach, expect, test } from 'vitest';

import { createMemoryStorage } from '../../storage/memoryStorage.ts';
import {
  endTraceVoyage,
  initState,
  mergeTraceVoyages,
  setTraceVoyage,
  startTraceVoyage,
  traceVoyageOf,
  traceVoyages,
} from '../index.ts';

beforeEach(() => {
  initState(createMemoryStorage({}));
});

test('a trace recorded while an outing is active is classed in it', () => {
  startTraceVoyage('c1', 1000_000, 'out1');
  // During the recording, already in the outing.
  expect(traceVoyageOf('c1', 1000_500)).toBe('out1');
  // An older trace of the same navigation is not.
  expect(traceVoyageOf('c1', 10_000)).toBeUndefined();
  endTraceVoyage([10_000, 1000_500]);
  expect(traceVoyageOf('c1', 1000_500)).toBe('out1');
  expect(traceVoyageOf('c1', 10_000)).toBeUndefined();
});

test('no active outing, nothing is classed', () => {
  startTraceVoyage('c1', 1000, null);
  endTraceVoyage([1000]);
  expect(traceVoyageOf('c1', 1000)).toBeUndefined();
});

test('a trace moved, or taken out, keeps that choice', () => {
  setTraceVoyage('c1', 5, 'v2');
  expect(traceVoyageOf('c1', 5)).toBe('v2');
  setTraceVoyage('c1', 5, undefined);
  expect(traceVoyageOf('c1', 5)).toBe('');
});

test('the latest change of another device wins', () => {
  setTraceVoyage('c1', 5, 'v2');
  const mine = traceVoyages()['c1@5'];
  mergeTraceVoyages({ 'c1@5': { v: 'old', at: '2000-01-01T00:00:00.000Z' } });
  expect(traceVoyageOf('c1', 5)).toBe('v2');
  mergeTraceVoyages({ 'c1@5': { v: 'v3', at: '2999-01-01T00:00:00.000Z' } });
  expect(traceVoyageOf('c1', 5)).toBe('v3');
  expect(mine?.v).toBe('v2');
});
