/**
 * Polars of a boat: its speed through the water for a true wind angle and
 * speed, for the routing and the times of passage.
 */

/** A polar table: `kn[row][column]` is the boat speed (knots) at `twa[row]`, `tws[column]`. */
export interface Polar {
  /** True wind angles, degrees from 0 to 180, increasing. */
  twa: number[];
  /** True wind speeds, knots, increasing. */
  tws: number[];
  /** Boat speeds, knots, one row per angle. */
  kn: number[][];
}

/** Where a polar of a boat came from. */
export type PolarFrom = 'orc' | 'file' | 'hand';

/** The polar of a boat (`boat.polar`). */
export interface BoatPolar {
  polar: Polar;
  from: PolarFrom;
  /** What it is: « ORC · Hanse 325 (2004–2011, 7 certificats) », the file name… */
  label: string;
  /**
   * Share of the polar the boat really makes (0.85: 85 %): a polar of a
   * certificate is a boat raced with new sails and a full crew.
   */
  coef: number;
  /** Set (ISO). */
  at: string;
}

/** Share of a certificate polar made by a boat on a cruise. */
export const CRUISE_COEF = 0.85;

/** The wind speeds of an empty table typed by hand, knots. */
export const HAND_TWS = [6, 8, 10, 12, 14, 16, 20, 25];
/** The angles of an empty table typed by hand, degrees. */
export const HAND_TWA = [40, 52, 60, 75, 90, 110, 120, 135, 150, 165, 180];

/** The catalogue of the ORC certificates (`public/polars/orc.json`). */
export interface OrcCatalogue {
  src: string;
  licence: string;
  twa: number[];
  tws: number[];
  /** `[type, first year, last year, certificates, length cm, …speeds × 10]`. */
  boats: Array<Array<string | number | null>>;
}

/** One boat type of the ORC catalogue. */
export interface OrcBoat {
  name: string;
  from: number | null;
  to: number | null;
  certificates: number;
  /** Length overall, metres. */
  loa: number;
  polar: Polar;
}

/**
 * The polar of a row of the ORC catalogue: the rows of the certificate, and
 * the best angles to the wind (beat) and away from it (run) as rows of
 * their own, at their mean angle.
 * @param catalogue - The catalogue.
 * @param row - One of its boats.
 * @returns The boat.
 */
