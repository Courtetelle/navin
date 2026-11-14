import { distNM } from '../../lib/geo.ts';
import { state } from '../../state/index.ts';
import { planImage } from '../map/planImage.ts';
import type { LakeTrack } from '../map/trackStats.ts';
import { allLakeTracks } from '../map/trackStats.ts';

import type { ListKind, PublishItem, PublishPhoto } from './types.ts';

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
  if (kind === 'marks') {
    const ids = new Set(key.split(','));
    const marks = state.data.marks.value.filter((one) => ids.has(one.id));
    if (marks.length === 0) return Promise.resolve(null);
    return planImage({
      pins: marks.map((mark) => ({
        lat: mark.lat,
        lon: mark.lon,
        color: '#d00000',
        label: mark.name,
      })),
      maxZoom: 13,
    });
  }
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

function isPlan(photo: PublishPhoto): boolean {
  return photo.id.startsWith(`${PLAN_PREFIX}mark:`);
}

/** Marks closer than this to one another share a plan (nautical miles). */
const GROUP_NM = 10;

/**
 * The marks that go on one plan: closer than 10 NM to one another, step by
 * step; the groups in the order of their first mark.
 * @param marks - The marks, in the order of the list.
 * @returns The groups.
 */
export function markGroups<T extends { lat: number; lon: number }>(
  marks: readonly T[],
): T[][] {
  const groupOf = marks.map((_, index) => index);
  const root = (index: number): number => {
    let at = index;
    while (groupOf[at] !== at) at = groupOf[at] as number;
    return at;
  };
  for (const [first, one] of marks.entries()) {
    for (const [second, other] of marks.entries()) {
      if (second <= first || distNM(one, other) > GROUP_NM) continue;
      const [a, b] = [root(first), root(second)];
      groupOf[Math.max(a, b)] = Math.min(a, b);
    }
  }
  const groups = new Map<number, T[]>();
  for (const [index, mark] of marks.entries()) {
    const key = root(index);
    groups.set(key, [...(groups.get(key) ?? []), mark]);
  }
  return [...groups.values()];
}

/**
 * Several marks shared together: one plan for each group of marks close to
 * one another, right under the last mark of its group (the marks of a group
 * kept together); one mark alone keeps its own plan.
 * @param kind - The list shared.
 * @param list - Its elements, as checked.
 * @returns The elements to send.
 */
export function groupPlans(
  kind: ListKind,
  list: readonly PublishItem[],
): PublishItem[] {
  const planned = list.filter((item) => (item.photos ?? []).some(isPlan));
  if (kind !== 'marks' || planned.length < 2) return [...list];
  const marks = state.data.marks.value;
  const placed = planned.flatMap((item) => {
    const mark = marks.find((one) => one.id === item.id);
    return mark ? [{ item, lat: mark.lat, lon: mark.lon }] : [];
  });
  const groups = markGroups(placed);
  const lastOf = new Map<string, string>();
  for (const group of groups) {
    const last = group.at(-1);
    if (last) {
      lastOf.set(last.item.id, group.map((one) => one.item.id).join(','));
    }
  }
  const strip = (item: PublishItem): PublishItem => {
    const ids = lastOf.get(item.id);
    const photos = (item.photos ?? []).filter((photo) => !isPlan(photo));
    if (ids) {
      const names = groups
        .find((group) => group.at(-1)?.item.id === item.id)
        ?.map((one) => one.item.name)
        .join(', ');
      photos.push({
        id: `${PLAN_PREFIX}marks:${ids}`,
        cap: `Situation · ${names ?? ''}`,
      });
    }
    return { ...item, photos };
  };
  // The marks of a group together, the groups in the order of the list.
  const ordered = groups.flatMap((group) => group.map((one) => one.item));
  const others = list.filter((item) => !planned.includes(item));
  return [...ordered, ...others].map(strip);
}
