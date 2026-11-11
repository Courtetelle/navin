import type {
  Circle,
  LatLng,
  Map as LeafletMap,
  Marker,
  Polyline,
} from 'leaflet';

import { fmtTime } from '../../lib/format.ts';
import { state } from '../../state/index.ts';

import { glideBoat, stopGlide } from './boatFollow.ts';
import type { LatLngPair } from './constants.ts';
import { leaflet } from './leaflet.ts';
import { mapBearing, orientMap } from './mapOrientation.ts';
import { smoothLine } from './smoothLine.ts';
import { currentTrack } from './trackStats.ts';
import { updateTrkDash } from './trackerDash.ts';

/** The boat seen from above, bow up: it turns with the course. */
const BOAT_ICON =
  '<svg viewBox="0 0 34 34" width="34" height="34" aria-hidden="true"><path d="M17 1.5C23.5 9 25.5 17.5 23.5 27Q22.5 32 17 32T10.5 27C8.5 17.5 10.5 9 17 1.5Z" fill="#d00000" stroke="#fff" stroke-width="1.6"/><path d="M17 10Q25 17 19.5 27" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/><circle cx="17" cy="10" r="1.8" fill="#fff"/></svg>';

/** The tracker screen while it is open (legacy `trk`). */
export interface TrackerHandle {
  map: LeafletMap | null;
  /** Line of the recording in progress. */
  live: Polyline | null;
  /** Points of the recording drawn on `live`. */
  drawnPoints: number;
  /** From the last recorded point to the boat. */
  tail: Polyline | null;
  /** Boat arrow. */
  me: Marker | null;
  /** Accuracy circle. */
  acc: Circle | null;
  /** The map follows the boat. */
  follow: boolean;
  /** Moved by hand away from the boat: the map will come back to it. */
  drifted: boolean;
  /** Old track shown in purple. */
  others: Polyline | null;
  lastSog: number | null;
  lastCog: number | null;
  /**
   * Adds the Swiss layers (bathymetry, Lake Geneva depth lines, buoyage) once,
   * when the lake comes with NavIn after the map opened at sea.
   * @default undefined
   */
  addSwiss?: () => void;
}

/** A position given to the tracker. */
export interface TrackerFix {
  lat: number;
  lon: number;
  /** @default undefined */
  acc?: number | null;
  /** @default undefined */
  sog?: number | null;
  /** @default undefined */
  cog?: number | null;
}

/** A simulated point: pinned on the track, never written in the logbook. */
export interface SimulatedPin {
  ll: LatLngPair;
  t: number;
}

const PIN_PATH =
  'M12 1C6 1 1.5 5.6 1.5 11.4 1.5 19.5 12 33 12 33S22.5 19.5 22.5 11.4C22.5 5.6 18 1 12 1z';

/** The tracker handle, `null` when the screen is closed. */
export const tracker: { current: TrackerHandle | null } = { current: null };

/** Simulated points of the session. */
export const simulatedPins: SimulatedPin[] = [];

/**
 * The handle of a tracker just opened.
 * @returns A handle without map.
 */
export function newTracker(): TrackerHandle {
  return {
    map: null,
    live: null,
    drawnPoints: -1,
    tail: null,
    me: null,
    acc: null,
    follow: true,
    drifted: false,
    others: null,
    lastSog: null,
    lastCog: null,
  };
}

/**
 * Show a position on the open tracker (legacy `trkFix`): boat arrow, accuracy
 * circle, course, map follow and dashboard.
 * @param fix - The position.
 */
