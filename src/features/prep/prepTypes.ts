import type { CrewSetLine } from '../../model/types.ts';
import type { PrepState } from '../../state/index.ts';
import { state, updatePrep } from '../../state/index.ts';

/** Crew being composed in the PréP (legacy `prep.crewDraft`). */
export interface CrewDraft {
  /** Composition it started from. */
  baseId: string | null;
  /** Name typed. */
  name: string;
  /** People and roles. */
  crew: CrewSetLine[];
}

/** The PréP flow state with the fields only this domain reads. */
export interface PrepFlow extends PrepState {
  /** Lake path: `Entraînement`, `Location` or `Invitation`. @default undefined */
  purpose?: string | null;
  /** Step being filled; browsing with the pills does not move it. @default undefined */
  reach?: number | null;
  /** Composition chosen. @default undefined */
  crewSet?: string;
  /** Label of the fare chosen. @default undefined */
  tarif?: string | null;
  /** Crew being composed. @default undefined */
  crewDraft?: CrewDraft | null;
  /** The crew page was opened to add a person. @default undefined */
  newCrew?: boolean;
}

/**
 * The PréP flow (legacy `prep`).
 * @returns The flow, or null outside the PréP.
 */
export function prepFlow(): PrepFlow | null {
  return state.data.prep.value as PrepFlow | null;
}

/**
 * Change the PréP flow, when one is open.
 * @param recipe - Mutates the draft flow.
 */
export function updatePrepFlow(recipe: (prep: PrepFlow) => void): void {
  updatePrep((prep) => recipe(prep as PrepFlow));
}
