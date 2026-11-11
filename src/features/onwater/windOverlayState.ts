import { signal } from '@preact/signals-react';

import { showOverlays } from './overlayRoot.ts';

/** Where a wind alert came from, for Live météo opened from its bubble. */
export interface AlertSpot {
  /** The station that measured the wind. */
  lat: number;
  lon: number;
  name: string;
  /** The boat when the alert was given: Live météo opens around it. */
  boat: { lat: number; lon: number } | null;
}

/**
 * The alert Live météo was opened from: it shows the whole circle and the
 * station of the alert blinking in a red band. Taken by the page once.
 */
export const liveAlertSpot = signal<AlertSpot | null>(null);

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

/** Remove the bubble and the flashes from the screen. */
export function clearWindOverlays(): void {
  windPopup.value = null;
  windFlashes.value = [];
}
