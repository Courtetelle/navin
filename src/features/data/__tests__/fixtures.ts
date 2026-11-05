import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { vi } from 'vitest';

import { initState } from '../../../state/index.ts';
import { createMemoryStorage } from '../../../storage/memoryStorage.ts';

/** A localStorage fixture of `scripts/parity/fixtures`. */
export type Fixture = Record<string, unknown>;

/**
 * Read a parity fixture.
 * @param name - File name without extension.
 * @returns The fixture.
 */
export function fixture(name: string): Fixture {
  const path = join(
    import.meta.dirname,
    `../../../../scripts/parity/fixtures/${name}.json`,
  );
  return JSON.parse(readFileSync(path, 'utf8')) as Fixture;
}

/**
 * Load the state from a parity fixture.
 * @param name - File name without extension.
 * @returns The fixture.
 */
export function load(name: string): Fixture {
  const seed = fixture(name);
  initState(createMemoryStorage(seed));
  return seed;
}

/** Same clock as the parity harness (2026-07-15 10:30 Zurich). */
export function useHarnessClock(): void {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-07-15T10:30:00+02:00'));
}
