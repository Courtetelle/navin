/** Values understood in one NMEA 0183 sentence. */
export interface NmeaSentence {
  /** Time `hhmmss[.ss]`. @default undefined */
  hms?: string;
  /** Date `ddmmyy`. @default undefined */
  dmy?: string;
  /** A valid position fix. @default undefined */
  fix?: boolean;
  /** @default undefined */
  lat?: number | null;
  /** @default undefined */
  lon?: number | null;
  /** Speed over ground, knots. @default undefined */
  sog?: number | null;
  /** Course over ground, degrees. @default undefined */
  cog?: number | null;
  /** True heading, degrees. @default undefined */
  hdg?: number | null;
  /** Speed through water, knots. @default undefined */
  stw?: number | null;
  /** Apparent wind speed, knots. @default undefined */
  aws?: number | null;
  /** Apparent wind angle, signed, + starboard. @default undefined */
  awa?: number | null;
  /** True wind speed, knots. @default undefined */
  tws?: number | null;
  /** True wind angle, signed. @default undefined */
  twa?: number | null;
  /** True wind direction, degrees. @default undefined */
  twd?: number | null;
  /** Depth, metres. @default undefined */
  depth?: number | null;
  /** Water temperature, °C. @default undefined */
  wtemp?: number | null;
}

/** True wind computed from the apparent wind. */
export interface TrueWind {
  tws: number;
  twa: number;
  twd: number | null;
}

/** Knots per metre per second. */
export const KNOTS_PER_MS = 1.943_844;

/**
 * True wind from the apparent wind and the boat speed (legacy `nmTrueWind`).
 * @param speed - Apparent wind speed.
 * @param angle - Apparent wind angle, signed, + starboard.
 * @param boatSpeed - Boat speed, same unit.
 * @param heading - Heading; without it the direction is unknown.
 * @returns The true wind, or `null` without apparent wind.
 */
export function nmeaTrueWind(
  speed: number | null | undefined,
  angle: number | null | undefined,
  boatSpeed: number | null | undefined,
  heading: number | null | undefined,
): TrueWind | null {
  if (speed == null || angle == null) return null;
  const radians = (angle * Math.PI) / 180;
  const x = speed * Math.cos(radians) - (boatSpeed || 0);
  const y = speed * Math.sin(radians);
  const twa = (Math.atan2(y, x) * 180) / Math.PI;
  return {
    tws: Math.hypot(x, y),
    twa,
    twd: heading == null ? null : (((heading + twa) % 360) + 360) % 360,
  };
}

/**
 * Parse one NMEA 0183 sentence (legacy `nmParse0183`): RMC, GGA, GLL, VTG, HDT,
 * HDG, HDM, VHW, MWV, MWD, DPT, DBT, DBS, MTW. Text before `$` or `!` is
 * skipped; a sentence with a wrong checksum is rejected.
 * @param text - The line.
 * @returns The values, or `null` when the sentence is unknown or invalid.
 */
