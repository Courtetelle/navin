/** Depth levels computed, in metres. */
export const ASC_LEVELS = [1, 2, 3, 4, 5];

/** A contour being assembled, in grid coordinates. */
export interface ContourLine {
  d: number;
  pts: Array<[number, number]>;
  head: number;
  tail: number;
  dead?: boolean;
}

/**
 * Sides of a marching square crossed by the level, for each corner mask
 * (0 top, 1 right, 2 bottom, 3 left).
 */
const CASES: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
  [],
  [[3, 2]],
  [[2, 1]],
  [[3, 1]],
  [[0, 1]],
  [
    [3, 0],
    [2, 1],
  ],
  [[0, 2]],
  [[3, 0]],
  [[3, 0]],
  [[0, 2]],
  [
    [0, 1],
    [3, 2],
  ],
  [[0, 1]],
  [[3, 1]],
  [[2, 1]],
  [[3, 2]],
  [],
];

/**
 * Assembles contour segments into lines (`addSeg` of legacy `ascContours`): two
 * segments sharing a grid edge join, a line meeting its own start closes.
 */
export class ContourBuilder {
  readonly lines: ContourLine[] = [];
  private readonly ends = ASC_LEVELS.map(newEnds);

  /**
   * Add a segment.
   * @param level - Index in {@link ASC_LEVELS}.
   * @param firstKey - Key of the first grid edge.
   * @param first - First point.
   * @param secondKey - Key of the second grid edge.
   * @param second - Second point.
   */
  add(
    level: number,
    firstKey: number,
    first: [number, number],
    secondKey: number,
    second: [number, number],
  ): void {
    const ends = this.ends[level] as Map<number, ContourLine>;
    const atFirst = ends.get(firstKey);
    const atSecond = ends.get(secondKey);
    if (!atFirst && !atSecond) {
      const line: ContourLine = {
        d: ASC_LEVELS[level] as number,
        pts: [first, second],
        head: firstKey,
        tail: secondKey,
      };
      ends.set(firstKey, line);
      ends.set(secondKey, line);
      this.lines.push(line);
      return;
    }
    if (atFirst && atSecond) {
      ends.delete(firstKey);
      ends.delete(secondKey);
      join(ends, atFirst, atSecond, firstKey, secondKey);
      return;
    }
    const line = (atFirst ?? atSecond) as ContourLine;
    const keyIn = atFirst ? firstKey : secondKey;
    const keyOut = atFirst ? secondKey : firstKey;
    const pointOut = atFirst ? second : first;
    ends.delete(keyIn);
    if (line.head === keyIn) flip(line);
    line.pts.push(pointOut);
    line.tail = keyOut;
    ends.set(keyOut, line);
  }
}

/**
 * Marching squares between two kept rows (north `previous`, south `current`).
 * @param builder - Receives the segments.
 * @param previous - Depths of the row to the north.
 * @param current - Depths of the row to the south.
 * @param row - Rank of the south row among the kept rows.
 * @param width - Columns kept.
 */
export function marchRow(
  builder: ContourBuilder,
  previous: Float32Array,
  current: Float32Array,
  row: number,
  width: number,
): void {
  for (let column = 0; column < width - 1; column++) {
    const a = previous[column] as number;
    const b = previous[column + 1] as number;
    const c = current[column + 1] as number;
    const d = current[column] as number;
    // A missing depth is NaN: nothing is guessed around it.
    if (Number.isNaN(a + b + c + d)) continue;
    for (let level = 0; level < ASC_LEVELS.length; level++) {
      const depth = ASC_LEVELS[level] as number;
      const mask =
        (a >= depth ? 8 : 0) |
        (b >= depth ? 4 : 0) |
        (c >= depth ? 2 : 0) |
        (d >= depth ? 1 : 0);
      for (const [from, to] of CASES[mask] ?? []) {
        builder.add(
          level,
          edgeKey(from, row, column, width),
          edgePoint(from, row, column, depth, [a, b, c, d]),
          edgeKey(to, row, column, width),
          edgePoint(to, row, column, depth, [a, b, c, d]),
        );
      }
    }
  }
}

function newEnds(): Map<number, ContourLine> {
  return new Map();
}

function edgeKey(
  edge: number,
  row: number,
  column: number,
  width: number,
): number {
  if (edge === 0) return ((row - 1) * width + column) * 2;
  if (edge === 2) return (row * width + column) * 2;
  if (edge === 3) return ((row - 1) * width + column) * 2 + 1;
  return ((row - 1) * width + column + 1) * 2 + 1;
}

function edgePoint(
  edge: number,
  row: number,
  column: number,
  depth: number,
  [a, b, c, d]: readonly [number, number, number, number],
): [number, number] {
  if (edge === 0) return [column + (depth - a) / (b - a), row - 1];
  if (edge === 2) return [column + (depth - d) / (c - d), row];
  if (edge === 3) return [column, row - 1 + (depth - a) / (d - a)];
  return [column + 1, row - 1 + (depth - b) / (c - b)];
}

function flip(line: ContourLine): void {
  line.pts.reverse();
  [line.head, line.tail] = [line.tail, line.head];
}

function join(
  ends: Map<number, ContourLine>,
  first: ContourLine,
  second: ContourLine,
  firstKey: number,
  secondKey: number,
): void {
  if (first === second) {
    first.pts.push(first.pts[0] as [number, number]);
    first.head = -1;
    first.tail = -1;
    return;
  }
  if (first.head === firstKey) flip(first);
  if (second.tail === secondKey) flip(second);
  for (const point of second.pts) first.pts.push(point);
  first.tail = second.tail;
  ends.set(first.tail, first);
  second.dead = true;
}
