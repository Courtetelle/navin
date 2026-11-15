import { signal } from '@preact/signals-react';

import { uid } from '../../lib/format.ts';
import type { Position } from '../../model/types.ts';
import { addEntry, state } from '../../state/index.ts';

import { contextPlace } from './externals.ts';
import { lakeFix } from './lakeFix.ts';
import type {
  LightningArea,
  LightningReport,
  LightningSettings,
  LightningSignal,
  LightningSpots,
} from './lightning.ts';
import {
  lightningAlertOn,
  lightningDue,
  lightningRadiusNm,
  lightningReport,
  lightningSize,
  lightningSpots,
  lightningText,
  lightningTimes,
  lightningUrl,
  nmToKm,
} from './lightning.ts';
import type { LightningPop } from './lightningPop.ts';
import { lightningPop } from './lightningPop.ts';
import { showOverlays } from './overlayRoot.ts';
import { playLightning } from './windAudio.ts';

/** The last look at the lightning around the boat. */
export const lightningLast = signal<LightningReport | null>(null);
/** A look is running. */
export const lightningBusy = signal(false);

/**
 * The bubble of the alert, above every screen.
 * @param pop - What it shows.
 */
function showPop(pop: LightningPop): void {
  showOverlays();
  lightningPop.value = pop;
}

/** The images are read this often while the alert is on. */
const EVERY_MS = 5 * 60_000;

let timer: ReturnType<typeof setInterval> | undefined;
let lastSignal: LightningSignal | null = null;

/**
 * The lightning settings.
 * @returns They, empty by default.
 */
export function lightningSettings(): LightningSettings {
  return state.preferences.settings.peek().lightning ?? {};
}

/**
 * One image read into its pixels (EUMETView lets any site read them).
 * @param url - The image.
 * @param size - Width and height.
 * @returns RGBA, or null when it could not be read.
 */
function readPixels(
  url: string,
  size: number,
): Promise<Uint8ClampedArray | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    const timeout = setTimeout(() => resolve(null), 30_000);
    image.addEventListener('load', () => {
      clearTimeout(timeout);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) {
          resolve(null);
          return;
        }
        context.drawImage(image, 0, 0, size, size);
        resolve(context.getImageData(0, 0, size, size).data);
      } catch {
        resolve(null);
      }
    });
    image.addEventListener('error', () => {
      clearTimeout(timeout);
      resolve(null);
    });
    image.src = url;
  });
}

/**
 * The flashes of the last quarter of an hour around a place.
 * @param area - Centre and radius.
 * @param now - Epoch ms.
 * @returns The report, or null when the images could not be read.
 */
export async function readLightning(
  area: LightningArea,
  now = Date.now(),
): Promise<LightningReport | null> {
  const size = lightningSize(area.km);
  const times = lightningTimes(now);
  const images = await Promise.all(
    times.map((time) => readPixels(lightningUrl(area, size, time), size)),
  );
  const spots: LightningSpots[] = [];
  for (const pixels of images) {
    if (pixels) spots.push(lightningSpots(pixels, size, area));
  }
  if (spots.length === 0) return null;
  return lightningReport(spots, times[0] ?? now, now);
}

/**
 * Where to look: the zone chosen with NavIn, else the GPS, else the map.
 * @param done - Receives the place, or null.
 */
export function lookPlace(done: (position: Position | null) => void): void {
  if (state.view.zoneSimV.peek()) {
    const { lat, lon } = contextPlace();
    done({ lat, lon });
    return;
  }
  // Without GPS, where the map looks.
  lakeFix((position) => {
    if (position) {
      done(position);
      return;
    }
    const { lat, lon } = contextPlace();
    done({ lat, lon });
  });
}

/**
 * Look now: read the images, keep the report, and sound the alert when due
 * (a beep, a bubble, a line in the logbook of an open cruise).
 * @param quiet - Only read, no alert (the button « Regarder maintenant »).
 * @returns Resolves when done.
 */
export function lightningCheck(quiet = false): Promise<void> {
  return new Promise((resolve) => {
    if (!navigator.onLine) {
      resolve();
      return;
    }
    lookPlace((position) => {
      if (!position) {
        resolve();
        return;
      }
      const radiusNm = lightningRadiusNm(lightningSettings());
      lightningBusy.value = true;
      readLightning({
        lat: position.lat,
        lon: position.lon,
        km: nmToKm(radiusNm),
      })
        .then((report) => {
          if (!report) return;
          lightningLast.value = report;
          if (report.nearestKm == null) {
            lastSignal = null;
            return;
          }
          if (quiet || !lightningAlertOn(lightningSettings())) return;
          const now = Date.now();
          if (!lightningDue(report, lastSignal, now)) return;
          lastSignal = { km: report.nearestKm, at: now };
          const text = lightningText(report, radiusNm);
          playLightning();
          showPop({
            report,
            radiusNm,
            place: { lat: position.lat, lon: position.lon },
          });
          if (state.data.cruise.peek()) {
            addEntry({
              id: uid(),
              t: new Date().toISOString(),
              v: { evt: ['Alerte foudre'], note: text },
            });
          }
        })
        .catch(() => undefined)
        .finally(() => {
          lightningBusy.value = false;
          resolve();
        });
    });
  });
}

/** (Re)start the look every five minutes, or stop it when the alert is off. */
export function lightningWatchStart(): void {
  clearInterval(timer);
  timer = undefined;
  lastSignal = null;
  if (!lightningAlertOn(lightningSettings())) return;
  void lightningCheck();
  timer = setInterval(() => void lightningCheck(), EVERY_MS);
}

/**
 * A test of the alert: the beeps and the bubble as for a storm at 12 NM to
 * the south-west, coming nearer.
 */
export function lightningTest(): void {
  const now = Date.now();
  // At once, where the map looks: no wait for the GPS.
  const { lat, lon } = contextPlace();
  playLightning();
  showPop({
    report: {
      nearestKm: 22,
      bearing: 225,
      cells: 40,
      strong: true,
      nearer: true,
      at: now - 10 * 60_000,
      readAt: now,
    },
    radiusNm: lightningRadiusNm(lightningSettings()),
    place: { lat, lon },
    test: true,
  });
}
