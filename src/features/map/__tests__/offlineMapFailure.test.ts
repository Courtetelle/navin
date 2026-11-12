import { expect, test } from 'vitest';

import {
  OfflineMapFailure,
  failureText,
  isQuotaError,
  isReadError,
} from '../offlineMapFailure.ts';
import { importOfflineMap } from '../offlineMapStore.ts';

const HEADER_BYTES = 127;
const TILE_TYPE_AT = 99;

/**
 * A PMTiles v3 file holding only a header and an empty root directory.
 * @param tileType - Kind of tiles (1 vector, 2 png, 6 MLT).
 * @returns The file.
 */
function pmtiles(tileType: number): File {
  const bytes = new Uint8Array(HEADER_BYTES + 1);
  const view = new DataView(bytes.buffer);
  bytes.set([0x50, 0x4d, 0x54, 0x69, 0x6c, 0x65, 0x73, 3]); // "PMTiles" v3
  view.setUint32(8, HEADER_BYTES, true); // root directory offset
  view.setUint32(16, 1, true); // root directory length
  bytes[97] = 1; // internal compression: none
  bytes[TILE_TYPE_AT] = tileType;
  return new File([bytes], 'essai.pmtiles');
}

async function failureOf(file: File): Promise<string> {
  try {
    await importOfflineMap(file);
  } catch (error) {
    return error instanceof OfflineMapFailure ? error.kind : 'other';
  }
  return 'none';
}

test('an import says why a file is not a map NavIn can draw', async () => {
  expect(await failureOf(new File(['bonjour'], 'notes.pmtiles'))).toBe(
    'not-pmtiles',
  );
  expect(await failureOf(pmtiles(2))).toBe('raster');
  expect(await failureOf(pmtiles(6))).toBe('format');
  expect(await failureOf(new File([], 'vide.pmtiles'))).toBe('unreadable');
});

test('a file the phone cannot read is told apart from a wrong file', async () => {
  const gone = pmtiles(1);
  Object.defineProperty(gone, 'slice', {
    value: () => ({
      arrayBuffer: () =>
        Promise.reject(new DOMException('gone', 'NotReadableError')),
    }),
  });
  expect(await failureOf(gone)).toBe('unreadable');
});

test('storage and read errors are recognised by their names', () => {
  expect(isQuotaError(new DOMException('x', 'QuotaExceededError'))).toBe(true);
  expect(isQuotaError(new Error('Not enough disk space'))).toBe(true);
  expect(isQuotaError(new Error('Wrong magic number'))).toBe(false);
  expect(isReadError(new DOMException('x', 'NotReadableError'))).toBe(true);
  expect(isReadError(new Error('Wrong magic number'))).toBe(false);
});

test('each failure has its own sentence, with the sizes when known', () => {
  const MB = 1_000_000;
  expect(
    failureText(new OfflineMapFailure('no-room', 420 * MB, 180 * MB)),
  ).toBe(
    'Pas assez de place : la carte fait 420 Mo, il reste 180 Mo pour NavIn',
  );
  expect(failureText(new OfflineMapFailure('no-room', 420 * MB))).toContain(
    '420 Mo',
  );
  expect(failureText(new OfflineMapFailure('raster', 1))).toContain('raster');
  expect(failureText(new OfflineMapFailure('unreadable', 1))).toContain(
    'Sur mon iPhone',
  );
  expect(failureText(new TypeError('x'))).toContain('TypeError');
});
