import { batch, signal } from '@preact/signals-react';

import { uid } from '../../lib/format.ts';
import { applyWake } from '../../shell/wake.ts';
import {
  addEntry,
  lastTripKey,
  loadTrack,
  saveTrack,
  saveTrip,
  state,
  toast,
  trackSegmentsKey,
  tripKey,
} from '../../state/index.ts';
import { store } from '../../storage/store.ts';

import { addArrival } from './arrival.ts';
import { lochBefore } from './autoEntries.ts';
import { newDetector } from './detector.ts';
import { TICK_MIN } from './entrySelection.ts';
import { onFix } from './fixHandler.ts';
import {
  drawTrkButtons,
  loadLinkedDomains,
  windMuteEnd,
} from './trackerLink.ts';
import type { LiveTrip } from './tripState.ts';
import { liveTrip, publishTrip } from './tripState.ts';

/**
 * The arrival is being written: `tracking` is already false, but the trip stays
 * the one in progress until {@link stopTracking} ends.
 */
export const stopping = signal(false);

const { data, preferences, view } = state;
const { settings } = preferences;

let watchId: number | null = null;
let simulationTimer: ReturnType<typeof setInterval> | undefined;

/**
 * Start a recording, or resume the one in `state.view.trip` (legacy
 * `startTracking`). The departure entry is created at the first GPS point.
 * @param resume - Resume the current trip instead of starting a new one.
 * @param auto - Resumed by itself when the app came back.
 */
export function startTracking(resume = false, auto = false): void {
  if (!('geolocation' in navigator)) {
    toast('GPS non disponible sur cet appareil');
    return;
  }
  loadLinkedDomains();
  const { autoTurn } = settings.peek();
  const trip = liveTrip();
  if (resume && trip) {
    trip.det.turn = autoTurn;
    trip.det.buf = [];
    trip.cands = trip.cands ?? [];
  } else {
    const from = loadTrack().length;
    if (from > 0) noteSegment(from);
    view.trip.value = {
      start: Date.now(),
      from,
      lochBase: lochBefore(new Date().toISOString()),
      det: newDetector({ turn: autoTurn, every: TICK_MIN }),
      dep: null,
      cands: [],
    };
  }
  saveTrip();
  view.trackBuf.value = loadTrack();
  view.tracking.value = true;
  view.trackPaused.value = false;
  void applyWake();
  startWatch();
  toast(startMessage(resume, auto));
  publishTrip();
}

/**
 * Stop the recording (legacy `stopTracking`). With the arrival, the entries to
 * keep are chosen among the candidates and the trip can be extended later;
 * without it, the trip stays stored and is resumed next time.
 * @param withArrival - End the navigation.
 * @returns Resolves once every entry is written.
 */
export async function stopTracking(withArrival: boolean): Promise<void> {
  clearInterval(simulationTimer);
  simulationTimer = undefined;
  if (watchId !== null) navigator.geolocation.clearWatch(watchId);
  watchId = null;
  stopping.value = view.tracking.peek();
  view.tracking.value = false;
  view.trackPaused.value = false;
  windMuteEnd();
  const buffer = view.trackBuf.peek();
  if (buffer) saveTrack(buffer);
  const trip = liveTrip();
  const lastPoint = trip?.det.lastPt;
  if (withArrival && trip?.dep && lastPoint) {
    await addArrival(trip, trip.dep, lastPoint);
  }
  if (withArrival && trip) {
    trip.end = Date.now();
    store.set(lastTripKey(), trip);
  }
  if (withArrival) store.del(tripKey());
  batch(() => {
    view.trip.value = null;
    stopping.value = false;
  });
  void applyWake();
  publishTrip();
}

/**
 * Resume the last finished track: same trip, the hole is joined by a straight
 * line (legacy `extendLastTrip`).
 */
export function extendLastTrip(): void {
  const last = store.get<LiveTrip | null>(lastTripKey(), null);
  if (!last) {
    startTracking(false);
    return;
  }
  last.cands = [];
  delete last.end;
  view.trip.value = last;
  store.del(lastTripKey());
  startTracking(true);
  addEntry({
    id: uid(),
    t: new Date().toISOString(),
    auto: true,
    v: { note: 'Reprise de la trace précédente' },
  });
}

/**
 * A web page cannot read the GPS while closed: when the app comes back, the
 * recording resumes alone and the hole is joined by a straight line. Only the
 * arrival ends a track (legacy `autoResumeTrip`).
 */
export function autoResumeTrip(): void {
  if (
    !data.cruise.value ||
    view.tracking.peek() ||
    !('geolocation' in navigator)
  ) {
    return;
  }
  const stored = store.get<LiveTrip | null>(tripKey(), null);
  if (!stored) return;
  view.trip.value = stored;
  startTracking(true, true);
}

/**
 * Follow the app life cycle: save the recording when hidden or closed, watch
 * again or resume when back (auto.js:418-422).
 */
export function followPageLife(): void {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      saveRecording();
    } else if (view.tracking.peek()) {
      startWatch();
    } else {
      autoResumeTrip();
    }
  });
  globalThis.addEventListener('pagehide', saveRecording);
}

function saveRecording(): void {
  const buffer = view.trackBuf.peek();
  if (view.tracking.peek() && buffer) {
    saveTrack(buffer);
    saveTrip();
  }
}

function startMessage(resume: boolean, auto: boolean): string {
  if (auto) return '🛰 Enregistrement de la trace repris';
  return resume
    ? 'Suivi repris'
    : 'Suivi démarré : l’entrée de départ sera créée au premier point GPS';
}

function noteSegment(from: number): void {
  const key = trackSegmentsKey();
  const segments = store.get<number[]>(key, []);
  if (!segments.includes(from)) store.set(key, [...segments, from]);
}

// A fictional boat leaves Morges to the south-west at 5 kn: preview without GPS.
function startSimulation(): void {
  clearInterval(simulationTimer);
  let step = 0;
  let time = Date.now();
  const advance = () => {
    step++;
    time += 10_000;
    onFix({
      timestamp: time,
      coords: {
        latitude: 46.505 - step * 0.000_25,
        longitude: 6.497 - step * 0.0003,
        accuracy: 5,
        speed: 2.6,
        heading: 222,
      },
    });
  };
  advance();
  simulationTimer = setInterval(advance, 2000);
}

function startWatch(): void {
  if (view.simGps.peek()) {
    startSimulation();
    return;
  }
  if (watchId !== null) navigator.geolocation.clearWatch(watchId);
  watchId = navigator.geolocation.watchPosition(
    onFix,
    (error) => {
      if (error.code !== 1) return;
      view.gpsDenied.value = true;
      void stopTracking(false);
      toast('📍 Localisation refusée : trace impossible');
      drawTrkButtons();
    },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 60_000 },
  );
}
