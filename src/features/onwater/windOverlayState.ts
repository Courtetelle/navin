import { signal } from '@preact/signals-react';

import { go } from '../../shell/router.ts';
import { state } from '../../state/index.ts';
import { store } from '../../storage/store.ts';

import type { AlertReport } from './alertPublish.ts';
import { LAST_ALERT_KEY } from './lastWindAlert.ts';
import type { LiveStation } from './liveStations.ts';
import { onLake } from './onLake.ts';
import { showOverlays } from './overlayRoot.ts';
import type { WindReading } from './windTypes.ts';

/** Where a wind alert came from, for LiveMétéo opened from its bubble. */
export interface AlertSpot {
  /** The station that measured the wind. */
  lat: number;
  lon: number;
  name: string;
  /** The boat when the alert was given: LiveMétéo opens around it. */
  boat: { lat: number; lon: number } | null;
  /**
   * A forecast alert: the point of the model, the zone its value stands for
   * and the colour of that wind, as a station badge.
   */
  zone?: { km: number; color: string };
}

/**
 * The alert LiveMétéo was opened from: it shows the whole circle and the
 * station of the alert crowned and blinking. Taken by the map once.
 */
export const liveAlertSpot = signal<AlertSpot | null>(null);

/**
 * LiveMétéo asked from a wind alert (« LiveMétéo » of its bubble): the
 * time asked, 0 once the NavIn map has laid its stations.
 */
export const liveAlertAsk = signal(0);

/**
 * Open LiveMétéo on the NavIn map from a wind alert.
 * @param spot - Where the alert came from, or null (a test).
 */
export function askLiveFromAlert(spot: AlertSpot | null): void {
  liveAlertSpot.value = spot;
  liveAlertAsk.value = Date.now();
}

/**
 * Back to the alert bubble a screen was opened from (its 👁): the screen
 * takes it once and its ◀ Alerte runs it.
 */
export const bubbleBack = signal<(() => void) | null>(null);

/**
 * Leave an alert bubble for a screen; ◀ Alerte on that screen comes back
 * to where it was and shows the bubble again.
 * @param restore - Shows the bubble again.
 * @param view - The screen.
 * @param arg - Its argument.
 */
export function leaveBubble(
  restore: () => void,
  view: string,
  arg: unknown = null,
): void {
  const from = state.view.currentView.peek();
  bubbleBack.value = () => {
    go(from === view ? 'tracker' : from);
    restore();
  };
  go(view, arg);
}

/**
 * The station card opened from the 👁 of a wind bubble. Taken by the
 * `meteo` screen once.
 */
export const alertDetail = signal<LiveStation | null>(null);

/**
 * Open the whole card of the station of an alert, as a long press on its
 * badge in LiveMétéo does, without LiveMétéo; its ◀ shows the bubble again.
 * @param content - The bubble.
 * @param station - Its station.
 */
export function openAlertDetail(
  content: WindPopupContent,
  station: LiveStation,
): void {
  windPopup.value = null;
  alertDetail.value = station;
  leaveBubble(() => {
    windPopup.value = content;
  }, 'meteo');
}

/**
 * The station of an alert, as LiveMétéo reads it; none for a forecast.
 * @param reading - The reading of the alert.
 * @param forecast - A forecast of a model.
 * @returns The station, or null.
 */
export function alertStation(
  reading: WindReading,
  forecast: boolean,
): LiveStation | null {
  if (forecast || reading.lat == null || reading.lon == null) return null;
  return {
    ...reading,
    id: reading.id ?? reading.name,
    lat: reading.lat,
    lon: reading.lon,
    net: reading.net ?? 'MeteoSwiss',
  };
}

