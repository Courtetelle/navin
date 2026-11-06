import type { Scenario } from '../types.ts';

import {
  CRUISE,
  IGNORE_NAME,
  NAVIN_TAB,
  START,
  here,
  quiet,
  track,
  trip,
} from './mapFixtures.ts';

const lastTrack = {
  ...quiet,
  [`ldb.track.${CRUISE}`]: track(8),
  [`ldb.lastTrip.${CRUISE}`]: {
    start: START,
    end: START + 480_000,
    from: 0,
    lochBase: 0,
    det: {
      turn: 30,
      every: 10,
      buf: [],
      dist: 1.2,
      lastSog: 4.2,
      lastCog: 123,
      lastPt: { lat: 46.49, lon: 6.48 },
    },
    dep: null,
    cands: [],
  },
};

const showControls = `(() => {
  const edge = document.querySelector('.ctl-edge');
  const at = (x) => ({ bubbles: true, clientX: x, clientY: 300, pointerId: 1 });
  edge.dispatchEvent(new PointerEvent('pointerdown', at(5)));
  edge.dispatchEvent(new PointerEvent('pointermove', at(60)));
  edge.dispatchEvent(new PointerEvent('pointerup', at(60)));
})()`;

/** The tracker: starting a track, recording, map buttons. */
export const trackerFlowScenarios: Scenario[] = [
  {
    name: 'map-tracker-choose',
    ignoreAttributes: IGNORE_NAME,
    fixture: 'sample-lake',
    overrides: lastTrack,
    steps: [
      { wait: 3000 },
      { snapshot: 'boot' },
      { click: NAVIN_TAB },
      { wait: 200 },
      { click: NAVIN_TAB },
      { wait: 200 },
      { snapshot: 'start-staged' },
      { longpress: NAVIN_TAB, ms: 800 },
      { wait: 500 },
      { snapshot: 'choose' },
      { click: '#trkCancel' },
      { wait: 300 },
      { snapshot: 'cancelled' },
    ],
  },
  {
    name: 'map-tracker-choose-new',
    ignoreAttributes: IGNORE_NAME,
    fixture: 'sample-lake',
    overrides: lastTrack,
    geolocation: here,
    steps: [
      { wait: 3000 },
      { click: NAVIN_TAB },
      { wait: 200 },
      { click: NAVIN_TAB },
      { wait: 200 },
      { longpress: NAVIN_TAB, ms: 800 },
      { wait: 500 },
      { click: '#trkNew' },
      { wait: 1000 },
      { snapshot: 'recording' },
    ],
  },
  {
    name: 'map-tracker-choose-extend',
    ignoreAttributes: IGNORE_NAME,
    fixture: 'sample-lake',
    overrides: lastTrack,
    geolocation: here,
    steps: [
      { wait: 3000 },
      { click: NAVIN_TAB },
      { wait: 200 },
      { click: NAVIN_TAB },
      { wait: 200 },
      { longpress: NAVIN_TAB, ms: 800 },
      { wait: 500 },
      { click: '#trkExtend' },
      { wait: 1000 },
      { snapshot: 'recording' },
    ],
  },
  {
    name: 'map-tracker-denied',
    fixture: 'sample-lake',
    overrides: {
      ...quiet,
      [`ldb.track.${CRUISE}`]: track(8),
      [`ldb.trip.${CRUISE}`]: trip,
    },
    steps: [{ wait: 4000 }, { snapshot: 'denied' }],
  },
  {
    name: 'map-tracker-recording',
    ignoreAttributes: IGNORE_NAME,
    fixture: 'sample-lake',
    overrides: {
      ...quiet,
      [`ldb.track.${CRUISE}`]: track(8),
      [`ldb.trip.${CRUISE}`]: trip,
    },
    geolocation: here,
    steps: [
      { wait: 2500 },
      { go: 'tracker' },
      { wait: 1500 },
      { snapshot: 'recording' },
      { click: NAVIN_TAB },
      { wait: 200 },
      { longpress: NAVIN_TAB, ms: 800 },
      { wait: 700 },
      { snapshot: 'point' },
    ],
  },
  {
    name: 'map-tracker-night',
    fixture: 'sample-lake',
    overrides: { ...quiet, 'ldb.settings': { theme: 'night' } },
    steps: [{ wait: 3000 }, { snapshot: 'night' }],
  },
  {
    name: 'map-tracker-controls',
    fixture: 'sample-lake',
    overrides: quiet,
    steps: [
      { wait: 3000 },
      { eval: showControls },
      { wait: 300 },
      { snapshot: 'shown' },
      { click: '.map-locate-btn' },
      { wait: 700 },
      { snapshot: 'located' },
      { click: '.leaflet-control-zoom-in' },
      { wait: 700 },
      { snapshot: 'zoomed' },
      { click: '.ctl-hide-btn' },
      { wait: 300 },
      { snapshot: 'hidden' },
    ],
  },
  {
    name: 'map-tracker-fullscreen',
    fixture: 'sample-lake',
    overrides: quiet,
    steps: [
      { wait: 3000 },
      { eval: showControls },
      { wait: 300 },
      { click: '.map-full-btn:not(.map-locate-btn):not(.ctl-hide-btn)' },
      { wait: 700 },
      { snapshot: 'full' },
      // The browser leaves full screen by itself (Escape).
      { eval: 'document.exitFullscreen()' },
      { wait: 700 },
      { snapshot: 'normal' },
    ],
  },
  {
    name: 'map-tracker-zone-cycle',
    fixture: 'sample-lake',
    overrides: quiet,
    steps: [
      { wait: 3000 },
      { longpress: NAVIN_TAB, ms: 800 },
      { wait: 700 },
      { snapshot: 'next-zone' },
    ],
  },
];
