import { state } from '../../state/index.ts';

/**
 * The words of the open cruise (sea) or outing (lake).
 * @returns Whether it is a lake outing.
 */
export function openIsLake(): boolean {
  return Boolean(state.data.voyages.value.lake);
}

/**
 * The back button of a chapter, to its cruise or outing.
 * @returns « ◀ Croisière » or « ◀ Sortie ».
 */
export function voyageBack(): string {
  return openIsLake() ? '◀ Sortie' : '◀ Croisière';
}
