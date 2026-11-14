import { state } from '../../state/index.ts';
import { planImage } from '../map/planImage.ts';
import type { LakeTrack } from '../map/trackStats.ts';
import { allLakeTracks } from '../map/trackStats.ts';

/** The photo id of a plan drawn when shared: `plan:mark:<id>`. */
export const PLAN_PREFIX = 'plan:';

/**
 * The photo id of the plan of a mark.
 * @param id - Mark id.
 * @returns The photo id.
 */
export function markPlanId(id: string): string {
  return `${PLAN_PREFIX}mark:${id}`;
}

/**
 * The photo id of the plan of a trace.
 * @param id - Trace id.
 * @returns The photo id.
 */
export function tracePlanId(id: string): string {
  return `${PLAN_PREFIX}trace:${id}`;
}

/**
 * The plan of a trace: its line, the start in green, the end in red.
 * @param track - The trace.
 * @returns PNG data URL, or null.
 */
export function tracePlan(track: LakeTrack): Promise<string | null> {
  const line = track.track.map(([, lat, lon]) => ({ lat, lon }));
  const first = line[0];
  const last = line.at(-1);
  if (!first || !last) return Promise.resolve(null);
  return planImage({
    lines: [line],
    pins: [
      { ...first, color: '#00a040' },
      { ...last, color: '#d00000' },
    ],
    maxZoom: 15,
  });
}

/**
 * Draw the plan a photo id names: the situation of a mark.
 * @param id - Photo id, `plan:mark:<id>` or `plan:trace:<id>`.
 * @returns PNG data URL, or null.
 */
export function planOf(id: string): Promise<string | null> {
  const [, kind] = id.split(':');
  const key = id.slice(`${PLAN_PREFIX}${kind ?? ''}:`.length);
  if (kind === 'trace') {
    const track = allLakeTracks().find((one) => one.id === key);
    return track ? tracePlan(track) : Promise.resolve(null);
  }
  if (kind === 'mark') {
    const mark = state.data.marks.value.find((one) => one.id === key);
    if (!mark) return Promise.resolve(null);
    return planImage({
      pins: [
        { lat: mark.lat, lon: mark.lon, color: '#d00000', label: mark.name },
      ],
      maxZoom: 13,
    });
  }
  return Promise.resolve(null);
}
