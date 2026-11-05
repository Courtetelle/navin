import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { vi } from 'vitest';

import { store } from '../../storage/store.ts';

/** Keys written at boot by other domains (app icon, tips, MOB procedures). */
export const SHELL_KEYS = [
  'ldb.iconData',
  'ldb.tipIdx',
  'ldb.mob2',
  'ldb.mob2mer',
];

/**
 * Same clock and random sequence as the parity harness (2026-07-15 10:30 Zurich, LCG seeded 42).
 */
export function useHarnessWorld(): void {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-07-15T10:30:00+02:00'));
  let seed = 42;
  vi.spyOn(Math, 'random').mockImplementation(() => {
    seed = (seed * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    return seed / 4_294_967_296;
  });
}

/** Restore the real clock and random. */
export function leaveHarnessWorld(): void {
  vi.useRealTimers();
  vi.restoreAllMocks();
}

/**
 * A fixture of scripts/parity/fixtures, without the keys of other domains,
 * as the harness seeds it (strings as-is, other values JSON-encoded).
 * @param name - Fixture name.
 * @returns key → stored text.
 */
export function readFixture(name: string): Record<string, string> {
  const path = join(
    import.meta.dirname,
    '../../../scripts/parity/fixtures',
    `${name}.json`,
  );
  const fixture = JSON.parse(readFileSync(path, 'utf8')) as Record<
    string,
    unknown
  >;
  const seed: Record<string, string> = {};
  for (const [key, value] of Object.entries(fixture)) {
    if (SHELL_KEYS.includes(key)) continue;
    seed[key] = typeof value === 'string' ? value : JSON.stringify(value);
  }
  return seed;
}

/**
 * The current storage content.
 * @returns key → stored text.
 */
export function rawStorage(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of store.keys()) out[key] = store.raw(key) ?? '';
  return out;
}

/**
 * Parse a stored text like `store.get` (the text itself when not JSON).
 * @param text - Stored text.
 * @returns The value.
 */
export function parseStored(text: string | undefined): unknown {
  try {
    return JSON.parse(text ?? '') as unknown;
  } catch {
    return text;
  }
}
