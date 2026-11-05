import { signal } from '@preact/signals-react';

import { frN } from '../../lib/format.ts';
import { navZone, state, toast } from '../../state/index.ts';

import {
  dangerBuzz,
  depthBeep,
  depthBuzz,
  sirenOff,
  sirenOn,
} from './depthAudio.ts';
import { depthIntensity, estimateDepth, sondeMin } from './depthEstimate.ts';
import { showDepthOverlay } from './depthOverlay.ts';
import { depthOverlayState } from './depthOverlayState.ts';
import { isobathLoad } from './trackerLink.ts';

/** A scenario of the alarm test. */
interface DepthScenario {
  name: string;
  /** Duration in seconds. */
  duration: number;
  /** Depth at a time, for a minimum sounding. */
  depthAt: (seconds: number, minimum: number) => number;
}

/** Key of a test scenario. */
export type DepthScenarioKey = 'lent' | 'vite';

/** The test scenarios of the settings. */
export const DEPTH_SCENARIOS: Record<DepthScenarioKey, DepthScenario> = {
  lent: {
    name: 'Approche lente d’un haut-fond',
    duration: 40,
    depthAt: (seconds, minimum) => {
      const high = minimum + depthStart() + 0.6;
      const low = minimum - 0.4;
      return seconds < 30
        ? high - ((high - low) * seconds) / 30
        : low + ((seconds - 30) / 10) * (high - low);
    },
  },
  vite: {
    name: 'Remontée brutale du fond',
    duration: 20,
    depthAt: (seconds, minimum) => {
      const high = minimum + depthStart() + 0.5;
      const low = minimum - 0.8;
      if (seconds < 6) return high - ((high - low) * seconds) / 6;
      return seconds < 14 ? low : low + ((seconds - 14) / 6) * (high - low);
    },
  },
};

/** Text of the test progress in the settings (`#depthTestState`). */
export const depthTestState = signal('');

let level = 0;
let muteUntil = 0;
let beepTimer: ReturnType<typeof setTimeout> | undefined;
let testTimer: ReturnType<typeof setInterval> | undefined;

/**
 * Margin above the minimum sounding where the alarm starts (legacy `depthStart`).
 * @returns The margin (m), 1 by default.
 */
export function depthStart(): number {
  const start = state.preferences.settings.peek().depthStart;
  return typeof start === 'number' ? start : 1;
}

/**
 * Show the alarm: a yellow to red flash faster as the margin shrinks, beeps and
 * vibrations; under the minimum sounding a red flash and a siren (legacy
 * `depthAlarmSet`).
 * @param intensity - 0 hides it, 1 is the maximum.
 * @param depth - Water under the boat (m).
 * @param minimum - Minimum sounding (m).
 * @param test - The alarm test is running.
 */
export function depthAlarmSet(
  intensity: number,
  depth?: number | null,
  minimum?: number | null,
  test = false,
): void {
  level = intensity;
  showDepthOverlay();
  clearTimeout(beepTimer);
  const danger =
    intensity > 0 && depth != null && minimum != null && depth < minimum;
  if (!danger || Date.now() < muteUntil) sirenOff();
  const previous = depthOverlayState.peek();
  if (intensity <= 0 || depth == null || minimum == null) {
    depthOverlayState.value = { ...previous, on: false, danger };
    return;
  }
  const settings = state.preferences.settings.peek();
  depthOverlayState.value = {
    ...previous,
    on: true,
    danger,
    noFlash: settings.depthFlash === false,
    test,
    color: danger
      ? 'hsl(0, 100%, 50%)'
      : `hsl(${Math.round(55 - 55 * intensity)}, 100%, 50%)`,
    opacity: danger ? '0.9' : (0.25 + 0.55 * intensity).toFixed(2),
    period: danger ? '0.25s' : `${(1.2 - 0.95 * intensity).toFixed(2)}s`,
    title: `${test ? 'TEST · ' : ''}Fond ≈ ${frN(depth)} m`,
    subtitle: marginText(depth, minimum),
  };
  if (danger && Date.now() > muteUntil) sirenOn();
  alarmLoop(danger);
}