export function orcBoat(
  catalogue: Pick<OrcCatalogue, 'twa' | 'tws'>,
  row: ReadonlyArray<string | number | null>,
): OrcBoat {
  const { twa, tws } = catalogue;
  const numbers = row.slice(5).map((value) => Number(value) / 10);
  const width = tws.length;
  const line = (rank: number) =>
    numbers.slice(rank * width, (rank + 1) * width);
  const rows = twa.map((angle, rank) => ({ angle, kn: line(rank) }));
  const beatAngle = line(twa.length);
  const beatVmg = line(twa.length + 1);
  const runAngle = line(twa.length + 2);
  const runVmg = line(twa.length + 3);
  const beat = Math.round(mean(beatAngle));
  const run = Math.round(mean(runAngle));
  // Speed at the best angle: its VMG over the cosine of its angle.
  const along = (vmg: number[], angles: number[], away: boolean) =>
    vmg.map((value, rank) => {
      const angle = ((angles[rank] as number) * Math.PI) / 180;
      const cos = Math.abs(Math.cos(away ? Math.PI - angle : angle));
      return round2(cos > 0.05 ? value / cos : value);
    });
  if (beat < (twa[0] as number)) {
    rows.unshift({ angle: beat, kn: along(beatVmg, beatAngle, false) });
  }
  if (run > (twa.at(-1) as number) && run < 180) {
    rows.push({ angle: run, kn: along(runVmg, runAngle, true) });
  }
  // Straight downwind: no better than the VMG of the run.
  rows.push({ angle: 180, kn: runVmg.map(round2) });
  return {
    name: String(row[0]),
    from: typeof row[1] === 'number' ? row[1] : null,
    to: typeof row[2] === 'number' ? row[2] : null,
    certificates: Number(row[3]),
    loa: Number(row[4]) / 100,
    polar: {
      twa: rows.map((r) => r.angle),
      tws: [...tws],
      kn: rows.map((r) => r.kn),
    },
  };
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * The years of a type of the catalogue: « 2011 », « 2004–2011 ».
 * @param boat - The type.
 * @returns The years, or an empty text.
 */
export function orcYears(boat: Pick<OrcBoat, 'from' | 'to'>): string {
  if (boat.from === null) return '';
  return boat.to === null || boat.to === boat.from
    ? String(boat.from)
    : `${boat.from}–${boat.to}`;
}

/**
 * The types of the catalogue that match a search, best first: every word of
 * the search in the name, the year in the years when one is typed.
 * @param catalogue - The catalogue.
 * @param search - « Hanse 325 2011 ».
 * @param most - At most this many.
 * @returns The rows.
 */
export function searchOrc(
  catalogue: OrcCatalogue,
  search: string,
  most = 30,
): Array<Array<string | number | null>> {
  const words = fold(search).split(/\s+/).filter(Boolean);
  const year = words.find((word) => /^(?:19|20)\d{2}$/.test(word));
  const terms = words.filter((word) => word !== year);
  if (terms.length === 0) return [];
  const found = catalogue.boats.filter((row) => {
    const name = fold(String(row[0]));
    const compact = name.replaceAll(/[\s-]/g, '');
    return terms.every((term) => name.includes(term) || compact.includes(term));
  });
  const score = (row: ReadonlyArray<string | number | null>) => {
    const name = fold(String(row[0]));
    let value = 0;
    if (name === terms.join(' ')) value += 100;
    if (name.startsWith(terms[0] as string)) value += 10;
    if (year) {
      const wanted = Number(year);
      const from = Number(row[1] ?? 0);
      const to = Number(row[2] ?? from);
      if (wanted >= from && wanted <= to) value += 50;
      else value -= Math.min(Math.abs(wanted - from), Math.abs(wanted - to));
    }
    return value + Number(row[3]) / 1000 - name.length / 100;
  };
  return found
    .map((row) => ({ row, value: score(row) }))
    .toSorted((first, second) => second.value - first.value)
    .slice(0, most)
    .map((item) => item.row);
}

function fold(text: string): string {
  return text.normalize('NFD').replaceAll(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/**
 * Read a polar file: a table with the wind speeds on its first line and one
 * line per angle (`.pol` of OpenCPN, qtVlm, Expedition, a `.csv`), cells
 * split by tabs, semicolons, commas or spaces. The first cell (« TWA\TWS »)
 * is not read.
 * @param text - The file.
 * @returns The polar, or a reason why it is not one.
 */
export function parsePolar(text: string): Polar | { error: string } {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && !line.startsWith('!'));
  if (lines.length < 2) return { error: 'Il faut au moins deux lignes.' };
  const head = lines[0] as string;
  const split = splitter(head);
  const decimalComma = split !== ',' && /\d,\d/.test(text);
  const cells = (line: string) =>
    line
      .split(split === ' ' ? /\s+/ : split)
      .map((cell) =>
        decimalComma ? cell.trim().replace(',', '.') : cell.trim(),
      );
  const top = cells(head);
  const tws = top.slice(1).map(Number);
  if (tws.length === 0 || tws.some((value) => !Number.isFinite(value))) {
    return { error: 'La première ligne doit donner les forces de vent.' };
  }
  const rows: Array<{ angle: number; kn: number[] }> = [];
  for (const line of lines.slice(1)) {
    const values = cells(line).map(Number);
    const angle = values[0] as number;
    if (!Number.isFinite(angle)) continue;
    const kn = tws.map((_, rank) => {
      const value = values[rank + 1];
      return value !== undefined && Number.isFinite(value) ? value : 0;
    });
    rows.push({ angle, kn });
  }
  if (rows.length === 0) return { error: 'Aucune ligne d’angle lue.' };
  if (rows.some((row) => row.angle < 0 || row.angle > 180)) {
    return { error: 'Les angles doivent aller de 0 à 180°.' };
  }
  rows.sort((first, second) => first.angle - second.angle);
  const order = tws
    .map((value, rank) => ({ value, rank }))
    .toSorted((first, second) => first.value - second.value);
  return {
    twa: rows.map((row) => row.angle),
    tws: order.map((item) => item.value),
    kn: rows.map((row) => order.map((item) => row.kn[item.rank] as number)),
  };
}

function splitter(head: string): string {
  if (head.includes('\t')) return '\t';
  if (head.includes(';')) return ';';
  if (head.includes(',')) return ',';
  return ' ';
}

/**
 * A polar as a `.pol` file (tabs), the format the routing programs read.
 * @param polar - The polar.
 * @returns The text.
 */
export function polarToText(polar: Polar): string {
  const lines = [[String.raw`TWA\TWS`, ...polar.tws].join('\t')];
  for (const [rank, angle] of polar.twa.entries()) {
    lines.push([angle, ...(polar.kn[rank] ?? [])].join('\t'));
  }
  return `${lines.join('\n')}\n`;
}

/**
 * An empty table to type by hand.
 * @returns The polar, every speed 0.
 */
export function emptyPolar(): Polar {
  return {
    twa: [...HAND_TWA],
    tws: [...HAND_TWS],
    kn: HAND_TWA.map(() => HAND_TWS.map(() => 0)),
  };
}

/**
 * The speed of the boat, read in the polar between its lines and columns.
 * The angle counts from the wind on either side; closer to the wind than the
 * first line the boat does not sail (0); above the strongest wind the speed
 * stays that of the strongest; below the lightest it falls to 0 at no wind.
 * @param polar - The polar.
 * @param twa - True wind angle, degrees (any side).
 * @param tws - True wind speed, knots.
 * @param coef - Share of the polar made (1 by default).
 * @returns The speed, knots.
 */
export function polarSpeed(
  polar: Polar,
  twa: number,
  tws: number,
  coef = 1,
): number {
  const angle = foldAngle(twa);
  const { twa: angles, tws: winds, kn } = polar;
  if (angles.length === 0 || winds.length === 0 || tws <= 0) return 0;
  if (angle < (angles[0] as number)) return 0;
  const [row, rowShare] = bracket(angles, angle);
  const light = winds[0] as number;
  const wind = Math.min(tws, winds.at(-1) as number);
  const [column, columnShare] = bracket(winds, Math.max(wind, light));
  const at = (r: number, c: number) => kn[r]?.[c] ?? 0;
  const left =
    at(row, column) * (1 - rowShare) + at(row + 1, column) * rowShare;
  const right =
    at(row, column + 1) * (1 - rowShare) + at(row + 1, column + 1) * rowShare;
  let speed = left * (1 - columnShare) + right * columnShare;
  if (tws < light) speed *= tws / light;
  return Math.max(0, speed * coef);
}

/**
 * The line before a value in increasing values, and how far toward the next.
 * @param values - Increasing values.
 * @param value - Within them.
 * @returns The rank and the share (0 to 1).
 */
function bracket(values: readonly number[], value: number): [number, number] {
  const last = values.length - 1;
  if (value >= (values[last] as number)) return [last, 0];
  for (let rank = 0; rank < last; rank++) {
    const low = values[rank] as number;
    const high = values[rank + 1] as number;
    if (value < high) {
      return [rank, high > low ? (value - low) / (high - low) : 0];
    }
  }
  return [last, 0];
}

/**
 * An angle to the wind folded to 0–180°, either side.
 * @param twa - Degrees.
 * @returns From 0 to 180.
 */
export function foldAngle(twa: number): number {
  const turned = ((twa % 360) + 360) % 360;
  return turned > 180 ? 360 - turned : turned;
}

/**
 * Whether a value is a polar of a boat as stored.
 * @param value - Anything.
 * @returns `true` for a {@link BoatPolar}.
 */
export function isBoatPolar(value: unknown): value is BoatPolar {
  if (!value || typeof value !== 'object') return false;
  const { polar, coef } = value as Partial<BoatPolar>;
  return (
    typeof coef === 'number' &&
    !!polar &&
    Array.isArray(polar.twa) &&
    Array.isArray(polar.tws) &&
    Array.isArray(polar.kn) &&
    polar.kn.length === polar.twa.length
  );
}

/**
 * The best speed toward the wind and the angle it is made at (VMG).
 * @param polar - The polar.
 * @param tws - Wind, knots.
 * @param away - Away from the wind (run) instead of toward it (beat).
 * @returns The angle (degrees) and the VMG (knots).
 */
export function bestVmg(
  polar: Polar,
  tws: number,
  away = false,
): { twa: number; vmg: number } {
  let best = { twa: away ? 180 : 45, vmg: 0 };
  const from = away ? 90 : 25;
  const to = away ? 180 : 90;
  for (let angle = from; angle <= to; angle++) {
    const along = Math.cos((angle * Math.PI) / 180) * (away ? -1 : 1);
    const vmg = polarSpeed(polar, angle, tws) * along;
    if (vmg > best.vmg) best = { twa: angle, vmg };
  }
  return best;
}
