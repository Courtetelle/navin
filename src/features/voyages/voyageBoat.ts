import type { Boat } from '../../model/types.ts';
import type { Voyages } from '../../model/voyages.ts';
import { state, updateVoyages } from '../../state/index.ts';

/**
 * The boat chosen for a cruise, if it still exists in data › Bateaux.
 * @param voyages - The cruise.
 * @returns The boat.
 */
export function voyageBoat(voyages: Pick<Voyages, 'boat'>): Boat | undefined {
  return voyages.boat
    ? state.data.boats.value.find((boat) => boat.id === voyages.boat)
    : undefined;
}

/**
 * Choose the boat of the open cruise, or none.
 * @param id - Boat id, or undefined.
 */
export function chooseVoyageBoat(id: string | undefined): void {
  updateVoyages((voyages) => {
    if (id) voyages.boat = id;
    else delete voyages.boat;
  });
}
