import type { TrackSample } from './detector.ts';
import type { ParsedTrack } from './gpxParse.ts';
import type { NmeaSentence } from './nmeaParser.ts';
import { nmeaTrueWind, parseNmeaSentence } from './nmeaParser.ts';

type CarriedKey =
  'sog' | 'cog' | 'hdg' | 'stw' | 'aws' | 'awa' | 'tws' | 'twd' | 'twa';

const CARRIED_KEYS: readonly CarriedKey[] = [
  'sog',
  'cog',
  'hdg',
  'stw',
  'aws',
  'awa',
  'tws',
  'twd',
  'twa',
];

type Carried = Partial<Record<CarriedKey, number | null>>;

interface PendingSample extends Omit<TrackSample, 't'> {
  hms: string;
}

/**
 * Track of a recorded NMEA 0183 file (legacy `nmParseFile`): one point per
 * dated position, with the last speed, course and true wind known. Positions
 * before the first date are kept until a sentence gives it.
 * @param text - File content.
 * @returns The points, the name being empty.
 */
export function parseNmeaFile(text: string): ParsedTrack {
  const points: TrackSample[] = [];
  const carried: Carried = {};
  let pending: PendingSample[] = [];
  let date: string | null = null;
  let lastTime: string | null = null;
  for (const line of text.split(/\r?\n/)) {
    const sentence = parseNmeaSentence(line);
    if (!sentence) continue;
    if (sentence.dmy) {
      date = sentence.dmy;
      for (const sample of pending) addDated(points, sample, date);
      pending = [];
    }
    for (const key of CARRIED_KEYS) {
      const value = sentence[key];
      if (value != null) carried[key] = value;
    }
    const { hms, fix, lat, lon } = sentence;
    if (!fix || lat == null || lon == null || !hms || hms === lastTime) {
      continue;
    }
    lastTime = hms;
    const sample = sampleOf(sentence, carried, hms);
    if (date) addDated(points, sample, date);
    else pending.push(sample);
  }
  // Midnight: the time goes back without a new date.
  for (let index = 1; index < points.length; index++) {
    const point = points[index];
    const before = points[index - 1];
    if (point && before && point.t < before.t - 3_600_000) {
      point.t += 86_400_000;
    }
  }
  return { pts: points, name: '' };
}

function addDated(
  points: TrackSample[],
  { hms, ...sample }: PendingSample,
  date: string,
): void {
  const time = Date.UTC(
    2000 + Number(date.slice(4, 6)),
    Number(date.slice(2, 4)) - 1,
    Number(date.slice(0, 2)),
    Number(hms.slice(0, 2)),
    Number(hms.slice(2, 4)),
    Number(hms.slice(4)),
  );
  if (!Number.isNaN(time)) points.push({ ...sample, t: time });
}

function sampleOf(
  sentence: NmeaSentence,
  carried: Carried,
  hms: string,
): PendingSample {
  const wind = windOf(carried);
  const speed = sentence.sog ?? carried.sog;
  const course = sentence.cog ?? carried.cog;
  return {
    hms,
    lat: sentence.lat ?? 0,
    lon: sentence.lon ?? 0,
    sog: speed == null ? null : Math.round(speed * 10) / 10,
    cog: course == null ? null : Math.round(course) % 360,
    twd: wind.twd == null ? null : Math.round(wind.twd) % 360,
    tws: wind.tws == null ? null : Math.round(wind.tws * 10) / 10,
  };
}

function windOf({ twd, tws, twa, hdg, cog, aws, awa, stw, sog }: Carried): {
  twd: number | null | undefined;
  tws: number | null | undefined;
} {
  const heading = hdg ?? cog;
  if (twd == null && twa != null && heading != null) {
    twd = (((heading + twa) % 360) + 360) % 360;
  }
  if ((twd == null || tws == null) && aws != null) {
    const computed = nmeaTrueWind(aws, awa, stw ?? sog, heading);
    if (computed) {
      tws ??= computed.tws;
      twd ??= computed.twd;
    }
  }
  return { twd, tws };
}