/**
 * Cut the sound for one minute; the flash and the vibrations stay (`#daMute`).
 */
export function depthMute(): void {
  muteUntil = Date.now() + 60_000;
  sirenOff();
  toast('Son coupé 1 min · le clignotement et les vibrations restent');
}

/**
 * Run a virtual scenario of the settings (legacy `depthTestStart`).
 * @param key - Scenario.
 */
export function depthTestStart(key: DepthScenarioKey): void {
  const scenario = DEPTH_SCENARIOS[key];
  const minimum = sondeMin() ?? 2;
  clearInterval(testTimer);
  const startedAt = Date.now();
  testTimer = setInterval(() => {
    const seconds = (Date.now() - startedAt) / 1000;
    if (seconds > scenario.duration) {
      depthTestStop(true);
      return;
    }
    const depth = Math.round(scenario.depthAt(seconds, minimum) * 10) / 10;
    const shown = Math.max(0, depth);
    depthAlarmSet(
      depthIntensity(depth, minimum, depthStart()),
      shown,
      minimum,
      true,
    );
    depthTestState.value = `${scenario.name} : ${Math.round(seconds)} s / ${scenario.duration} s · fond ${frN(shown)} m · sonde min. ${frN(minimum)} m`;
  }, 250);
  const startDepth = Math.round((minimum + depthStart()) * 10) / 10;
  toast(
    `Test : ${scenario.name} · l’alarme démarre à ${frN(startDepth)} m (sonde min. + ${frN(depthStart())} m)`,
  );
}

/**
 * End the test (legacy `depthTestStop`).
 * @param finished - It ran to its end.
 */
export function depthTestStop(finished: boolean): void {
  clearInterval(testTimer);
  testTimer = undefined;
  depthAlarmSet(0);
  sirenOff();
  depthTestState.value = finished ? 'Test terminé.' : 'Test arrêté.';
}

/**
 * Real watch: every 2 s, with the last fresh GPS position, on a lake only.
 */
export function startDepthWatch(): void {
  setInterval(() => {
    watchDepth().catch(() => undefined);
  }, 2000);
}

async function watchDepth(): Promise<void> {
  if (testTimer !== undefined) return;
  const clear = () => {
    if (level) depthAlarmSet(0);
  };
  if (state.preferences.settings.peek().depthAlarm === false) {
    clear();
    return;
  }
  const position = state.view.lastFix.peek() ?? state.view.sosPos.peek();
  if (
    !position?.at ||
    Date.now() - new Date(position.at).getTime() > 15_000 ||
    navZone() !== 'lac'
  ) {
    clear();
    return;
  }
  const minimum = sondeMin();
  if (minimum === null) return;
  const contours = await isobathLoad();
  const depth = estimateDepth(contours, position.lat, position.lon);
  depthAlarmSet(depthIntensity(depth, minimum, depthStart()), depth, minimum);
}

function marginText(depth: number, minimum: number): string {
  const margin = Math.round((depth - minimum) * 10) / 10;
  return margin >= 0
    ? `Marge sous la sonde min. (${frN(minimum)} m) : ${frN(margin)} m`
    : `⚠ SOUS la sonde min. (${frN(minimum)} m) de ${frN(-margin)} m`;
}

function alarmLoop(danger: boolean): void {
  if (level <= 0) return;
  if (!danger && Date.now() > muteUntil) depthBeep(level);
  // The vibrations go on when the sound is cut.
  if (danger) dangerBuzz();
  else depthBuzz(level);
  beepTimer = setTimeout(
    () => alarmLoop(danger),
    danger ? 1100 : Math.round(1100 - 950 * level),
  );
}
