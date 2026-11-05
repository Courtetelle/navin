import { dpSimplifyXY, lv95ToWgs } from './bathyGeometry.ts';
import { ContourBuilder, marchRow } from './bathyMarching.ts';

/** Mean level of Lake Geneva in metres: depth = level − altitude of the bottom. */
const LAKE_LEVEL = 372;
/** Characters of a header before giving up. */
const MAX_HEADER = 4096;

/** What `ascContours` reads: a file, or an entry of a zip. */
export interface AscSource {
  name: string;
  size: number;
  stream: () => ReadableStream<Uint8Array>;
}

/** Progress of a reading: ratio read, row reached, rows in all. */
export type AscProgress = (ratio: number, row: number, rows: number) => void;

interface GridHeader {
  columns: number;
  rows: number;
  xCorner: number;
  yCorner: number;
  cell: number;
  noData: number;
}

/**
 * Read an ESRI ASCII grid as a stream and compute its contours from 1 to 5 m
 * (legacy `ascContours`). The file is too big for memory: the numbers are read
 * character by character and only two rows are kept.
 * @param source - The grid.
 * @param onProgress - Told after every chunk.
 * @param step - Keep one cell out of `step` in both directions.
 * @returns Lines `[depth, lat, lon, lat, lon, …]`.
 */
export async function ascContours(
  source: AscSource,
  onProgress?: AscProgress,
  step = 2,
): Promise<number[][]> {
  const reader = source.stream().getReader();
  const decoder = new TextDecoder();
  const builder = new ContourBuilder();
  const grid = new GridReader(builder, step);
  let header: GridHeader | null = null;
  let headerText = '';
  const fields: Record<string, number> = {};
  let read = 0;
  for (;;) {
    // eslint-disable-next-line no-await-in-loop -- a stream is read chunk after chunk
    const { value, done } = await reader.read();
    if (done) break;
    read += value.length;
    let text = decoder.decode(value, { stream: true });
    if (!header) {
      headerText += text;
      headerText = readHeaderFields(headerText, fields);
      if (/^\s*[a-z]/i.test(headerText) || !fields.ncols || !fields.nrows) {
        if (headerText.length > MAX_HEADER) {
          throw new Error('En-tête ESRI ASCII introuvable');
        }
        continue;
      }
      header = toHeader(fields);
      grid.start(header);
      text = headerText;
      headerText = '';
    }
    grid.parse(text);
    onProgress?.(read / source.size, grid.row, header.rows);
  }
  grid.flush();
  return header ? toWgsLines(builder, header, step) : [];
}

function readHeaderFields(
  text: string,
  fields: Record<string, number>,
): string {
  const pattern = /^\s*(?<key>[a-z_]+)\s+(?<value>\S+)[ \t]*\r?\n/i;
  let rest = text;
  let match = pattern.exec(rest);
  while (match?.groups) {
    fields[(match.groups.key as string).toLowerCase()] = Number(
      match.groups.value,
    );
    rest = rest.slice(match[0].length);
    match = pattern.exec(rest);
  }
  return rest;
}

function toHeader(fields: Record<string, number>): GridHeader {
  const cell = fields.cellsize as number;
  return {
    columns: fields.ncols as number,
    rows: fields.nrows as number,
    cell,
    xCorner: fields.xllcorner ?? (fields.xllcenter as number) - cell / 2,
    yCorner: fields.yllcorner ?? (fields.yllcenter as number) - cell / 2,
    noData: fields.nodata_value ?? -9999,
  };
}

/** Number parser and row keeper of the grid body. */
class GridReader {
  row = 0;
  private header: GridHeader | null = null;
  private width = 0;
  private current: Float32Array = new Float32Array(0);
  private previous: Float32Array | null = null;
  private column = 0;
  private keptRow = -1;
  /** `alt` altitude, `neg` negative depth, `pos` depth. */
  private mode: 'alt' | 'neg' | 'pos' | null = null;
  private value = 0;
  private negative = false;
  private fraction = 0;
  private inNumber = false;
  private dot = false;
  private exponent = false;

  constructor(
    private readonly builder: ContourBuilder,
    private readonly step: number,
  ) {}

  start(header: GridHeader): void {
    this.header = header;
    this.width = Math.ceil(header.columns / this.step);
    this.current = new Float32Array(this.width);
  }

  parse(text: string): void {
    for (let index = 0; index < text.length; index++) {
      const code = text.codePointAt(index) as number;
      if (code >= 48 && code <= 57) {
        if (this.exponent) continue;
        this.inNumber = true;
        this.value = this.value * 10 + (code - 48);
        if (this.dot) this.fraction *= 10;
      } else if (code === 46) {
        this.dot = true;
        this.fraction = 1;
        this.inNumber = true;
      } else if (code === 45) {
        if (!this.exponent) this.negative = true;
      } else if (code === 101 || code === 69) {
        this.exponent = true;
      } else {
        this.flush();
      }
    }
  }

  flush(): void {
    if (!this.inNumber) return;
    let number = this.dot ? this.value / this.fraction : this.value;
    if (this.negative) number = -number;
    this.push(number);
    this.value = 0;
    this.negative = false;
    this.fraction = 0;
    this.inNumber = false;
    this.dot = false;
    this.exponent = false;
  }

  private push(number: number): void {
    const header = this.header as GridHeader;
    if (this.row % this.step === 0 && this.column % this.step === 0) {
      let depth = Number.NaN;
      if (number !== header.noData && number > -9000) {
        this.mode ??= modeOf(number);
        if (this.mode === 'alt') depth = LAKE_LEVEL - number;
        else depth = this.mode === 'neg' ? -number : number;
      }
      this.current[this.column / this.step] = depth;
    }
    this.column++;
    if (this.column !== header.columns) return;
    if (this.row % this.step === 0) {
      this.keptRow++;
      if (this.previous) {
        marchRow(
          this.builder,
          this.previous,
          this.current,
          this.keptRow,
          this.width,
        );
      }
      const spare = this.previous ?? new Float32Array(this.width);
      this.previous = this.current;
      this.current = spare;
    }
    this.column = 0;
    this.row++;
  }
}

function modeOf(number: number): 'alt' | 'neg' | 'pos' {
  if (number > 100) return 'alt';
  return number < 0 ? 'neg' : 'pos';
}

// Grid to LV95 to WGS84, simplified to 3 m, without the noise under 40 m.
function toWgsLines(
  builder: ContourBuilder,
  header: GridHeader,
  step: number,
): number[][] {
  const { cell, rows, xCorner, yCorner } = header;
  const lines: number[][] = [];
  const tolerance = Math.max(3, cell * step * 0.75);
  for (const line of builder.lines) {
    if (line.dead || line.pts.length < 4) continue;
    const metres: Array<[number, number]> = [];
    for (const [gridX, gridY] of line.pts) {
      metres.push([
        xCorner + (gridX * step + 0.5) * cell,
        yCorner + (rows - (gridY * step + 0.5)) * cell,
      ]);
    }
    let length = 0;
    for (let index = 1; index < metres.length; index++) {
      const [fromX, fromY] = metres[index - 1] as [number, number];
      const [toX, toY] = metres[index] as [number, number];
      length += Math.hypot(toX - fromX, toY - fromY);
    }
    if (length < 40) continue;
    const record = [line.d];
    for (const [east, north] of dpSimplifyXY(metres, tolerance)) {
      const [lat, lon] = lv95ToWgs(east, north);
      record.push(Math.round(lat * 1e5) / 1e5, Math.round(lon * 1e5) / 1e5);
    }
    lines.push(record);
  }
  return lines;
}
