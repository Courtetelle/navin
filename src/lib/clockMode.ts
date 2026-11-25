import { signal } from '@preact/signals-react';

/**
 * The top bar clock shows UTC (red): then every time of day in the app is
 * shown in UTC too, and in red (`src/shell/utcHighlight.ts`). Set by the
 * clock at each tick; `false` (the phone's time) until it first ticks.
 */
export const utcClock = signal(false);

/**
 * Whether times are shown in UTC; read during a render, it subscribes the
 * component to the clock.
 * @returns `true` when the clock shows UTC.
 */
export function showsUtc(): boolean {
  return utcClock.value;
}

/**
 * The `timeZone` option of `Intl` for a time on screen.
 * @returns `'UTC'` when the clock shows UTC, else `undefined` (the phone's).
 */
export function shownZone(): 'UTC' | undefined {
  return utcClock.value ? 'UTC' : undefined;
}

/**
 * The offset of a forecast's local time as shown: none in UTC.
 * @param offset - Offset of the place's local time (s).
 * @returns The offset to add to UTC (s).
 */
export function shownOffset(offset: number): number {
  return utcClock.value ? 0 : offset;
}

/**
 * Written after an hour in words, « 14 h », « 14 h 30 »: « UTC » when the
 * clock shows UTC, so that text read away from the screen says it too.
 * @returns `' UTC'` or `''`.
 */
export function utcMark(): string {
  return utcClock.value ? ' UTC' : '';
}

/** A moment split as shown on screen. */
export interface ShownParts {
  year: number;
  /** 1 to 12. */
  month: number;
  day: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/**
 * Year, month, day, hours, minutes and seconds of a moment as shown: UTC when
 * the clock shows UTC, else the phone's time.
 * @param date - Moment.
 * @returns Its parts.
 */
export function shownParts(date: Date): ShownParts {
  if (utcClock.value) {
    return {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
      hours: date.getUTCHours(),
      minutes: date.getUTCMinutes(),
      seconds: date.getUTCSeconds(),
    };
  }
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hours: date.getHours(),
    minutes: date.getMinutes(),
    seconds: date.getSeconds(),
  };
}