export function trkFix(fix: TrackerFix): void {
  const handle = tracker.current;
  const { map } = handle ?? {};
  if (!handle || !map || state.view.currentView.value !== 'tracker') return;
  const L = leaflet();
  const position: LatLngPair = [fix.lat, fix.lon];
  const known = handle.me && handle.acc ? handle.me.getLatLng() : null;
  if (handle.me && handle.acc) {
    if (fix.acc) handle.acc.setRadius(fix.acc);
  } else {
    handle.acc = L.circle(position, {
      radius: fix.acc || 10,
      color: '#0077ff',
      weight: 1,
      fillOpacity: 0.1,
    }).addTo(map);
    handle.me = L.marker(position, {
      icon: L.divIcon({
        className: 'trk-boat',
        html: `<div class="trk-arrow">${BOAT_ICON}</div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      }),
    }).addTo(map);
  }
  const target = L.latLng(position);
  const tooFar = handle.follow && !map.getBounds().contains(target);
  // At every scale: the map keeps the zoom chosen, and still turns smoothly.
  if (known && !tooFar) {
    glideBoat(
      {
        map,
        place: (at) => placeBoat(handle, at),
        turnBoat: trkShowCourse,
        follows: () => handle.follow,
      },
      { from: known, to: target, course: fix.cog, speed: fix.sog },
    );
  } else {
    stopGlide();
    placeBoat(handle, target);
    orientMap(map, fix.cog, fix.sog);
    trkShowCourse(fix.cog);
    // The scale chosen stays: the map follows the boat at its own zoom.
    if (handle.follow) {
      map.setView(position, map.getZoom(), { animate: false });
    }
  }
  handle.lastSog = fix.sog ?? null;
  handle.lastCog = fix.cog ?? null;
  updateTrkDash();
}

function placeBoat(handle: TrackerHandle, position: LatLng): void {
  handle.me?.setLatLng(position);
  handle.acc?.setLatLng(position);
  const last = state.view.tracking.peek() ? currentTrack().at(-1) : undefined;
  handle.tail?.setLatLngs(last ? [[last[1], last[2]], position] : []);
}

/**
 * Turn the boat to its course, as it appears on the screen.
 * @param course - Course of the boat (degrees), if known.
 */
export function trkShowCourse(course: number | null | undefined): void {
  const handle = tracker.current;
  const arrow = handle?.me?.getElement()
    ?.firstElementChild as HTMLElement | null;
  if (
    !handle?.map ||
    !arrow ||
    course === null ||
    course === undefined ||
    Number.isNaN(course)
  ) {
    return;
  }
  const angle = Math.round(course + mapBearing(handle.map)) % 360;
  arrow.style.transform = `rotate(${angle}deg)`;
}

/** Called at every point of the automatic log (legacy `trackerTick`). */
export function trackerTick(): void {
  const handle = tracker.current;
  if (!handle || state.view.currentView.value !== 'tracker') return;
  const line = currentTrackLine();
  if (line.length !== handle.drawnPoints) {
    handle.drawnPoints = line.length;
    handle.live?.setLatLngs(smoothLine(line));
  }
  const fix = state.view.lastFix.value;
  if (fix) {
    // The course of this GPS point: the one of the detector covers many metres.
    const detector = state.view.trip.value?.det;
    trkFix({
      lat: fix.lat,
      lon: fix.lon,
      sog: (fix.sog ?? detector?.lastSog) as number | null | undefined,
      cog: (fix.cog ?? detector?.lastCog) as number | null | undefined,
    });
  } else {
    updateTrkDash();
  }
}

/**
 * Line of the recording in progress.
 * @returns The `[lat, lon]` pairs.
 */
export function currentTrackLine(): LatLngPair[] {
  const line: LatLngPair[] = [];
  for (const [, lat, lon] of currentTrack()) line.push([lat, lon]);
  return line;
}

/**
 * Turn the follow of the boat on or off and light the blue arrow (legacy `setFollow`).
 * @param follow - Follow the boat.
 */
export function setFollow(follow: boolean): void {
  const handle = tracker.current;
  if (!handle) return;
  handle.follow = follow;
  handle.drifted = false;
  handle.map
    ?.getContainer()
    .querySelector('.map-locate-btn')
    ?.classList.toggle('on', follow);
}

/** Forget the recording on the tracker (legacy `trkReset`). */
export function trkReset(): void {
  const handle = tracker.current;
  if (!handle) return;
  handle.lastSog = null;
  handle.lastCog = null;
  simulatedPins.length = 0;
  handle.live?.setLatLngs([]);
  handle.tail?.setLatLngs([]);
  handle.drawnPoints = -1;
}

/**
 * Pin a point on the tracker (legacy `trkPin`).
 * @param position - `[lat, lon]`.
 * @param simulated - Point without GPS, drawn dashed.
 * @param text - Popup text.
 * @returns The marker, or `null` when the map is not ready.
 */
export function trkPin(
  position: LatLngPair,
  simulated: boolean,
  text: string,
): Marker | null {
  const map = tracker.current?.map;
  if (!map) return null;
  const L = leaflet();
  const dashed = simulated ? ' stroke-dasharray="3 2"' : '';
  const html = `<svg viewBox="0 0 24 34" width="26" height="36"><path d="${PIN_PATH}" fill="${simulated ? '#ff6b6b' : '#e02020'}" stroke="#fff" stroke-width="2"${dashed}/><circle cx="12" cy="11.5" r="4.2" fill="#fff"/></svg>`;
  const marker = L.marker(position, {
    icon: L.divIcon({
      className: 'trk-pin',
      html,
      iconSize: [26, 36],
      iconAnchor: [13, 35],
    }),
    zIndexOffset: 500,
  }).addTo(map);
  if (text) marker.bindPopup(text);
  return marker;
}

/** Pins of the recording in progress, and the simulated ones (legacy `trkDrawPins`). */
export function trkDrawPins(): void {
  const cruise = state.data.cruise.value;
  const trip = state.view.trip.value;
  if (!tracker.current?.map || !cruise || !trip?.start) return;
  for (const entry of cruise.entries) {
    const position = entry.v.pos;
    if (entry.pt && position && Date.parse(entry.t) >= trip.start - 60_000) {
      trkPin(
        [position.lat, position.lon],
        false,
        `📌 Point · ${fmtTime(new Date(entry.t))}`,
      );
    }
  }
  for (const pin of simulatedPins) {
    trkPin(pin.ll, true, `📌 Point simulé · ${fmtTime(new Date(pin.t))}`);
  }
}
