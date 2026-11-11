import { distNM } from '../../lib/geo.ts';

import { analyseWindow, makeEvent } from './detectorWindow.ts';

/** One position of a track, live or imported. */
export interface TrackSample {
  /** Epoch milliseconds (`NaN` when a GPX point has no time). */
  t: number;
  lat: number;
  lon: number;
  /** @default undefined */
  sog?: number | null;
  /** @default undefined */
  cog?: number | null;
  /** @default undefined */
  twd?: number | null;
  /** @default undefined */
  tws?: number | null;
}

/** A key point found on a track; `kind` null is a plain periodic point. */
export interface TrackEvent {
  kind: string | null;
  t: number;
  lat: number;
  lon: number;
  cog: number | null;
  sog: number | null;
  dist: number;
  /** @default undefined */
  twd?: number | null;
  /** @default undefined */
  tws?: number | null;
  /** @default undefined */
  note?: string;
  [key: string]: unknown;
}

/** Detector options (legacy `newDetector` argument). */
interface DetectorOptions {
  /** Lasting course change (°) that makes a key point. */
  turn: number;
  /** Minutes between two periodic points. */
  every: number;
  /**
   * Gap (ms) splitting an imported track into two navigations; 0 never splits.
   * @default 0
   */
  splitGap?: number;
}

/**
 * State of the key point detection, stored as is in `ldb.trip.<cruiseId>`:
 * the key names and order are part of the storage format.
 */
export interface Detector {
  turn: number;
  every: number;
  splitGap: number;
  buf: TrackSample[];
  ref: number | null;
  refSide: number;
  pendSince: number | null;
  refAllure: string | null;
  allurePend: string | null;
  allureSince: number | null;
  lastEntryT: number | null;
  dist: number;
  lastPt: TrackSample | null;
  lastCog: number | null;
  lastSog: number | null;
  lastTwd: number | null;
  lastTws: number | null;
  [key: string]: unknown;
}

/** Span of the sliding window of positions the course is read over. */
const WINDOW_MS = 90_000;

/**
 * A fresh detector (legacy `newDetector`).
 * @param options - Thresholds.
 * @returns The detector state.
 */
export function newDetector(options: DetectorOptions): Detector {
  return {
    turn: options.turn,
    every: options.every,
    splitGap: options.splitGap || 0,
    buf: [],
    ref: null,
    refSide: 0,
    pendSince: null,
    refAllure: null,
    allurePend: null,
    allureSince: null,
    lastEntryT: null,
    dist: 0,
    lastPt: null,
    lastCog: null,
    lastSog: null,
    lastTwd: null,
    lastTws: null,
  };
}

/**
 * Feed one position (legacy `detectorPush`). The same logic serves live
 * tracking and imports: departure, lasting course change (tack or gybe when
 * the wind is known), change of point of sail, periodic point. Updates
 * `detector` in place.
 * @param detector - Detector state.
 * @param sample - New position.
 * @returns The key points found.
 */
export function detectorPush(
  detector: Detector,
  sample: TrackSample,
): TrackEvent[] {
  const events: TrackEvent[] = [];
  if (sample.twd != null && sample.tws != null) {
    detector.lastTwd = Math.round(sample.twd) % 360;
    detector.lastTws = Math.round(sample.tws * 10) / 10;
  }
  const previous = detector.lastPt;
  if (!previous) {
    detector.lastPt = sample;
    detector.buf = [sample];
    detector.lastEntryT = sample.t;
    events.push(makeEvent(detector, 'Départ', sample, sample.cog, sample.sog));
    return events;
  }
  const elapsed = sample.t - previous.t;
  if (detector.splitGap && elapsed > detector.splitGap) {
    events.push(makeEvent(detector, 'Arrivée', previous, null, 0));
    Object.assign(detector, {
      buf: [sample],
      ref: null,
      refSide: 0,
      pendSince: null,
      refAllure: null,
      allurePend: null,
      lastPt: sample,
      lastEntryT: sample.t,
      lastSog: null,
      lastCog: null,
    });
    events.push(makeEvent(detector, 'Départ', sample, sample.cog, sample.sog));
    return events;
  }
  const step = distNM(previous, sample);
  // Under 5 m in less than a minute: the boat did not move.
  if (step < 0.003 && elapsed < 60_000) return events;
  // A jump above 40 kn is a GPS glitch: its distance is not counted.
  if (elapsed > 0 && step / (elapsed / 3_600_000) < 40) detector.dist += step;
  detector.lastPt = sample;
  detector.buf.push(sample);
  while (
    detector.buf.length > 2 &&
    sample.t - (detector.buf[1]?.t ?? sample.t) >= WINDOW_MS
  ) {
    detector.buf.shift();
  }
  const oldest = detector.buf[0];
  if (oldest && sample.t - oldest.t >= WINDOW_MS) {
    analyseWindow(detector, oldest, sample, events);
  }
  if (sample.t - (detector.lastEntryT ?? 0) >= detector.every * 60_000) {
    events.push(makeEvent(detector, null, sample));
    detector.lastEntryT = sample.t;
  }
  return events;
}