export function parseNmeaSentence(text: string): NmeaSentence | null {
  const line = checkedBody(text.trim());
  if (line === null) return null;
  const fields = line.split(',');
  const type = (fields[0] ?? '').slice(-3);
  const field = (position: number) => fields[position];
  const parsed: NmeaSentence = {};
  const setTime = (hms: string | undefined) => {
    if (hms && hms.length >= 6) parsed.hms = hms;
  };
  switch (type) {
    case 'RMC':
      setTime(field(1));
      if (field(2) !== 'A') break;
      parsed.lat = coordinate(field(3), field(4));
      parsed.lon = coordinate(field(5), field(6));
      parsed.sog = numberOf(field(7));
      parsed.cog = numberOf(field(8));
      if (field(9)?.length === 6) parsed.dmy = field(9);
      parsed.fix = true;
      break;
    case 'GGA':
      setTime(field(1));
      if (field(6) === '0') break;
      parsed.lat = coordinate(field(2), field(3));
      parsed.lon = coordinate(field(4), field(5));
      parsed.fix = true;
      break;
    case 'GLL':
      if (field(6) && field(6) !== 'A') break;
      parsed.lat = coordinate(field(1), field(2));
      parsed.lon = coordinate(field(3), field(4));
      setTime(field(5));
      parsed.fix = true;
      break;
    case 'VTG':
      parsed.cog = numberOf(field(1));
      parsed.sog = numberOf(field(5));
      break;
    case 'HDT':
      parsed.hdg = numberOf(field(1));
      break;
    case 'HDG':
    case 'HDM':
      readHeading(parsed, type, fields);
      break;
    case 'VHW':
      parsed.stw = numberOf(field(5));
      if (field(1)) parsed.hdg = numberOf(field(1));
      break;
    case 'MWV':
      readWind(parsed, fields);
      break;
    case 'MWD': {
      const direction = numberOf(field(1));
      const speed = numberOf(field(5));
      if (direction !== null) parsed.twd = direction;
      if (speed !== null) parsed.tws = speed;
      break;
    }
    case 'DPT': {
      const depth = numberOf(field(1));
      const offset = numberOf(field(2)) ?? 0;
      if (depth !== null) parsed.depth = depth + Math.max(offset, 0);
      break;
    }
    case 'DBT':
    case 'DBS': {
      const depth = numberOf(field(3));
      if (depth !== null) parsed.depth = depth;
      break;
    }
    case 'MTW':
      parsed.wtemp = numberOf(field(1));
      break;
    default:
      return null;
  }
  return parsed;
}

function checkedBody(text: string): string | null {
  const start = text.search(/[$!]/);
  if (start < 0) return null;
  const line = text.slice(start);
  const star = line.indexOf('*');
  if (star <= 0) return line;
  const checksum = line.slice(star + 1, star + 3);
  let computed = 0;
  for (let index = 1; index < star; index++) {
    computed ^= line.codePointAt(index) ?? 0;
  }
  if (
    /^[0-9A-F]{2}$/i.test(checksum) &&
    Number.parseInt(checksum, 16) !== computed
  ) {
    return null;
  }
  return line.slice(0, star);
}

function coordinate(
  value: string | undefined,
  hemisphere: string | undefined,
): number | null {
  if (!value) return null;
  const degreesLength = value.indexOf('.') - 2;
  if (degreesLength < 1) return null;
  const degrees =
    Number(value.slice(0, degreesLength)) +
    Number(value.slice(degreesLength)) / 60;
  return hemisphere === 'S' || hemisphere === 'W' ? -degrees : degrees;
}

function numberOf(value: string | undefined): number | null {
  return value === '' || value == null ? null : Number(value);
}

function readHeading(
  parsed: NmeaSentence,
  type: string,
  fields: readonly string[],
): void {
  const heading = numberOf(fields[1]);
  if (heading === null) return;
  const variation =
    type === 'HDG' && fields[4]
      ? (numberOf(fields[4]) ?? 0) * (fields[5] === 'W' ? -1 : 1)
      : 0;
  parsed.hdg = (((heading + variation) % 360) + 360) % 360;
}

function readWind(parsed: NmeaSentence, fields: readonly string[]): void {
  if (fields[5] && fields[5] !== 'A') return;
  const angle = numberOf(fields[1]);
  const speed = numberOf(fields[3]);
  if (angle === null || speed === null) return;
  const knots = windKnots(speed, fields[4]);
  const signed = angle > 180 ? angle - 360 : angle;
  if (fields[2] === 'R') {
    parsed.aws = knots;
    parsed.awa = signed;
  } else {
    parsed.tws = knots;
    parsed.twa = signed;
  }
}

function windKnots(speed: number, unit: string | undefined): number {
  if (unit === 'M') return speed * KNOTS_PER_MS;
  return unit === 'K' ? speed / 1.852 : speed;
}
