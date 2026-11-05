import { expect, test } from 'vitest';

import { ascContours } from '../bathyContours.ts';
import { dpSimplifyXY, lv95ToWgs } from '../bathyGeometry.ts';
import { ContourBuilder, marchRow } from '../bathyMarching.ts';

function gridFile(text: string) {
  const bytes = new TextEncoder().encode(text);
  return {
    name: 'grid.asc',
    size: bytes.length,
    stream: () =>
      new ReadableStream<Uint8Array>({
        start(controller) {
          const middle = Math.floor(bytes.length / 2);
          controller.enqueue(bytes.subarray(0, middle));
          controller.enqueue(bytes.subarray(middle));
          controller.close();
        },
      }),
  };
}

test('lv95ToWgs converts the origin of the Swiss grid', () => {
  const [lat, lon] = lv95ToWgs(2_600_000, 1_200_000);
  expect(lat).toBeCloseTo(46.951_08, 4);
  expect(lon).toBeCloseTo(7.438_64, 4);
});

test('dpSimplifyXY keeps the corners', () => {
  expect(
    dpSimplifyXY(
      [
        [0, 0],
        [5, 0.1],
        [10, 0],
        [10, 10],
      ],
      1,
    ),
  ).toStrictEqual([
    [0, 0],
    [10, 0],
    [10, 10],
  ]);
});

test('marchRow joins the segments of a level into one line', () => {
  const builder = new ContourBuilder();
  const north = new Float32Array([0, 0, 0]);
  const middle = new Float32Array([2, 2, 2]);
  marchRow(builder, north, middle, 1, 3);
  const lines = builder.lines.filter((line) => !line.dead);
  expect(lines.map((line) => line.d)).toStrictEqual([1, 2]);
  expect(lines[0]?.pts).toStrictEqual([
    [0, 0.5],
    [1, 0.5],
    [2, 0.5],
  ]);
});

test('marchRow ignores the cells without data', () => {
  const builder = new ContourBuilder();
  marchRow(
    builder,
    new Float32Array([0, Number.NaN]),
    new Float32Array([2, 2]),
    1,
    2,
  );
  expect(builder.lines).toStrictEqual([]);
});

test('ascContours reads a stream cut in the middle of a number', async () => {
  const rows: string[] = [];
  for (let row = 0; row < 40; row++) {
    rows.push(Array.from({ length: 40 }, () => row / 10).join(' '));
  }
  const header =
    'ncols 40\nnrows 40\nxllcorner 2530000\nyllcorner 1150000\ncellsize 2\nNODATA_value -9999\n';
  const progress: number[] = [];
  const lines = await ascContours(
    gridFile(`${header}${rows.join('\n')}\n`),
    (ratio) => progress.push(ratio),
    1,
  );
  expect(progress.at(-1)).toBe(1);
  expect(lines.map((line) => line[0])).toStrictEqual([1, 2, 3]);
  expect(lines[0]?.length).toBe(5);
});

test('ascContours refuses a file without header', async () => {
  await expect(ascContours(gridFile(`bad${'x'.repeat(5000)}`))).rejects.toThrow(
    'En-tête ESRI ASCII introuvable',
  );
});
