import { batch } from '@preact/signals-react';

import { buzz } from '../../lib/dom.ts';
import { inFrenchLeman } from '../../model/contacts.ts';
import { go } from '../../shell/router.ts';
import {
  sosLogActive,
  sosLogEnd,
  state,
  toast,
  updateSosLogs,
} from '../../state/index.ts';

import { ensureMobLogs } from './mobLog.ts';
import { refreshSosPage } from './safetyState.ts';
import { sosLogStart } from './sosLogStart.ts';

/** A simulated SOS position (legacy `sosSim`). */
interface SosSimulation {
  lat: number;
  lon: number;
  /** Start, epoch milliseconds. */
  t0: number;
}

const SIMULATION_STARTS: Readonly<Record<string, readonly [number, number]>> = {
  ch: [46.47, 6.62],
  fr: [46.418, 6.72],
  mer: [43.06, 5.98],
};

const EXERCISE_PLACES: Readonly<Record<string, string>> = {
  ch: 'large de Lausanne',
  fr: 'vers Meillerie, eaux françaises',
  mer: 'large de Toulon, en mer',
};

let exerciseBack: { from: string | null; all: boolean } | null = null;
let exerciseWasOn = false;
let simulationFrench: boolean | undefined;
let previousView: string | null = null;

/**
 * The running position simulation.
 * @returns The simulation, or `null`.
 */
export function sosSimulation(): SosSimulation | null {
  return state.view.sosSim.value as SosSimulation | null;
}

/**
 * A complete SOS exercise is running (legacy `sosExOn`).
 * @returns `true` when the running log is an exercise.
 */
export function sosExOn(): boolean {
  return Boolean(sosLogActive()?.ex);
}

/**
 * Start a position simulation (legacy `window.sosSimStart`).
 * @param kind - `ch`, `fr` or `mer`.
 */
export function sosSimStart(kind: string): void {
  const [lat, lon] = SIMULATION_STARTS[kind] ?? [46.47, 6.62];
  state.view.sosSim.value = { lat, lon, t0: Date.now() };
  simulationFrench = undefined;
  simulationStep();
}

/**
 * Advance the simulation: the boat leaves the SOS position at 3 knots, course
 * 060 (legacy `simStep`). The SOS page redraws when it crosses the border.
 */
export function simulationStep(): void {
  const simulation = sosSimulation();
  if (!simulation) return;
  const hours = (Date.now() - simulation.t0) / 3_600_000;
  const degrees = (hours * 3 + 0.15) / 60;
  const live = {
    lat: simulation.lat + degrees * Math.cos(Math.PI / 3),
    lon:
      simulation.lon +
      (degrees * Math.sin(Math.PI / 3)) /
        Math.cos((simulation.lat * Math.PI) / 180),
    at: new Date().toISOString(),
  };
  state.view.sosLive.value = live;
  const french = inFrenchLeman(live);
  const crossed = simulationFrench !== undefined && french !== simulationFrench;
  simulationFrench = french;
  if (crossed && state.view.currentView.value === 'sos') refreshSosPage();
}

/**
 * A `data-sossim` button: start or stop the simulation (settings and SOS page).
 * @param kind - `ch`, `fr`, `mer` or `stop`.
 */
export function sosSimToggle(kind: string): void {
  const onSosPage = state.view.currentView.value === 'sos';
  if (kind === 'stop' || (sosSimulation() && onSosPage)) stopSimulation();
  else sosSimStart(kind);
  buzz();
  if (sosSimulation() && !onSosPage) {
    go('sos');
    return;
  }
  if (onSosPage) refreshSosPage();
}

/**
 * Start a complete exercise: it runs like a real SOS, but the log is marked and
 * no call leaves (legacy `sosExStart`).
 * @param kind - `ch`, `fr` or `mer`.
 */
export function sosExStart(kind: string): void {
  if (sosLogActive() && !sosExOn()) {
    toast(
      '⚠ Une vraie procédure SOS est en cours : terminez-la avant un exercice',
    );
    return;
  }
  sosSimStart(kind);
  sosLogStart(`🧪 Exercice : touche SOS (${EXERCISE_PLACES[kind] ?? kind})`);
  const active = sosLogActive();
  if (active) {
    updateSosLogs((logs) => {
      const log = logs.find((item) => item.id === active.id);
      if (log) log.ex = true;
    });
  }
  exerciseBack =
    state.view.currentView.value === 'settings'
      ? {
          from: state.view.settingsFrom.value,
          all: state.view.settingsAll.value,
        }
      : null;
  exerciseWasOn = true;
  go('sos');
  setTimeout(() => {
    toast(
      '🧪 Exercice SOS commencé · aucun appel réel ne part · ⏹ Terminer l’exercice dans le bandeau',
    );
  }, 900);
}

/**
 * End the exercise and go back to Réglages › Simulation SOS (legacy `sosExEnd`).
 */
export function sosExEnd(): void {
  const back = exerciseBack;
  exerciseBack = null;
  if (sosExOn()) {
    ensureMobLogs();
    sosLogEnd();
  }
  exerciseCleanup();
  batch(() => {
    if (back) {
      state.view.settingsFrom.value = back.from;
      state.view.settingsAll.value = back.all;
      state.view.gear.value = Boolean(back.from);
    } else {
      state.view.settingsAll.value = true;
    }
    state.view.settingsOpen.value = 'simu';
  });
  const barHeight = navBarHeight();
  go('settings');
  revealSimulationSection(20, barHeight);
  toast(
    '✓ Exercice SOS terminé · log gardé dans data › Logs SOS (🧪 Exercice)',
  );
}

/**
 * Check once per second what legacy watched: arriving on the SOS page, leaving
 * it during a simulation, the end of an exercise (legacy `sosPosTick`).
 * @param fix - Reads the position.
 */
export function watchSosPage(fix: () => void): void {
  const view = state.view.currentView.value;
  if (view === 'sos' && previousView !== 'sos') fix();
  if (
    previousView === 'sos' &&
    view !== 'sos' &&
    sosSimulation() &&
    !sosExOn()
  ) {
    stopSimulation();
  }
  if (exerciseWasOn && !sosExOn()) exerciseCleanup();
  exerciseWasOn = sosExOn();
  previousView = view;
}

function exerciseCleanup(): void {
  exerciseWasOn = false;
  stopSimulation();
}

function stopSimulation(): void {
  batch(() => {
    state.view.sosSim.value = null;
    state.view.sosLive.value = null;
  });
}

function navBarHeight(): string {
  return document.documentElement.style.getPropertyValue('--navtop-h');
}

// The settings page is lazily loaded: its section shows up after `go`. The
// scroll padding still counts the nav bar of the screen just left, which
// settings hides right after this scroll.
function revealSimulationSection(attempts: number, barHeight: string): void {
  const section = document.querySelector<HTMLDetailsElement>(
    'details.set-sec[data-sec="simu"]',
  );
  if (section) {
    const root = document.documentElement.style;
    const shown = navBarHeight();
    section.open = true;
    root.setProperty('--navtop-h', barHeight);
    section.scrollIntoView({ block: 'start' });
    root.setProperty('--navtop-h', shown);
  } else if (attempts > 0) {
    setTimeout(() => revealSimulationSection(attempts - 1, barHeight), 50);
  }
}
