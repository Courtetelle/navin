import { state } from '../../state/index.ts';
import { planImage } from '../map/planImage.ts';

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
 * Draw the plan a photo id names: the situation of a mark.
 * @param id - Photo id, `plan:mark:<id>`.
 * @returns PNG data URL, or null.
 */
export function planOf(id: string): Promise<string | null> {
  const [, kind, key] = id.split(':');
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
