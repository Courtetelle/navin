import { batch, signal } from '@preact/signals-react';

import type { Member } from '../../model/types.ts';
import { state } from '../../state/index.ts';

import type { ParsedSheet } from './blankParse.ts';
import { crewToFiches } from './crewActions.ts';
import { addPendingMembers } from './crewsEdit.ts';
import { ensureCustomLabels } from './memberLabels.ts';

/** Sub-screens legacy swapped inside `#view` without `go`. */
export type CrewScreen =
  | { kind: 'pick' }
  | { kind: 'list' }
  | { kind: 'crews' }
  | { kind: 'fiche'; id: string }
  | { kind: 'labels'; back: () => void }
  | { kind: 'arbitration'; received: ParsedSheet; clones: readonly Member[] };

/** The sub-screen shown and how it was drawn. */
export interface ShownCrewScreen {
  screen: CrewScreen;
  /** Increases at every draw: a new one starts from scratch, like legacy `innerHTML`. */
  serial: number;
  /** The title differs from the one drawn before (`help-lead`, nav.js:110-131). */
  lead: boolean;
}

/** The sub-screen shown by the pages `people`, `crews` and `crew`. */
export const shownCrewScreen = signal<ShownCrewScreen>({
  screen: { kind: 'list' },
  serial: 0,
  lead: true,
});

let drawnTitle = '';

/**
 * Text of the title of the pick screen.
 * @returns e.g. `Équipage · 3 à bord`.
 */
export function crewPickTitle(): string {
  return `Équipage · ${state.data.cruise.value?.crew.length ?? 0} à bord`;
}

/**
 * Screen `crew` (legacy `renderCrewPick`): the open card, the card list without
 * a cruise, else who is on board.
 */
export function showCrewPick(): void {
  const open = state.view.crewFiche.value;
  if (open) {
    showFiche(open);
    return;
  }
  if (!state.data.cruise.value) {
    showFicheList();
    return;
  }
  crewToFiches();
  draw({ kind: 'pick' }, crewPickTitle());
}

/** The card list (legacy `renderFicheList`). */
export function showFicheList(): void {
  draw({ kind: 'list' }, 'Les coéquipiers·ères');
  // Legacy saw the title again once the publish row was added, with its help
  // pill this time, so the next draw of the list never compared equal.
  const published =
    state.view.currentView.peek() === 'people' &&
    state.data.members.peek().length > 0;
  if (published) drawnTitle = '';
}

/**
 * A member card (legacy `renderFiche`); a card that no longer exists goes back.
 * @param id - Member id, or `new`.
 */
export function showFiche(id: string): void {
  const known =
    id === 'new' || state.data.members.value.some((member) => member.id === id);
  if (known) draw({ kind: 'fiche', id }, '');
  else leaveFiche();
}

/** Leave a card towards the screen it was opened from (legacy `back`, lake.js:2187). */
export function leaveFiche(): void {
  const backTo = state.view.crewFicheBack.value;
  batch(() => {
    state.view.crewFiche.value = null;
    state.view.crewFicheBack.value = null;
  });
  if (backTo === 'crews') showCrews();
  else if (backTo === 'list' || !state.data.cruise.value) showFicheList();
  else showCrewPick();
}

/**
 * The ✎ mode of the labels of the cards (legacy `renderMemberLabels`).
 * @param back - Leaves the mode.
 */
export function showLabels(back: () => void): void {
  ensureCustomLabels();
  draw({ kind: 'labels', back }, 'Fiches coéquipier·ère');
}

/**
 * Arbitration of a received sheet (legacy `renderBlankArb`).
 * @param received - Parsed sheet.
 * @param clones - Similar existing cards.
 */
export function showArbitration(
  received: ParsedSheet,
  clones: readonly Member[],
): void {
  draw({ kind: 'arbitration', received, clones }, 'arbitration');
}

/** The crew compositions (legacy `VIEWS.crews`), or the one being edited. */
export function showCrews(): void {
  addPendingMembers();
  if (state.view.crewsEdit.value) showCrewsEdit();
  else draw({ kind: 'crews' }, 'Équipages');
}

/** The composition being edited, drawn again from scratch (legacy `renderCrewsEdit`). */
export function showCrewsEdit(): void {
  draw({ kind: 'crews' }, 'crews edit');
}

/**
 * Entry of a screen by `go` (legacy `VIEWS.people`, `VIEWS.crew`, `VIEWS.crews`).
 * @param view - Screen opened.
 */
export function enterCrewView(view: string): void {
  if (view === 'crews') {
    showCrews();
    return;
  }
  if (view !== 'people' && view !== 'crew') return;
  batch(() => {
    state.view.crewFiche.value = null;
    state.view.crewFicheBack.value = null;
    state.view.ficheFromData.value = view === 'people';
  });
  if (view === 'people' || !state.data.cruise.value) showFicheList();
  else showCrewPick();
}

function draw(screen: CrewScreen, title: string): void {
  const lead = title !== drawnTitle;
  drawnTitle = title;
  shownCrewScreen.value = {
    screen,
    serial: shownCrewScreen.peek().serial + 1,
    lead,
  };
}
