import { uid } from '../../lib/format.ts';
import type { Boat } from '../../model/types.ts';
import { curMode, state, toast } from '../../state/index.ts';

import {
  checklistOwner,
  ckProp,
  ownerBoatId,
  ownerItems,
} from './checklistOwner.ts';
import { updateOwner } from './ownerUpdates.ts';

/** A check-in another boat holds, that can be copied. */
export interface CheckInSource {
  boatId: string;
  name: string;
  count: number;
}

/**
 * The check-ins of the other boats, to copy into this one.
 * @param boats - The boats.
 * @param ownId - The boat of the outing, left out.
 * @returns Boats with a check-in, by name.
 */
export function checkInSources(
  boats: readonly Boat[],
  ownId: string | null,
): CheckInSource[] {
  const mode = curMode();
  return boats
    .filter((boat) => boat.id !== ownId)
    .map((boat) => ({
      boatId: boat.id,
      name: boat.info.boat || 'Bateau',
      count: ownerItems(boat, ckProp('dep', mode, boat)).length,
    }))
    .filter((source) => source.count > 0)
    .toSorted((first, second) => first.name.localeCompare(second.name, 'fr'));
}

/**
 * The check-ins that could be copied into the open outing.
 * @returns They, by boat name.
 */
export function currentCheckInSources(): CheckInSource[] {
  return checkInSources(state.data.boats.value, ownerBoatId());
}

/**
 * Add to the check-in of the outing the items of another boat's check-in
 * (new ids; the items already there by name are not doubled).
 * @param boatId - The boat copied from.
 */
export function copyCheckIn(boatId: string): void {
  const mode = curMode();
  const source = state.data.boats.value.find((boat) => boat.id === boatId);
  const owner = checklistOwner();
  if (!source || !owner) return;
  const items = ownerItems(source, ckProp('dep', mode, source));
  const property = ckProp('dep', mode, owner);
  const have = new Set(
    ownerItems(owner, property).map((item) => item.label.trim().toLowerCase()),
  );
  const added = items
    .filter((item) => !have.has(item.label.trim().toLowerCase()))
    .map((item) => ({ ...structuredClone(item), id: uid() }));
  updateOwner(ownerBoatId(), mode, (draft) => {
    const list = (draft[property] ?? []) as unknown[];
    draft[property] = [...list, ...added];
  });
  toast(
    added.length > 0
      ? `📋 ${added.length} point${added.length > 1 ? 's' : ''} repris de ${source.info.boat || 'l’autre bateau'}`
      : 'Ces points sont déjà dans la check-in',
  );
}
