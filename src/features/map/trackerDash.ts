import { signal } from '@preact/signals-react';

import { fmtDur, fr, pad } from '../../lib/format.ts';
import { state } from '../../state/index.ts';

import { currentTrack, trackStats } from './trackStats.ts';
import { tracker } from './trackerState.ts';

/** The five cells of the tracker dashboard, as shown. */
interface TrackerDashTexts {
  speed: string;
  speedUnit: string;
  course: string;
  distance: string;
  duration: string;
  durationLabel: string;
  top: string;
}

/** What the dashboard shows. */
interface TrackerDashValues {
  sog: number | null | undefined;
  cog: number | null | undefined;
  distance: number;
  duration: number;
  top: number;
  tracking: boolean;
}

/**
 * Texts of the dashboard (legacy `updateTrkDash`).
 * @param values - Current values.
 * @returns The texts of the cells.
 */
export function trackerDashTexts(values: TrackerDashValues): TrackerDashTexts {
  const { sog, cog, distance, duration, top, tracking } = values;
  const hasSpeed = sog !== null && sog !== undefined;
  const hasCourse = cog !== null && cog !== undefined && !Number.isNaN(cog);
  return {
    speed: hasSpeed ? fr(sog) : '–',
    speedUnit: hasSpeed ? `nd · ${Math.round(sog * 1.852)} km/h` : 'nd',
    course: hasCourse ? `${pad(Math.round(cog) % 360, 3)}°` : '–',
    distance: fr(distance),
    duration: duration ? fmtDur(duration) : '–',
    durationLabel: tracking ? '⏺ en route' : 'durée',
    top: top ? fr(top) : '–',
  };
}

/** Dashboard of the tracker; legacy rewrote it on demand, never on a timer. */
export const trackerDash = signal<TrackerDashTexts>(
  trackerDashTexts({
    sog: null,
    cog: null,
    distance: 0,
    duration: 0,
    top: 0,
    tracking: false,
  }),
);

/** Refresh the dashboard of the tracker (legacy `updateTrkDash`). */
export function updateTrkDash(): void {
  const stats = trackStats(currentTrack());
  const trip = state.view.trip.value;
  const tracking = state.view.tracking.value;
  const recording = tracking && trip ? trip : null;
  const handle = tracker.current;
  const span = stats.start && stats.end ? stats.end - stats.start : 0;
  trackerDash.value = trackerDashTexts({
    sog: handle?.lastSog ?? (recording?.det.lastSog as number | undefined),
    cog: handle?.lastCog ?? (recording?.det.lastCog as number | undefined),
    distance: recording ? (recording.det.dist as number) : stats.nm,
    duration: recording ? Date.now() - recording.start : span,
    top: stats.max,
    tracking,
  });
}
