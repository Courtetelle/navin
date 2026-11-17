import { signal } from '@preact/signals-react';

import { uid } from '../../lib/format.ts';
import { BASIN_NAMES } from '../../model/basins.ts';
import type { Position } from '../../model/types.ts';
import { addEntry, chosenSea, state } from '../../state/index.ts';

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
  lightningClear,
  lightningDue,
  lightningMotionLines,
  lightningRadiusNm,
  lightningReport,
  lightningSize,
  lightningSpots,
  lightningText,
  lightningTimes,
  lightningUrl,
  nmToKm,
  pointAt,
  stormLines,
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
  lightningPop.value = {
    ...pop,
    lines: stormLines(pop.report, Date.now()),
  };
}

/** The images are read this often while the alert is on. */
const EVERY_MS = 5 * 60_000;

let timer: ReturnType<typeof setInterval> | undefined;
let lastSignal: LightningSignal | null = null;
/** The time of the last image with flashes inside the circle, epoch ms. */
let lastFlashAt = 0;

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
  // The last 35 minutes: the motion of the storms needs them.
  const times = lightningTimes(now, 8);
  const images = await Promise.all(
    times.map((time) => readPixels(lightningUrl(area, size, time), size)),
  );
  const spots: LightningSpots[] = [];
  for (const [index, pixels] of images.entries()) {
    if (pixels) {
      spots.push({ ...lightningSpots(pixels, size, area), t: times[index] });
    }
  }
  if (spots.length === 0) return null;
  return lightningReport(spots, times[0] ?? now, now, {
    lat: area.lat,
    lon: area.lon,
  });
}

/**
 * The name of where NavIn looks from: the zone chosen with NavIn, else GPS.
 * @returns GPS, Atlantique, Méditerranée or Lacs.
 */
export function lookName(): string {
  const zone = state.view.zoneSimV.peek();
  if (!zone) return 'GPS';
  return zone === 'lac' ? BASIN_NAMES.lac : BASIN_NAMES[chosenSea()];
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
 * @param quiet - Only read, no alert (the button « Actualiser maintenant »).
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
          report.placeName = lookName();
          lightningLast.value = report;
          if (report.nearestKm != null) {
            lastFlashAt = Math.max(lastFlashAt, report.at);
          }
          if (quiet || !lightningAlertOn(lightningSettings())) return;
          const place = { lat: position.lat, lon: position.lon };
          // No flash for 30 minutes after an alert: it is over.
          if (lightningClear(report, lastSignal, lastFlashAt)) {
            lastSignal = null;
            playLightning();
            showPop({ report, radiusNm, place, clear: true });
            logLightning(
              'Fin d’alerte foudre',
              `Plus d’éclairs à moins de ${radiusNm} NM depuis 30 min.`,
            );
            return;
          }
          if (report.nearestKm == null) return;
          const now = Date.now();
          const radiusKm = nmToKm(radiusNm);
          const reason = lightningDue(report, lastSignal, now, radiusKm);
          if (!reason) return;
          lastSignal = {
            km: report.nearestKm,
            at: now,
            half: report.nearestKm < radiusKm / 2,
          };
          playLightning();
          showPop({ report, radiusNm, place, reason });
          logLightning(
            reason === 'half' ? 'Alerte foudre (2e)' : 'Alerte foudre',
            [
              lightningText(report, radiusNm),
              ...lightningMotionLines(report, now),
            ].join(' '),
          );
        })
        .catch(() => undefined)
        .finally(() => {
          lightningBusy.value = false;
          resolve();
        });
    });
  });
}

/**
 * A line in the logbook of the open cruise.
 * @param event - The event.
 * @param note - What it says.
 */
function logLightning(event: string, note: string): void {
  if (!state.data.cruise.peek()) return;
  addEntry({
    id: uid(),
    t: new Date().toISOString(),
    v: { evt: [event], note },
  });
}

/** (Re)start the look every five minutes, or stop it when the alert is off. */
export function lightningWatchStart(): void {
  clearInterval(timer);
  timer = undefined;
  lastSignal = null;
  lastFlashAt = 0;
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
      motion: { towardDeg: 45, speedKn: 22, closingKn: 20, kmAt: 22 },
      place: { lat, lon },
    },
    radiusNm: lightningRadiusNm(lightningSettings()),
    place: { lat, lon },
    test: true,
    reason: 'first',
  });
}

/** Farther and farther, the nearest flashes are looked for this far, km. */
const NEAREST_KM = [60, 150, 400] as const;

/** The nearest storm found, wherever it is (Météo › Alerte foudre). */
export interface NearestStorm {
  place: { lat: number; lon: number };
  /** The nearest flashes, null when none within 400 km. */
  storm: { lat: number; lon: number } | null;
  /** What the images show around it, null without storm. */
  report: LightningReport | null;
  /** When it was looked for, epoch ms. */
  at: number;
}

/** The last nearest storm looked for. */
export const lightningNearest = signal<NearestStorm | null>(null);
/** A nearest storm looked for now. */
export const nearestBusy = signal(false);
/** A nearest storm looked for this recently is not looked for again. */
const NEAREST_FRESH_MS = 4 * 60_000;

/**
 * The nearest flashes of the last quarter of an hour from the GPS, or from
 * the zone chosen with NavIn: looked for farther and farther, from the
 * distance of the alert to 400 km.
 * @param fresh - A look of the last 4 minutes is kept.
 * @returns The place looked from, the nearest flashes and their report.
 */
export async function nearestStorm(fresh = false): Promise<NearestStorm> {
  const kept = lightningNearest.peek();
  if (fresh && kept && Date.now() - kept.at < NEAREST_FRESH_MS) return kept;
  nearestBusy.value = true;
  try {
    const place = await new Promise<{ lat: number; lon: number }>((resolve) => {
      lookPlace((position) => {
        const { lat, lon } = position ?? contextPlace();
        resolve({ lat, lon });
      });
    });
    const alertKm = nmToKm(lightningRadiusNm(lightningSettings()));
    const radii = [alertKm, ...NEAREST_KM.filter((km) => km > alertKm * 1.2)];
    let found: NearestStorm = {
      place,
      storm: null,
      report: null,
      at: Date.now(),
    };
    for (const km of radii) {
      // eslint-disable-next-line no-await-in-loop -- farther only when nothing nearer
      const report = await readLightning({ ...place, km });
      if (report?.nearestKm != null && report.bearing != null) {
        found = {
          place,
          storm: pointAt(
            place.lat,
            place.lon,
            report.bearing,
            report.nearestKm,
          ),
          report: { ...report, placeName: lookName() },
          at: Date.now(),
        };
        break;
      }
    }
    lightningNearest.value = found;
    return found;
  } finally {
    nearestBusy.value = false;
  }
}

/**
 * Another place of navigation (a zone chosen with NavIn, or the GPS again):
 * the storms seen from the old place are forgotten and looked for again.
 */
export function lightningNewPlace(): void {
  lightningLast.value = null;
  const looked = lightningNearest.peek() != null;
  lightningNearest.value = null;
  lightningWatchStart();
  if (!lightningAlertOn(lightningSettings())) void lightningCheck(true);
  if (looked) void nearestStorm();
}
