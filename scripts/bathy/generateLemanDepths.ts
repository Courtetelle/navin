/*
 * Computes the depth data of Lake Geneva shipped with the app, from the
 * swissBATHY3D grid (data.geo.admin.ch, collection ch.swisstopo.swissbathy3d,
 * asset esriasciigrid: tiles of 1 km, cells of 2 m):
 * - public/leman-depth/<east>_<north>.bin: the shallow cells, for the depth alarm;
 * - src/features/map/lemanDepthTiles.json: the list of these tiles;
 * - src/features/map/lemanIsobaths.json: the depth lines to draw, down to 20 m;
 * - src/features/map/lemanIsobathsDeep.json: the deeper lines, for the full layer.
 *
 *   node --max-old-space-size=10000 scripts/bathy/generateLemanDepths.ts <grid.zip>
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

import {
  LAKE_LEVEL,
  toWgsLines,
} from '../../src/features/map/bathyContours.ts';
import {
  ContourBuilder,
  marchRow,
} from '../../src/features/map/bathyMarching.ts';
import {
  DEPTH_DEEP,
  DEPTH_MAX,
  DEPTH_NONE,
  DEPTH_SCALE,
  DEPTH_TILE_CELLS,
} from '../../src/features/map/lemanDepthFormat.ts';

const TILES_DIR = 'public/leman-depth';
const TILES_LIST = 'src/features/map/lemanDepthTiles.json';
const LINES = 'src/features/map/lemanIsobaths.json';
const LEVELS = [1, 2, 3, 4, 5, 10, 15, 20];
/** The lines are drawn from one cell out of this many: 4 m is enough to see. */
const LINE_STEP = 2;
const DEEP_LINES = 'src/features/map/lemanIsobathsDeep.json';
const DEEP_LEVELS = [
  25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160,
  170, 180, 190, 200, 210, 220, 230, 240, 250, 260, 270, 280, 290, 300,
];
/** The deep lines come from one cell out of this many: 10 m is enough there. */
const DEEP_STEP = 5;
const CELL = 2;
const KM_CELLS = 1000 / CELL;
const MAX_BYTES = 64 * 1024 * 1024;

const [zip] = process.argv.slice(2);
if (!zip) throw new Error('usage: generateLemanDepths.ts <grid.zip>');

function tileOf(entry: string): { east: number; north: number } {
  const match = /_(?<east>\d{4})_(?<north>\d{4})\.asc$/i.exec(entry);
  if (!match?.groups) throw new Error(`unexpected tile name: ${entry}`);
  return { east: Number(match.groups.east), north: Number(match.groups.north) };
}

const entries = execFileSync('unzip', ['-Z1', zip], {
  encoding: 'utf8',
  maxBuffer: MAX_BYTES,
})
  .split('\n')
  .filter((name) => /\.asc$/i.test(name));
const eastings = entries.map((name) => tileOf(name).east);
const northings = entries.map((name) => tileOf(name).north);
const westKm = Math.min(...eastings);
const northKm = Math.max(...northings) + 1;
const southKm = Math.min(...northings);
const width = (Math.max(...eastings) + 1 - westKm) * KM_CELLS;
const height = (northKm - southKm) * KM_CELLS;
const grid = new Uint8Array(width * height).fill(DEPTH_NONE);
const deepWidth = Math.ceil(width / DEEP_STEP);
const deepHeight = Math.ceil(height / DEEP_STEP);
const deepGrid = new Float32Array(deepWidth * deepHeight).fill(Number.NaN);