/** One colour flash of the screen (legacy `.wind-flash`). */
export interface WindFlash {
  /** Unique key. */
  id: number;
  /** Background colour. */
  color: string;
  /** Text colour. */
  ink: string;
  /** Wind in knots. */
  knots: number;
  /** Beaufort force. */
  force: number;
  /** Forecast wind, not measured. */
  forecast: boolean;
  /** The other wind, in small (mean wind under the gusts, or the gusts). */
  other: string;
}

/** Content of the wind bubble (legacy `windPopShow`). */
export interface WindPopupContent {
  /** Beaufort force. */
  bf: number;
  /** Wind text, e.g. `18 nd en rafales`. */
  kn: string;
  /** Where the wind blows. */
  where: string;
  /**
   * Sea state from the model.
   * @default undefined
   */
  sea?: string;
  /**
   * WMO reference.
   * @default undefined
   */
  omm?: string;
  /**
   * Remark of the test mode.
   * @default undefined
   */
  note?: string;
  /**
   * Text of the closing line.
   * @default 'Toucher pour fermer'
   */
  closeTxt?: string;
  /**
   * The alert to publish (its reading and where): a « Partager » button.
   * @default undefined
   */
  report?: AlertReport;
  /**
   * Opens the live weather conditions screen, from its button.
   * @default undefined
   */
  onLive?: () => void;
  /**
   * The other wind, in small under the big line.
   * @default undefined
   */
  other?: string;
  /**
   * Stop button of the test mode.
   * @default undefined
   */
  onStop?: () => void;
  /**
   * Runs when the bubble is touched.
   * @default undefined
   */
  onClose?: () => void;
}

/** Flashes on screen. */
export const windFlashes = signal<readonly WindFlash[]>([]);

/** Bubble on screen, null when closed. */
export const windPopup = signal<WindPopupContent | null>(null);

let nextFlashId = 1;

/**
 * Show a flash of the screen.
 * @param flash - Colours and wind.
 */
export function addWindFlash(flash: Omit<WindFlash, 'id'>): void {
  showOverlays();
  windFlashes.value = [...windFlashes.value, { ...flash, id: nextFlashId++ }];
}

/**
 * Remove a finished flash.
 * @param id - Flash key.
 */
export function removeWindFlash(id: number): void {
  windFlashes.value = windFlashes.value.filter((flash) => flash.id !== id);
}

/**
 * Show the wind bubble, replacing the one on screen (legacy `windPopShow`).
 * @param content - Bubble content.
 */
export function showWindPopup(content: WindPopupContent): void {
  showOverlays();
  windPopup.value = content;
}

/** The last automatic alert: its bubble, and when it was given. */
interface LastAlert {
  content: WindPopupContent;
  at: number;
}

let lastAlert: LastAlert | null = null;

/**
 * Show the bubble of an automatic alert, and keep it to show it again.
 * @param content - Bubble content.
 */
export function showWindAlert(content: WindPopupContent): void {
  lastAlert = { content, at: Date.now() };
  // Kept on the device without its actions: the text comes back after a restart.
  const { onLive, onStop, onClose, ...text } = content;
  store.set(LAST_ALERT_KEY, { content: text, at: lastAlert.at });
  showWindPopup(content);
}

/**
 * Show again the text of the last automatic alert.
 * @returns Whether there was one.
 */
export function replayWindAlert(): boolean {
  const last = lastAlert ?? store.get<LastAlert | null>(LAST_ALERT_KEY, null);
  if (!last) return false;
  const time = new Date(last.at).toLocaleTimeString('fr-CH', {
    hour: '2-digit',
    minute: '2-digit',
  });
  // An alert kept before the lake lost its sea state: shown without it.
  const sea = onLake() ? { sea: '', omm: '' } : {};
  showWindPopup({
    ...last.content,
    ...sea,
    note: [`🔁 Alerte de ${time}`, last.content.note]
      .filter(Boolean)
      .join(' · '),
  });
  return true;
}

/** Remove the bubble and the flashes from the screen. */
export function clearWindOverlays(): void {
  windPopup.value = null;
  windFlashes.value = [];
}
