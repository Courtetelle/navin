import { signal } from '@preact/signals-react';

import { buzz } from '../../lib/dom.ts';
import { fmtTime, fr } from '../../lib/format.ts';
import { railsScreen } from '../../lib/useWide.ts';
import type { Trip } from '../../state/index.ts';
import { lastTripKey, state, toast } from '../../state/index.ts';
import { store } from '../../storage/store.ts';

import { extendLastTrip, quickStart, startTracking } from './external.ts';
import { stopMapWatch } from './mapWatch.ts';
import { updateTrkDash } from './trackerDash.ts';
import { trackerTick } from './trackerState.ts';

/** Content of `#trkBtns`. */
export type TrackerOverlay =
  | {
      kind: 'idle';
      /** Geolocation refused, nothing recording. */
      denied: boolean;
      /** Page inside a frame: the simulation is offered. */
      framed: boolean;
    }
  | {
      kind: 'choose';
      /** Sentence with the end of the previous track. */
      question: string;
    };

/** What `#trkBtns` shows. */
export const trackerOverlay = signal<TrackerOverlay>({
  kind: 'idle',
  denied: false,
  framed: false,
});

/** How long « Prolonger » and « Nouvelle trace » stand beside START. */
const START_CHOICE_MS = 3000;

/** « Prolonger » and « Nouvelle trace » stand beside START (X and T). */
export const startChoice = signal(false);
let startChoiceTimer: ReturnType<typeof setTimeout> | undefined;

/** Hide « Prolonger » and « Nouvelle trace » beside START. */
export function hideStartChoice(): void {
  clearTimeout(startChoiceTimer);
  startChoice.value = false;
}

function showStartChoice(): void {
  startChoice.value = true;
  clearTimeout(startChoiceTimer);
  startChoiceTimer = setTimeout(hideStartChoice, START_CHOICE_MS);
}

/** Redraw the overlay of the tracker (legacy `drawTrkButtons`). */
export function drawTrkButtons(): void {
  trackerOverlay.value = {
    kind: 'idle',
    denied: state.view.gpsDenied.value && !state.view.tracking.value,
    framed: document.documentElement.classList.contains('in-frame'),
  };
}

/**
 * Ask whether to extend the previous track or to start a new one (legacy
 * `trkChooseStart`).
 */
export function trkChooseStart(): void {
  const last = store.get<Trip | null>(lastTripKey(), null);
  if (state.view.currentView.value !== 'tracker' || !last) return;
  // Around the map, the two choices are buttons beside START, for 3 s.
  if (railsScreen()) {
    showStartChoice();
    return;
  }
  const end = last.end ? fmtTime(new Date(last.end)) : '';
  const distance = last.det ? (last.det.dist as number) : 0;
  const detail = end ? ` (arrivée à ${end}, ${fr(distance)} NM)` : '';
  trackerOverlay.value = {
    kind: 'choose',
    question: `Une trace a déjà été enregistrée${detail}. Que voulez-vous faire ?`,
  };
}

/** Prolonger: resume the previous track. */
export function chooseExtend(): void {
  void afterChoice(extendLastTrip);
}

/** Nouvelle trace: forget the previous track and start from zero. */
export function chooseNew(): void {
  void afterChoice(() => {
    store.del(lastTripKey());
    return startTracking(false);
  });
}

/** Annuler: back to the idle overlay. */
export function chooseCancel(): void {
  buzz();
  drawTrkButtons();
}

/** The preview button: a fictional boat, for lack of GPS in a frame. */
export function simulateTrack(): void {
  state.view.simGps.value = true;
  state.view.gpsDenied.value = false;
  toast('Simulation : trace fictive');
  void quickStart();
}

async function afterChoice(action: () => Promise<void>): Promise<void> {
  buzz();
  hideStartChoice();
  stopMapWatch();
  await action();
  drawTrkButtons();
  trackerTick();
  updateTrkDash();
}
