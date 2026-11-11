const DAY_MS = 86_400_000;
const JULIAN_1970 = 2_440_587.5;
const JULIAN_2000 = 2_451_545;
const OBLIQUITY = 23.4397;
/** The sun at the horizon, refraction and its radius included. */
const HORIZON = -0.833;

const rad = (degrees: number) => (degrees * Math.PI) / 180;
const deg = (radians: number) => (radians * 180) / Math.PI;

/** Sunrise and sunset, epoch ms. */
interface SunTimes {
  rise: number;
  set: number;
}

/**
 * Sunrise and sunset of the day holding a time, at a place (the usual sunrise
 * equation, within a few minutes).
 * @param time - A moment of that day, epoch ms.
 * @param lat - Latitude.
 * @param lon - Longitude.
 * @returns The times, or `null` when the sun stays up or down all day.
 */
export function sunTimes(
  time: number,
  lat: number,
  lon: number,
): SunTimes | null {
  const julian = time / DAY_MS + JULIAN_1970;
  const cycle = Math.round(julian - JULIAN_2000 + lon / 360);
  const transit = cycle - lon / 360;
  const anomaly = rad((357.5291 + 0.985_600_28 * transit) % 360);
  const center =
    1.9148 * Math.sin(anomaly) +
    0.02 * Math.sin(2 * anomaly) +
    0.0003 * Math.sin(3 * anomaly);
  const longitude = rad((deg(anomaly) + center + 180 + 102.9372) % 360);
  const noon =
    JULIAN_2000 +
    transit +
    0.0053 * Math.sin(anomaly) -
    0.0069 * Math.sin(2 * longitude);
  const declination = Math.asin(Math.sin(longitude) * Math.sin(rad(OBLIQUITY)));
  const cosine =
    (Math.sin(rad(HORIZON)) - Math.sin(rad(lat)) * Math.sin(declination)) /
    (Math.cos(rad(lat)) * Math.cos(declination));
  if (Math.abs(cosine) > 1) return null;
  const half = deg(Math.acos(cosine)) / 360;
  const toMs = (date: number) => (date - JULIAN_1970) * DAY_MS;
  return { rise: toMs(noon - half), set: toMs(noon + half) };
}

/**
 * The sunrises and sunsets during a period, at a place.
 * @param start - Start, epoch ms.
 * @param end - End, epoch ms.
 * @param lat - Latitude.
 * @param lon - Longitude.
 * @returns The events, in time order.
 */
export function sunEvents(
  start: number,
  end: number,
  lat: number,
  lon: number,
): Array<{ kind: 'rise' | 'set'; at: number }> {
  const events: Array<{ kind: 'rise' | 'set'; at: number }> = [];
  for (let day = start - DAY_MS; day <= end + DAY_MS; day += DAY_MS) {
    const times = sunTimes(day, lat, lon);
    if (times) {
      for (const kind of ['rise', 'set'] as const) {
        const at = times[kind];
        const known = events.some(
          (event) =>
            event.kind === kind && Math.abs(event.at - at) < DAY_MS / 2,
        );
        if (at >= start && at <= end && !known) events.push({ kind, at });
      }
    }
  }
  return events.toSorted((first, second) => first.at - second.at);
}
