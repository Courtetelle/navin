import { expect, test } from 'vitest';

import { zipAscEntries } from '../bathyZip.ts';

interface Member {
  name: string;
  content: string;
}

function u16(value: number): number[] {
  return [value & 0xff, (value >> 8) & 0xff];
}

function u32(value: number): number[] {
  return [...u16(value & 0xff_ff), ...u16((value >>> 16) & 0xff_ff)];
}

function bytes(text: string): number[] {
  return [...new TextEncoder().encode(text)];
}

/** A zip of stored (uncompressed) members. */
function zipOf(members: readonly Member[]): File {
  const body: number[] = [];
  const directory: number[] = [];
  for (const { name, content } of members) {
    const offset = body.length;
    const nameBytes = bytes(name);
    const data = bytes(content);
    const sizes = [...u32(0), ...u32(data.length), ...u32(data.length)];
    const local = [...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0)];
    body.push(
      ...u32(0x04_03_4b_50),
      ...local,
      ...sizes,
      ...u16(nameBytes.length),
      ...u16(0),
      ...nameBytes,
      ...data,
    );
    directory.push(
      ...u32(0x02_01_4b_50),
      ...u16(20),
      ...local,
      ...sizes,
      ...u16(nameBytes.length),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u32(0),
      ...u32(offset),
      ...nameBytes,
    );
  }
  const end = [
    ...u32(0x06_05_4b_50),
    ...u16(0),
    ...u16(0),
    ...u16(members.length),
    ...u16(members.length),
    ...u32(directory.length),
    ...u32(body.length),
    ...u16(0),
  ];
  return new File([new Uint8Array([...body, ...directory, ...end])], 'a.zip');
}

async function read(stream: ReadableStream<Uint8Array>): Promise<string> {
  return new Response(stream).text();
}

test('zipAscEntries lists the grids and skips the other members', async () => {
  const entries = await zipAscEntries(
    zipOf([
      { name: 'dossier/leman.asc', content: 'ncols 2' },
      { name: 'notice.pdf', content: 'pdf' },
      { name: '__MACOSX/._leman.asc', content: 'meta' },
      { name: 'grille.TXT', content: 'nrows 3' },
    ]),
  );
  expect(entries.map((entry) => [entry.name, entry.size])).toStrictEqual([
    ['leman.asc', 7],
    ['grille.TXT', 7],
  ]);
  expect(await read((entries[0] as (typeof entries)[0]).stream())).toBe(
    'ncols 2',
  );
  expect(await read((entries[1] as (typeof entries)[0]).stream())).toBe(
    'nrows 3',
  );
});

test('zipAscEntries refuses a file that is not a zip', async () => {
  await expect(
    zipAscEntries(new File(['x'.repeat(100)], 'a.zip')),
  ).rejects.toThrow('Zip illisible');
});
