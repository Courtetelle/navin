import { batch, signal } from '@preact/signals-react';

import { pad } from '../../lib/format.ts';
import { navZone, state } from '../../state/index.ts';
import { setBodyClass } from '../bodyClass.ts';

/** What the top bar clock shows since the last tick. */
export interface ClockFace {
  /** Shows the zone (local) time, else UTC. */
  local: boolean;
  /** `HH:MM`. */
  time: string;
  /** Increases at every tick (re-fits the small label). */
  tick: number;
}

/** The clock content, computed at each tick like legacy `tickClock`. */
export const clockFace = signal<ClockFace>({
  local: false,
  time: '--:--',
  tick: 0,
});

let localUntil = 0;
let toggleTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Inland waters show the zone time and a tap shows UTC; at sea the opposite
 * (app.js:590-602). Also sets the body classes `zone-lac` and `zone-auto`.
 * @param now - Current time (ms).
 */
export function tickClock(now = Date.now()): void {
  let inland = false;
  try {
    inland = navZone() === 'lac';
  } catch {
    inland = false;
  }
  const local = inland !== now < localUntil;
  const date = new Date(now);
  const time = local
    ? `${pad(date.getHours())}:${pad(date.getMinutes())}`
    : `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
  batch(() => {
    clockFace.value = { local, time, tick: clockFace.value.tick + 1 };
    setBodyClass('zone-lac', inland);
    setBodyClass('zone-auto', !state.view.zoneSimV.value);
  });
}

/**
 * A tap on the clock switches UTC / zone time for 5 s; a second tap during
 * these 5 s switches back at once (app.js:604).
 */
export function toggleClock(): void {
  if (Date.now() < localUntil) {
    localUntil = 0;
  } else {
    localUntil = Date.now() + 5000;
    clearTimeout(toggleTimer);
    toggleTimer = setTimeout(() => tickClock(), 5050);
  }
  tickClock();
}
