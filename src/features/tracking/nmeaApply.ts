import { onFix } from './fixHandler.ts';
import {
  nmeaComputeTrueWind,
  nmeaFresh,
  nmeaHeading,
  nmeaLink,
  nmeaRedraw,
  nmeaSet,
} from './nmeaLive.ts';
import type { NmeaSentence } from './nmeaParser.ts';
import { KNOTS_PER_MS } from './nmeaParser.ts';
import { trkFix } from './trackerLink.ts';

/** One path of a Signal K delta. */
interface SignalKValue {
  path?: string;
  value?: unknown;
}

/** A Signal K message: a delta, or the hello of the server. */
export interface SignalKMessage {
  updates?: Array<{ values?: SignalKValue[] }>;
  name?: string;
  version?: string;
}

type LiveKey = Parameters<typeof nmeaSet>[0];

const SENTENCE_KEYS = [
  'sog',
  'cog',
  'hdg',
  'stw',
  'aws',
  'awa',
  'tws',
  'twd',
  'depth',
  'wtemp',
] as const;

const toKnots = (metresPerSecond: number) => metresPerSecond * KNOTS_PER_MS;
const toAngle = (radians: number) => (radians * 180) / Math.PI;
const toDegrees = (radians: number) => ((toAngle(radians) % 360) + 360) % 360;

const SIGNAL_K_PATHS: Readonly<
  Record<string, readonly [LiveKey, (value: number) => number]>
> = {
  'navigation.speedOverGround': ['sog', toKnots],
  'navigation.courseOverGroundTrue': ['cog', toDegrees],
  'navigation.headingTrue': ['hdg', toDegrees],
  'navigation.speedThroughWater': ['stw', toKnots],
  'environment.wind.speedApparent': ['aws', toKnots],
  'environment.wind.angleApparent': ['awa', toAngle],
  'environment.wind.speedTrue': ['tws', toKnots],
  'environment.wind.directionTrue': ['twd', toDegrees],
  'environment.wind.angleTrueWater': ['twa', toAngle],
  'environment.depth.belowTransducer': ['depth', (metres) => metres],
  'environment.depth.belowSurface': ['depth', (metres) => metres],
  'environment.water.temperature': ['wtemp', (kelvin) => kelvin - 273.15],
};

/**
 * Keep the values of an NMEA 0183 sentence (legacy `nmApply0183`).
 * @param sentence - Parsed sentence, or `null`.
 */
export function applyNmeaSentence(sentence: NmeaSentence | null): void {
  if (!sentence) return;
  for (const key of SENTENCE_KEYS) nmeaSet(key, sentence[key]);
  if (sentence.twa != null) {
    nmeaSet('twa', sentence.twa);
    const heading = nmeaHeading();
    if (heading !== null && sentence.twd == null) {
      nmeaSet('twd', (((heading + sentence.twa) % 360) + 360) % 360);
    }
  }
  const hasPosition = sentence.lat != null && sentence.lon != null;
  if (hasPosition) {
    nmeaSet('lat', sentence.lat);
    nmeaSet('lon', sentence.lon);
  }
  afterNmea(hasPosition);
}

/**
 * Keep the values of a Signal K message (legacy `nmApplySK`).
 * @param message - Parsed JSON message.
 */
export function applySignalK(message: SignalKMessage | null): void {
  if (!message || !Array.isArray(message.updates)) {
    if (message?.name && message.version) {
      nmeaLink.server = `${message.name} ${message.version}`;
    }
    return;
  }
  let hasPosition = false;
  for (const update of message.updates) {
    for (const item of update.values ?? []) {
      hasPosition = applySignalKValue(item) || hasPosition;
    }
  }
  const { twa } = nmeaLink.live;
  if (nmeaFresh('twa') && !nmeaFresh('twd') && twa != null) {
    const heading = nmeaHeading();
    if (heading !== null) {
      nmeaSet('twd', (((heading + twa) % 360) + 360) % 360);
    }
  }
  afterNmea(hasPosition);
}

function applySignalKValue({ path, value }: SignalKValue): boolean {
  if (path === 'navigation.position' && value) {
    const position = value as { latitude?: number; longitude?: number };
    nmeaSet('lat', position.latitude);
    nmeaSet('lon', position.longitude);
    return true;
  }
  if (path === 'navigation.headingMagnetic' && !nmeaFresh('hdg')) {
    nmeaSet('hdg', typeof value === 'number' ? toDegrees(value) : null);
    return false;
  }
  const mapping = path ? SIGNAL_K_PATHS[path] : undefined;
  if (mapping && typeof value === 'number') {
    nmeaSet(mapping[0], mapping[1](value));
  }
  return false;
}

// Passes the position on to the app: the instruments replace the phone GPS.
function afterNmea(positionChanged: boolean): void {
  nmeaComputeTrueWind();
  const { lat, lon, sog, cog } = nmeaLink.live;
  if (positionChanged && nmeaFresh('lat') && lat != null && lon != null) {
    const speed = nmeaFresh('sog') ? (sog ?? null) : null;
    const course = nmeaFresh('cog') ? (cog ?? null) : null;
    try {
      onFix({
        timestamp: Date.now(),
        nmea: true,
        coords: {
          latitude: lat,
          longitude: lon,
          accuracy: 5,
          speed: speed === null ? null : speed / KNOTS_PER_MS,
          heading: course,
        },
      });
    } catch {
      // A failing fix must not cut the instruments.
    }
    trkFix({ lat, lon, acc: 5, sog: speed, cog: course });
  }
  nmeaRedraw();
}
