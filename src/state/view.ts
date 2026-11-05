import { signal } from '@preact/signals-react';

import type { Fix } from '../model/types.ts';
import { store } from '../storage/store.ts';

/** The bubble shown by the shell (`id` changes on every call, so the same text can be shown twice). */
export interface ToastMessage {
  message: string;
  force: boolean;
  id: number;
}

/** A position with its time (`at`, ISO), as kept by the SOS and VHF pages. */
export interface TimedPosition {
  lat: number;
  lon: number;
  /** @default undefined */
  at?: string;
  [key: string]: unknown;
}

/** Live position of the map menus (`myPos` of marks.js). */
export interface LivePosition {
  lat: number;
  lon: number;
  sog: number | null;
  cog: number | null;
  /** Epoch milliseconds. */
  t: number;
}

/** A track recording in progress (`ldb.trip.<cruiseId>`); `det` is the tracking domain's detector. */
export interface Trip {
  start: number;
  /** @default undefined */
  from?: number;
  lochBase: number;
  det: Record<string, unknown>;
  dep: Record<string, unknown> | null;
  cands: Array<Record<string, unknown>>;
  /** @default undefined */
  gaps?: Array<{ from: number; to: number; nm: number }>;
  /** @default undefined */
  end?: number;
  [key: string]: unknown;
}

/** Crew composition being edited (data › Équipages). */
export interface CrewsEdit {
  id: string | null;
  name: string;
  crew: Array<{ memberId: string; fonction?: string }>;
  /** @default undefined */
  existing?: boolean;
  /** @default undefined */
  pendingNew?: Set<string>;
  [key: string]: unknown;
}

/** One stored track point: `[epoch ms, lat, lon]`. */
export type TrackPoint = [number, number, number];

/**
 * Ephemeral UI state (legacy cross-file globals). Nothing here is persisted,
 * except `zoneSimV`, read from the raw `ldb.zoneSim` at init and written by `setZoneSim`.
 */
export const view = {
  /** Current screen (legacy `currentView`). */
  currentView: signal<string>('new'),
  /** Argument of the current screen (second argument of `go`). */
  viewArg: signal<unknown>(null),
  /** Bubble to show; the shell renders it and handles its timer. */
  toast: signal<ToastMessage | null>(null),
  /** Tab the settings were opened from with the gear (null = from Plus). */
  settingsFrom: signal<string | null>(null),
  /** Settings section opened last (kept on refresh). */
  settingsOpen: signal<string | null>(null),
  /** All settings, by section. */
  settingsAll: signal<boolean>(false),
  /** Gear flag of the next `go('settings')` (legacy `go._gear`). */
  gear: signal<boolean>(false),
  /** Day sheet shown (YYYY-MM-DD), null = today. */
  currentDay: signal<string | null>(null),
  /** Times shown in local time only (lake procedures). */
  tzLocalOnly: signal<boolean>(false),
  /** Member card open: an id, `'new'`, or null. */
  crewFiche: signal<string | null>(null),
  /** Where the member card goes back to (`'list'`, `'crews'`, null). */
  crewFicheBack: signal<string | null>(null),
  /** Member card opened from data › Navigants. */
  ficheFromData: signal<boolean>(false),
  /** Crew composition being edited. */
  crewsEdit: signal<CrewsEdit | null>(null),
  /** Type chosen on the "new cruise" screen (`'mer'`, `'lacj'`, `'lacc'`). */
  newType: signal<string | null>(null),
  /** Purpose chosen for a new lake outing. */
  newPurpose: signal<string>('Entraînement'),
  /** The new cruise name was typed by hand. */
  nameDirty: signal<boolean>(false),
  /** Where the alphabet page goes back to. */
  alphaBack: signal<string>('more'),
  /** Position fixed by the SOS / VHF / MOB pages. */
  sosPos: signal<TimedPosition | null>(null),
  /** SOS page position simulation (developer mode). */
  sosSim: signal<unknown>(null),
  /** Last position read by the SOS page. */
  sosLive: signal<TimedPosition | null>(null),
  /** Zone simulation: `''` (automatic), `'lac'` or `'mer'` (raw `ldb.zoneSim`). */
  zoneSimV: signal<string>(''),
  /** A track is being recorded. */
  tracking: signal<boolean>(false),
  /** Last GPS fix of the tracker. */
  lastFix: signal<Fix | null>(null),
  /** Geolocation was refused. */
  gpsDenied: signal<boolean>(false),
  /** Track recording in progress. */
  trip: signal<Trip | null>(null),
  /** Track points being recorded. */
  trackBuf: signal<TrackPoint[] | null>(null),
  /** Simulated GPS (preview without GPS). */
  simGps: signal<boolean>(false),
  /** Live position of the map menus. */
  myPos: signal<LivePosition | null>(null),
};

/**
 * Put every view signal back to its initial value; the zone simulation is read
 * from the raw `ldb.zoneSim` (legacy app.js:349).
 */
export function resetView(): void {
  view.currentView.value = 'new';
  view.viewArg.value = null;
  view.toast.value = null;
  view.settingsFrom.value = null;
  view.settingsOpen.value = null;
  view.settingsAll.value = false;
  view.gear.value = false;
  view.currentDay.value = null;
  view.tzLocalOnly.value = false;
  view.crewFiche.value = null;
  view.crewFicheBack.value = null;
  view.ficheFromData.value = false;
  view.crewsEdit.value = null;
  view.newType.value = null;
  view.newPurpose.value = 'Entraînement';
  view.nameDirty.value = false;
  view.alphaBack.value = 'more';
  view.sosPos.value = null;
  view.sosSim.value = null;
  view.sosLive.value = null;
  view.zoneSimV.value = store.raw('ldb.zoneSim') || '';
  view.tracking.value = false;
  view.lastFix.value = null;
  view.gpsDenied.value = false;
  view.trip.value = null;
  view.trackBuf.value = null;
  view.simGps.value = false;
  view.myPos.value = null;
}
