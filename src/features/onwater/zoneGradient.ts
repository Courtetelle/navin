import { openMeteoFetch } from '../../lib/openMeteo.ts';
import type { Gradient, ZoneKind } from '../../model/zoneBulletin.ts';
import { GRADIENT_PLACES, gradientPlaces } from '../../model/zoneBulletin.ts';

/**
 * The pressures at the places that tell the regional winds (Genève, Zurich
 * and Lugano for the bise and the foehn of the lakes, Gênes for the
 * mistral): one request for all of them, kept 30 minutes like every
 * request to Open-Meteo.
 * @param kind - The kind of zone.
 * @returns The pressures, or null (Channel and Atlantic, or no answer).
 */
export async function readGradient(kind: ZoneKind): Promise<Gradient | null> {
  const names = gradientPlaces(kind);
  if (names.length === 0) return null;
  const places = names.map((name) => GRADIENT_PLACES[name]);
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${places.map((place) => place.lat).join(',')}&longitude=${places.map((place) => place.lon).join(',')}&hourly=pressure_msl&forecast_days=3&timezone=GMT`;
  try {
    const reply = await openMeteoFetch(url, {
      signal: AbortSignal.timeout(20_000),
    });
    if (!reply.ok) return null;
    const answer = (await reply.json()) as unknown;
    const list = (Array.isArray(answer) ? answer : [answer]) as Array<{
      // eslint-disable-next-line @typescript-eslint/naming-convention -- name in the API
      hourly?: { time?: string[]; pressure_msl?: Array<number | null> };
    }>;
    const times = list[0]?.hourly?.time;
    if (!times) return null;
    const p: Gradient['p'] = {};
    for (const [index, name] of names.entries()) {
      p[name] = list[index]?.hourly?.pressure_msl ?? [];
    }
    return { t: times.map((time) => Date.parse(`${time}:00Z`)), p };
  } catch {
    return null;
  }
}
