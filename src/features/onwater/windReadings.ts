import { distKm } from '../../lib/geo.ts';
import type { Position } from '../../model/types.ts';
import { isLake } from '../../state/index.ts';

import { mfReadings, owmReadings } from './coastStations.ts';
import { smnNow, smnStations } from './externals.ts';
import { METEO_SWISS } from './liveStations.ts';
import { farFromShore, nearWater, shoreGrid } from './shoreFar.ts';
import type { WindConfig } from './windLogic.ts';
import { windLevel, windValue } from './windLogic.ts';
import type { MarineReply, ModelReply, StationRow } from './windModels.ts';
import {
  WIND_FALLBACK,
  marineState,
  modelReading,
  stationReading,
  windRegion,
} from './windModels.ts';
import type { SeaState, WindMeta, WindReading } from './windTypes.ts';

/** Result of a wind reading around the boat. */
export interface WindCheck {
  /** Strongest reading. */
  top: WindReading;
  /** Alert level, thresholds lowered when the region asks for it. */
  level: number;
  meta: WindMeta;
}

/**
 * Strongest wind of the MeteoSwiss stations around the boat, on the water or
 * within 1 km of the shore.
 * @param config - Alert configuration.
 * @param position - Boat position.
 * @returns The wind, null when no station answers.
 */
export async function stationWind(
  config: WindConfig,
  position: Position,
): Promise<WindCheck | null> {
  const [stations, grid] = await Promise.all([smnStations(), shoreGrid()]);
  const readings: WindReading[] = [];
  /* eslint-disable no-await-in-loop -- stations are read one at a time, like the rest of the rate-limited open data */
  for (const [abbreviation, name, lat, lon, altitude] of stations) {
    const km = distKm(position.lat, position.lon, lat, lon);
    if ((altitude || 0) >= 800 || km >= config.radius) continue;
    if (grid && farFromShore(grid, lat, lon)) continue;
    try {
      const rows = (await smnNow(abbreviation)) as unknown as StationRow[];
      const reading = stationReading(rows, name, km, Date.now());
      if (reading) {
        readings.push({
          ...reading,
          id: abbreviation,
          lat,
          lon,
          net: METEO_SWISS,
        });
      }
    } catch {
      // Next station.
    }
  }
  /* eslint-enable no-await-in-loop */
  if (readings.length === 0) return null;
  const top = strongest(readings, config.basis);
  return {
    top,
    level: windLevel(windValue(top, config.basis)),
    meta: { n: readings.length, src: 'smn' },
  };
}

/**
 * Strongest measured wind of the OpenWindMap beacons and the Météo-France
 * stations (with a key) around the boat, outside Switzerland, on the water or
 * within 1 km of the shore.
 * @param config - Alert configuration.
 * @param position - Boat position.
 * @returns The wind, null when no station answers.
 */
export async function coastWind(
  config: WindConfig,
  position: Position,
): Promise<WindCheck | null> {
  const [beacons, official] = await Promise.all([
    owmReadings(position, config.radius).catch(() => []),
    mfReadings(position, config.radius, config.mfKey).catch(() => []),
  ]);
  const readings = await nearWater([...official, ...beacons]);
  if (readings.length === 0) return null;
  const top = strongest(readings, config.basis);
  const sea = isLake() ? null : await seaStateAt(position);
  return {
    top,
    level: windLevel(windValue(top, config.basis)),
    meta: {
      n: readings.length,
      src: 'stations',
      nets: [...new Set(readings.map((reading) => reading.net ?? ''))],
      radius: config.radius,
      ...sea,
    },
  };
}

/**
 * Wind forecast at the boat's position, outside Switzerland.
 * @param config - Alert configuration.
 * @param position - Boat position.
 * @returns The wind, null when no model answers.
 */
export async function modelWind(
  config: WindConfig,
  position: Position,
): Promise<WindCheck | null> {
  const region = windRegion(position);
  const readings = await modelReadings(position);
  if (readings.length === 0) return null;
  const top = strongest(readings, config.basis);
  const bias = region?.bias ?? 0;
  const sea = isLake() ? null : await seaStateAt(position);
  return {
    top,
    level: windLevel(windValue(top, config.basis) + bias),
    meta: {
      n: readings.length,
      src: 'model',
      radius: config.radius,
      region: region ? region.name : '',
      bias,
      names: readings.map((reading) => reading.name),
      ...sea,
    },
  };
}

// Outside Switzerland there are no stations: the finest model of the region at
// the boat's position; in the Aegean the stronger of two coarse models.
async function modelReadings(position: Position): Promise<WindReading[]> {
  const region = windRegion(position);
  const query = `latitude=${position.lat.toFixed(3)}&longitude=${position.lon.toFixed(3)}&current=wind_speed_10m,wind_gusts_10m,wind_direction_10m&wind_speed_unit=kn&timezone=GMT`;
  const readings: WindReading[] = [];
  /* eslint-disable no-await-in-loop -- a model is asked only when the previous one failed */
  for (const model of [...(region?.models ?? []), ...WIND_FALLBACK]) {
    try {
      const parameter = model[0] ? `&models=${model[0]}` : '';
      const reply = await fetch(
        `https://api.open-meteo.com/v1/forecast?${query}${parameter}`,
      );
      if (!reply.ok) continue;
      const json = (await reply.json()) as ModelReply;
      const reading = modelReading(json, model, Date.now());
      if (!reading) continue;
      readings.push(reading);
      if (!region?.max || readings.length >= 2) break;
    } catch {
      // Next model.
    }
  }
  /* eslint-enable no-await-in-loop */
  return readings;
}

// The marine model does not cover the lakes.
async function seaStateAt(position: Position): Promise<SeaState | null> {
  try {
    const reply = await fetch(
      `https://marine-api.open-meteo.com/v1/marine?latitude=${position.lat.toFixed(3)}&longitude=${position.lon.toFixed(3)}&hourly=wave_height&forecast_days=1&timezone=GMT`,
    );
    if (!reply.ok) return null;
    return marineState((await reply.json()) as MarineReply, Date.now());
  } catch {
    return null;
  }
}

function strongest(readings: WindReading[], basis: string): WindReading {
  return readings.toSorted(
    (a, b) => windValue(b, basis) - windValue(a, basis),
  )[0] as WindReading;
}