for (const entry of entries) {
  const text = execFileSync('unzip', ['-p', zip, entry], {
    encoding: 'utf8',
    maxBuffer: MAX_BYTES,
  });
  const rows = text.split('\n');
  const fields = new Map<string, number>();
  let first = 0;
  while (fields.size < 6) {
    const [key, value] = (rows[first] as string).trim().split(/\s+/);
    fields.set((key as string).toLowerCase(), Number(value));
    first++;
  }
  const xCorner = fields.get('xllcorner') as number;
  const yCorner = fields.get('yllcorner') as number;
  const rowCount = fields.get('nrows') as number;
  const noData = fields.get('nodata_value') as number;
  const column0 = (xCorner - westKm * 1000) / CELL;
  const row0 = (northKm * 1000 - yCorner) / CELL - rowCount;
  for (let row = 0; row < rowCount; row++) {
    const values = (rows[first + row] ?? '').trim().split(/\s+/);
    for (const [column, value] of values.entries()) {
      const altitude = Number(value);
      if (altitude === noData || altitude < -9000) continue;
      const depth = LAKE_LEVEL - altitude;
      const cellRow = row0 + row;
      const cellColumn = column0 + column;
      if (cellRow % DEEP_STEP === 0 && cellColumn % DEEP_STEP === 0) {
        deepGrid[(cellRow / DEEP_STEP) * deepWidth + cellColumn / DEEP_STEP] =
          depth;
      }
      // Rounded down: the alarm must never see more water than there is.
      grid[(row0 + row) * width + column0 + column] =
        depth > DEPTH_MAX
          ? DEPTH_DEEP
          : Math.max(0, Math.floor(depth * DEPTH_SCALE));
    }
  }
}

// The cells of the alarm, one file per tile holding shallow water.
rmSync(TILES_DIR, { recursive: true, force: true });
mkdirSync(TILES_DIR, { recursive: true });
const kept: string[] = [];
let bytes = 0;
for (const entry of entries) {
  const { east, north } = tileOf(entry);
  const column0 = (east - westKm) * KM_CELLS;
  const row0 = (northKm - north - 1) * KM_CELLS;
  const cells = new Uint8Array(DEPTH_TILE_CELLS * DEPTH_TILE_CELLS);
  let shallow = false;
  for (let row = 0; row < DEPTH_TILE_CELLS; row++) {
    const start = (row0 + row) * width + column0;
    const line = grid.subarray(start, start + DEPTH_TILE_CELLS);
    cells.set(line, row * DEPTH_TILE_CELLS);
    if (line.some((value) => value < DEPTH_DEEP)) shallow = true;
  }
  if (!shallow) continue;
  const file = gzipSync(cells, { level: 9 });
  writeFileSync(`${TILES_DIR}/${east}_${north}.bin`, file);
  bytes += file.length;
  kept.push(`${east}_${north}`);
}
writeFileSync(TILES_LIST, `${JSON.stringify(kept)}\n`);

// The lines to draw.
const builder = new ContourBuilder(LEVELS);
const lineWidth = Math.ceil(width / LINE_STEP);
const lineHeight = Math.ceil(height / LINE_STEP);
const toRow = (row: number) => {
  const depths = new Float32Array(lineWidth);
  const start = row * LINE_STEP * width;
  for (let column = 0; column < lineWidth; column++) {
    const value = grid[start + column * LINE_STEP] as number;
    if (value === DEPTH_NONE) depths[column] = Number.NaN;
    else if (value === DEPTH_DEEP) depths[column] = DEPTH_MAX + 1;
    else depths[column] = value / DEPTH_SCALE;
  }
  return depths;
};
let previous = toRow(0);
for (let row = 1; row < lineHeight; row++) {
  const current = toRow(row);
  marchRow(builder, previous, current, row, lineWidth);
  previous = current;
}
const lines = toWgsLines(
  builder,
  {
    columns: width,
    rows: height,
    xCorner: westKm * 1000,
    yCorner: southKm * 1000,
    cell: CELL,
    noData: Number.NaN,
  },
  LINE_STEP,
);
writeFileSync(LINES, JSON.stringify(lines));

// The deep lines, for the full layer.
const deepBuilder = new ContourBuilder(DEEP_LEVELS);
for (let row = 1; row < deepHeight; row++) {
  marchRow(
    deepBuilder,
    deepGrid.subarray((row - 1) * deepWidth, row * deepWidth),
    deepGrid.subarray(row * deepWidth, (row + 1) * deepWidth),
    row,
    deepWidth,
  );
}
const deepLines = toWgsLines(
  deepBuilder,
  {
    columns: width,
    rows: height,
    xCorner: westKm * 1000,
    yCorner: southKm * 1000,
    cell: CELL,
    noData: Number.NaN,
  },
  DEEP_STEP,
);
writeFileSync(DEEP_LINES, JSON.stringify(deepLines));

let points = 0;
for (const line of lines) points += (line.length - 1) / 2;
process.stdout.write(
  `${kept.length} tiles (${bytes} bytes), ${lines.length} lines, ${points} points\n`,
);
