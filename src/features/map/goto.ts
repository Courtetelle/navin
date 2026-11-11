import { signal } from '@preact/signals-react';

import { fmtDur } from '../../lib/format.ts';
import { bearing, distNM, rad } from '../../lib/geo.ts';
import { herePos, state, toast } from '../../state/index.ts';
import { store } from '../../storage/store.ts';

import { playAlarm } from './external.ts';
import { drawGotoLines, marksRedraw } from './marksDraw.ts';
import { bearingText, distanceText } from './relativeText.ts';

/** A Go to target (`ldb.goto`). */
interface GotoTarget {
  lat: number;
  lon: number;
  name: string;
  /** Arrival already signalled. @default undefined */
  arrived?: boolean;
}

/** Texts of the Go to bar; without position, only `waiting`. */
interface GotoBarTexts {
  name: string;
  /** Waiting for the GPS. */
  waiting: boolean;
  /** Distance, bold. @default '' */
  distance: string;
  /** Bearing, bold. @default '' */
  bearing: string;
  /** Course correction and time left. @default '' */
  tail: string;
}

/** The current target. */
export const gotoTarget = signal<GotoTarget | null>(
  store.get<GotoTarget | null>('ldb.goto', null),
);
/** What the Go to bar shows, `null` when no Go to is active. */
export const gotoBar = signal<GotoBarTexts | null>(null);

let positionWatch: number | null = null;

/**
 * Follow my position while a Go to or a menu needs it (legacy `wantPos`).
 * @param on - Follow it.
 */
function wantPos(on: boolean): void {
  if (on && positionWatch === null && navigator.geolocation) {
    positionWatch = navigator.geolocation.watchPosition(
      (position) => {
        const { coords } = position;
        state.view.myPos.value = {
          lat: coords.latitude,
          lon: coords.longitude,
          sog:
            coords.speed !== null && coords.speed >= 0
              ? coords.speed * 1.943844
              : null,
          cog: coords.heading,
          t: Date.now(),
        };
        gotoUpdate();
      },
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 30_000 },
    );
  }
  if (!on && positionWatch !== null) {
    navigator.geolocation.clearWatch(positionWatch);
    positionWatch = null;
  }
}

/**
 * Start or stop a Go to (legacy `setGoto`).
 * @param target - Target, or `null` to stop.
 */
export function setGoto(target: GotoTarget | null): void {
  gotoTarget.value = target;
  store.set('ldb.goto', target);
  wantPos(Boolean(target));
  gotoUpdate();
  marksRedraw();
  if (target) toast(`Go to ${target.name}`);
}

/**
 * Texts of the Go to bar for a position (legacy `gotoUpdate`).
 * @param target - Go to target.
 * @param me - My position, or `null`.
 * @returns The texts.
 */
export function gotoTexts(
  target: GotoTarget,
  me: { lat: number; lon: number; sog?: unknown; cog?: unknown } | null,
): GotoBarTexts {
  if (!me) {
    return {
      name: target.name,
      waiting: true,
      distance: '',
      bearing: '',
      tail: '',
    };
  }
  const distance = distNM(me, target);
  const direction = bearing(me, target);
  const speed = Number(me.sog);
  const course = me.cog;
  const moving =
    course !== null &&
    course !== undefined &&
    !Number.isNaN(course) &&
    speed > 0.5;
  const offset = moving
    ? ((direction - Number(course) + 540) % 360) - 180
    : null;
  let tail = '';
  if (offset !== null) {
    const turn = `${offset > 0 ? 'à droite' : 'à gauche'} ${Math.abs(Math.round(offset))}°`;
    tail = ` · ${Math.abs(offset) < 5 ? 'droit devant' : turn}`;
    const closing = speed * Math.cos(rad(offset));
    if (closing > 0.3) tail += ` · ${fmtDur((distance / closing) * 3_600_000)}`;
  }
  return {
    name: target.name,
    waiting: false,
    distance: distanceText(distance),
    bearing: bearingText(direction),
    tail,
  };
}

/** Refresh the Go to bar and the lines on the maps (legacy `gotoUpdate`). */
export function gotoUpdate(): void {
  const target = gotoTarget.value;
  if (!target) {
    gotoBar.value = null;
    return;
  }
  const me = herePos();
  if (me) signalArrival(target, distNM(me, target));
  gotoBar.value = gotoTexts(target, me);
  drawGotoLines();
}

/** Restart the Go to of a previous session (marks.js:195). */
export function resumeGoto(): void {
  wantPos(true);
  gotoUpdate();
}

function signalArrival(target: GotoTarget, distance: number): void {
  const limit = Number(state.preferences.settings.value.gotoArrive) || 30;
  if (distance * 1852 >= limit || target.arrived) return;
  gotoTarget.value = { ...target, arrived: true };
  toast(`Arrivé à ${target.name}`);
  // No sound on this device: the bubble is enough.
  playAlarm(1).catch(() => undefined);
}
