import { buzz } from '../../lib/dom.ts';
import { dayKey } from '../../lib/format.ts';
import { modeOf } from '../../model/modes.ts';
import type { Cruise, Day } from '../../model/types.ts';
import { constatKey } from '../../model/views.ts';
import { go } from '../../shell/router.ts';
import {
  lastTripKey,
  setPrep,
  setPrepReady,
  toast,
  updateCruise,
} from '../../state/index.ts';
import { store } from '../../storage/store.ts';
import { checkItems, checkLeft, obsOwner } from '../checklists/index.ts';

import { navPageRefresh } from './navPage.ts';
import { prepPathDrop } from './prepPaths.ts';
import { prepFlow } from './prepTypes.ts';

/** How far the check-in of the PréP is. */
type CheckInState = 'none' | 'part' | 'ok';

/** Photo context of the check-in once archived at START. */
const ARCHIVED_PHOTOS = 'dep-archive';

/**
 * How far the check-in is: nothing yet, started (an item green or an
 * observation written), or every item green.
 * @param all - Items of the check-in.
 * @param left - Items not green.
 * @param observation - Observation text.
 * @returns The state.
 */
export function checkInState(
  all: number,
  left: number,
  observation: string,
): CheckInState {
  if (all > 0 && left === 0) return 'ok';
  if (left < all || observation.trim()) return 'part';
  return 'none';
}

/**
 * How far the check-in of the open outing is.
 * @returns The state.
 */
export function currentCheckIn(): CheckInState {
  const observation = obsOwner()?.[constatKey('dep')];
  return checkInState(
    checkItems('dep').length,
    checkLeft('dep').length,
    typeof observation === 'string' ? observation : '',
  );
}

/**
 * Close the PréP from the check-in: the flow ends, the PréP button turns
 * green (all done) or orange (closed before the end) until START.
 */
export function prepClose(): void {
  const reached = currentCheckIn();
  if (reached === 'none' || !prepFlow()) return;
  buzz();
  prepPathDrop(prepFlow()?.purpose);
  setPrep(null);
  // START begins a new track, not the last one again.
  store.del(lastTripKey());
  setPrepReady(reached);
  go('tracker');
  navPageRefresh();
  toast(
    reached === 'ok'
      ? 'PréP terminée, prêt au départ : START pour partir'
      : 'PréP close, check-in incomplète : START pour partir',
  );
}

/** One check-in kept at START, for the logbook. */
interface CheckInRecord {
  /** ISO time of START. */
  at: string;
  /** Labels of the green items. */
  done: string[];
  /** Labels of the items left orange (looked at, not done). */
  open: string[];
  /** Values typed, by label (readings of the day sheet stay there). */
  values: Record<string, string>;
  /** Observations. */
  observation: string;
  /** Ids of the check-in photos. */
  photos: string[];
}

/**
 * At START after a PréP: the check-in is kept in `prepArchive` of the record
 * that holds it (for the logbook), then put back to white, without values,
 * observations nor photos, for the next outing. The readings of the day
 * sheet (items with a `key`) are logbook data: they stay.
 */
export function archiveCheckIn(): void {
  const items = checkItems('dep');
  if (items.length === 0) return;
  const today = dayKey(new Date());
  updateCruise((cruise) => {
    const holder: Day | Cruise =
      modeOf(cruise) === 'lacj' ? (cruise.days[today] ??= {}) : cruise;
    const ids = new Set(items.map((item) => item.id));
    const done = new Set(idsOf(holder.checkDone));
    const open = new Set(idsOf(holder.ckOpen));
    const values = (holder.ckVals ?? {}) as Record<string, string>;
    const key = constatKey('dep');
    const observation = holder[key];
    const photos = (cruise.photos ?? []).filter((photo) => photo.ctx === 'dep');
    const record: CheckInRecord = {
      at: new Date().toISOString(),
      done: items.filter((item) => done.has(item.id)).map((item) => item.label),
      open: items.filter((item) => open.has(item.id)).map((item) => item.label),
      values: Object.fromEntries(
        items
          .filter((item) => !item.key && values[item.id])
          .map((item) => [item.label, values[item.id] as string]),
      ),
      observation: typeof observation === 'string' ? observation : '',
      photos: photos.map((photo) => photo.id),
    };
    const kept = Array.isArray(holder.prepArchive) ? holder.prepArchive : [];
    holder.prepArchive = [...(kept as unknown[]), record];
    holder.checkDone = [...done].filter((id) => !ids.has(id));
    holder.ckOpen = [...open].filter((id) => !ids.has(id));
    for (const id of ids) Reflect.deleteProperty(values, id);
    Reflect.deleteProperty(holder, key);
    for (const photo of photos) photo.ctx = ARCHIVED_PHOTOS;
  });
}

function idsOf(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((id) => typeof id === 'string')
    : [];
}
