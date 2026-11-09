import { batch, signal } from '@preact/signals-react';

import type { Place } from '../../features/map/shownMap.ts';
import {
  defaultMapCenter,
  shownMapCenter,
} from '../../features/map/shownMap.ts';
import { pad } from '../../lib/format.ts';
import { sunTimes } from '../../lib/sun.ts';
import { lastKnownPos, navZone, state, toast } from '../../state/index.ts';
import { setBodyClass } from '../bodyClass.ts';

/** What the top bar clock shows since the last tick. */
export interface ClockFace {
  /** Shows the zone (local) time, else UTC. */
  local: boolean;
  /** `HH:MM`. */
  time: string;
  /** Increases at every tick (re-fits the small label). */
  tick: number;
  /**
   * Shows the sunrise or the sunset instead of the current time.
   * @default undefined
   */
  sun?: 'rise' | 'set';
}

/** The clock content, computed at each tick like legacy `tickClock`. */
export const clockFace = signal<ClockFace>({
  local: false,
  time: '--:--',
  tick: 0,
});

let localUntil = 0;
let toggleTimer: ReturnType<typeof setTimeout> | undefined;
let sunTimer: ReturnType<typeof setInterval> | undefined;

/** Sunrise and sunset shown four times each, in turn. */
const SUN_STEPS = 8;
/** How long each sun time stays on the clock. */
const SUN_STEP_MS = 2000;
/** A GPS position younger than this means the GPS is on. */
const GPS_FRESH_MS = 120_000;

/**
 * Inland waters show the zone time and a tap shows UTC; at sea the opposite
 * (app.js:590-602). Also sets the body classes `zone-lac` and `zone-auto`.
 * @param now - Current time (ms).
 */
export function tickClock(now = Date.now()): void {
  if (sunTimer !== undefined) return;
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
  if (stopSun()) {
    tickClock();
    return;
  }
  if (Date.now() < localUntil) {
    localUntil = 0;
  } else {
    localUntil = Date.now() + 5000;
    clearTimeout(toggleTimer);
    toggleTimer = setTimeout(() => tickClock(), 5050);
  }
  tickClock();
}

/**
 * Where the sun times are computed: the GPS position when it is on, else the
 * centre of the map last shown, else the last known position, else where the
 * map opens.
 * @param now - Current time (ms).
 * @returns The place.
 */
export function sunPlace(now = Date.now()): Place {
  const live = state.view.myPos.value;
  if (live && now - live.t < GPS_FRESH_MS) return live;
  const fix = state.view.lastFix.value;
  if (fix?.at && now - Date.parse(fix.at) < GPS_FRESH_MS) return fix;
  return (
    shownMapCenter() ?? lastKnownPos() ?? defaultMapCenter(navZone() === 'lac')
  );
}

/**
 * A long press on the clock shows today's sunrise and sunset in turn, four
 * times each, 2 s at a time (16 s), in the time the clock shows (UTC or zone
 * time), then the time again.
 * @param now - Current time (ms).
 */
export function showSunTimes(now = Date.now()): void {
  stopSun();
  const place = sunPlace(now);
  const times = sunTimes(now, place.lat, place.lon);
  if (!times) {
    toast("Pas de lever ni de coucher du soleil aujourd'hui");
    return;
  }
  const local = clockFace.value.local;
  const text = (at: number) => {
    const date = new Date(at);
    return local
      ? `${pad(date.getHours())}:${pad(date.getMinutes())}`
      : `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
  };
  let step = 0;
  const show = () => {
    if (step >= SUN_STEPS) {
      stopSun();
      tickClock();
      return;
    }
    const sun = step % 2 === 0 ? 'rise' : 'set';
    step += 1;
    clockFace.value = {
      local,
      time: text(times[sun]),
      tick: clockFace.value.tick + 1,
      sun,
    };
  };
  show();
  sunTimer = setInterval(show, SUN_STEP_MS);
}

/**
 * Stop showing the sun times.
 * @returns They were shown.
 */
function stopSun(): boolean {
  if (sunTimer === undefined) return false;
  clearInterval(sunTimer);
  sunTimer = undefined;
  return true;
}
