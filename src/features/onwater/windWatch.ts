import { signal } from '@preact/signals-react';

import { dayKey, uid } from '../../lib/format.ts';
import { bft } from '../../lib/wind.ts';
import type { Position } from '../../model/types.ts';
import { go } from '../../shell/router.ts';
import {
  addEntry,
  isLake,
  state,
  toast,
  updateDay,
  updateSettings,
} from '../../state/index.ts';

import { contextPlace, inSwissArea } from './externals.ts';
import { lakeFix } from './lakeFix.ts';
import { refreshLakeButtons } from './lakeRefresh.ts';
import { playAlarm } from './windAudio.ts';
import type { WindConfig } from './windLogic.ts';
import {
  WIND_POP_DELAY,
  seaTxt,
  signalDue,
  waveOmmTxt,
  windAlertConfig,
  windAlertNote,
  windMutedNote,
  windValue,
} from './windLogic.ts';
import { liveAlertSpot, showWindPopup } from './windOverlayState.ts';
import { coastWind, modelWind, stationWind } from './windReadings.ts';
import type {
  WindMeta,
  WindReading,
  WindSignal,
  WindWatch,
} from './windTypes.ts';

/** Where the last wind check read the wind: the live screen opens there. */
export const windWatchPlace = signal<{ lat: number; lon: number } | null>(null);

/** Last wind check, also kept without an open cruise (legacy `windWatchLast`). */
export const windWatchLast = signal<WindWatch | null>(null);

let windTimer: ReturnType<typeof setInterval> | undefined;
let lastSignal: WindSignal | null = null;

/**
 * Current wind alert configuration (legacy `windAlert`).
 * @returns The configuration.
 */
export function windConfig(): WindConfig {
  return windAlertConfig(state.preferences.settings.value);
}

/**
 * Alerts are silent until the end of the track (legacy `windMuted`).
 * @returns `true` when muted.
 */
export function windMuted(): boolean {
  return Boolean(state.preferences.settings.value.windMuteTrack);
}

/** End of the track: the alerts are active again (legacy `windMuteEnd`). */
export function windMuteEnd(): void {
  if (!windMuted()) return;
  updateSettings((settings) => {
    settings.windMuteTrack = false;
  });
  toast('Alertes de vent de nouveau actives');
}

/** Forget the last signal: the next check signals again (legacy `windLast = null`). */
export function resetWindSignal(): void {
  lastSignal = null;
}

/** (Re)start the check every five minutes (legacy `windWatchStart`). */
export function windWatchStart(): void {
  clearInterval(windTimer);
  windTimer = undefined;
  if (!windConfig().on) return;
  windCheck();
  windTimer = setInterval(windCheck, 5 * 60_000);
}

/** A light check every minute keeps the 15-minute reminder between two readings. */
export function windReminderTick(): void {
  if (
    windConfig().on &&
    lastSignal &&
    Date.now() - lastSignal.at >= 15 * 60_000
  ) {
    windCheck();
  }
}

/** Read the wind around the boat and signal it when due (legacy `windCheck`). */
export function windCheck(): void {
  const config = windConfig();
  if (!config.on || !navigator.onLine) return;
  // A place chosen with NavIn rules over the GPS: the alerts are those of
  // where NavIn looks, the GPS only after the boat arrow.
  const where = state.view.zoneSimV.peek()
    ? (done: (position: Position | null) => void) => {
        const { lat, lon } = contextPlace();
        done({ lat, lon });
      }
    : lakeFix;
  where((position) => {
    if (!position) return;
    windWatchPlace.value = { lat: position.lat, lon: position.lon };
    // Measured wind first; the forecast only where no station answers.
    const check =
      isLake() || inSwissArea(position)
        ? stationWind(config, position)
        : coastWind(config, position).then(
            (measured) => measured ?? modelWind(config, position),
          );
    check
      .then((wind) => {
        if (wind) fireWind(config, wind.top, wind.level, wind.meta);
      })
      .catch(() => undefined);
  });
}

function fireWind(
  config: WindConfig,
  top: WindReading,
  level: number,
  meta: WindMeta,
): void {
  const watch: WindWatch = {
    at: Date.now(),
    top,
    basis: config.basis,
    ...meta,
  };
  windWatchLast.value = watch;
  const open = Boolean(state.data.cruise.value);
  const today = dayKey(new Date());
  if (open) {
    updateDay(today, (day) => {
      day.windWatch = watch;
    });
  }
  const now = Date.now();
  if (level < 0) {
    lastSignal = null;
  } else if (signalDue(level, lastSignal, now)) {
    lastSignal = { level, at: now };
    if (windMuted()) {
      if (open) noteAlert({ note: windMutedNote(top) });
      return;
    }
    const knots = windValue(top, config.basis);
    playAlarm(level, knots, {
      forecast: meta.src === 'model',
      other: otherWind(config, top),
    });
    setTimeout(() => showAlertPopup(config, top, meta, knots), WIND_POP_DELAY);
    if (open) {
      noteAlert({
        note: windAlertNote(top, meta),
        ...(meta.waveH == null ? {} : { mer: String(meta.douglas) }),
      });
    }
  }
  if (open) refreshLakeButtons();
}

function noteAlert(values: { note: string; mer?: string }): void {
  addEntry({
    id: uid(),
    t: new Date().toISOString(),
    v: { evt: ['Alerte vent'], ...values },
  });
}

function showAlertPopup(
  config: WindConfig,
  top: WindReading,
  meta: WindMeta,
  knots: number,
): void {
  const force = bft(Math.round(knots));
  const basis = config.basis === 'gust' ? 'en rafales' : 'de vent moyen';
  const forecast = meta.src === 'model';
  const network = top.net ?? 'MeteoSwiss';
  showWindPopup({
    bf: force,
    kn: `${Math.round(knots)} nd ${basis}${forecast ? ' PRÉVUS' : ''}`,
    other: otherWind(config, top),
    where: forecast
      ? `PRÉVISION ${top.name}, pas une mesure`
      : `mesuré à ${top.name} (${network})`,
    sea: meta.waveH == null ? '' : `modèle ici : ${seaTxt(meta)}`,
    omm: isLake() ? '' : waveOmmTxt(force),
    onLive: () => {
      // A measured alert: Live météo shows where it came from.
      liveAlertSpot.value =
        forecast || top.lat == null || top.lon == null
          ? null
          : {
              lat: top.lat,
              lon: top.lon,
              name: top.name,
              boat: windWatchPlace.peek(),
            };
      go('meteo');
    },
    ...(forecast
      ? {
          note: `⚠️ Aucune station de mesure à moins de ${meta.radius ?? config.radius} km : vent calculé par un modèle de prévision. Le vent réel peut être plus fort ou plus faible.`,
        }
      : {}),
  });
}

/**
 * The other wind, shown in small: the mean wind under the gusts, the gusts
 * under the mean wind.
 * @param config - Alert configuration.
 * @param top - Reading signalled.
 * @returns The text, empty without gusts.
 */
export function otherWind(config: WindConfig, top: WindReading): string {
  if (config.basis === 'gust') {
    return top.gust == null ? '' : `vent moyen ${Math.round(top.avg)} nd`;
  }
  return top.gust == null ? '' : `rafales ${Math.round(top.gust)} nd`;
}
