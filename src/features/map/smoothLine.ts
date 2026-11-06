import type { LatLngPair } from './constants.ts';

/** A longer stretch is a gap in the recording: its ends stay where they are. */
const MAX_SMOOTHED_KM = 0.2;
const KM_PER_DEGREE = 111.32;

function stretchKm(from: LatLngPair, to: LatLngPair): number {
  const across = Math.cos((from[0] * Math.PI) / 180) * (to[1] - from[1]);
  return Math.hypot(to[0] - from[0], across) * KM_PER_DEGREE;
}

function between(from: LatLngPair, to: LatLngPair, part: number): LatLngPair {
  return [
    from[0] + (to[0] - from[0]) * part,
    from[1] + (to[1] - from[1]) * part,
  ];
}

function roundCorners(line: readonly LatLngPair[]): LatLngPair[] {
  const first = line[0];
  const last = line.at(-1);
  if (!first || !last) return [];
  const rounded: LatLngPair[] = [first];
  for (let index = 0; index < line.length - 1; index++) {
    const from = line[index] as LatLngPair;
    const to = line[index + 1] as LatLngPair;
    if (stretchKm(from, to) > MAX_SMOOTHED_KM) {
      rounded.push(from, to);
    } else {
      rounded.push(between(from, to, 0.25), between(from, to, 0.75));
    }
  }
  rounded.push(last);
  return rounded;
}

/**
 * The line of a track as it is drawn, with its corners rounded. Only the
 * drawing changes: the points recorded and the distances stay as they are.
 * @param line - Recorded points.
 * @returns The points to draw.
 */
export function smoothLine(line: readonly LatLngPair[]): LatLngPair[] {
  if (line.length < 3) return [...line];
  return roundCorners(roundCorners(line));
}
