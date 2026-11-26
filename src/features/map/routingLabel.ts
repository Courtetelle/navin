import { fmtDur, fmtTime, fr } from '../../lib/format.ts';
import { angDiff } from '../../lib/geo.ts';
import { sunTimes } from '../../lib/sun.ts';
import { REFERENCE } from '../../model/goNoGo.ts';

import type { BestAhead } from './routingShift.ts';
import { planKey, routingChanges } from './routingShift.ts';
import type { ShownRouting } from './routingState.ts';
import { highest } from './routingState.ts';

/**
 * An hour as Corban writes it, « 21h30 ».
 * @param ms - Epoch ms.
 * @returns The hour.
 */
export function hourText(ms: number): string {
  return fmtTime(new Date(ms)).replace(':', 'h');
}

/**
 * Minutes as « 1 h 05 » or « 40 min ».
 * @param minutes - Minutes (≥ 0).
 * @returns The text.
 */
export function minutesText(minutes: number): string {
  const all = Math.round(Math.abs(minutes));
  const hours = Math.floor(all / 60);
  const rest = all % 60;
  return hours > 0
    ? `${hours} h ${String(rest).padStart(2, '0')}`
    : `${rest} min`;
}

/**
 * The storm risk from the convective energy met, with the thresholds of the
 * go/no-go (500 and 1 500 J/kg).
 * @param cape - Highest CAPE, J/kg.
 * @returns The words.
 */
export function stormRisk(cape: number): string {
  const [low, high] = REFERENCE.cape;
  if (cape >= high) return 'fort';
  if (cape >= low) return 'possible';
  return 'faible';
}

/** The wind and the current at one moment of the routing. */
export interface WindCurrent {
  ms: number;
  /** Where the wind comes from, degrees, and its speed, knots. */
  twd: number;
  tws: number;
  /** Where the current flows to, degrees, and its speed, knots. */
  setDeg: number;
  driftKn: number;
}

/** The current flows within this angle of where the wind comes from. */
const AGAINST_DEG = 45;
/** A current under this speed does not raise the sea. */
const AGAINST_KN = 0.5;

/**
 * The strongest current flowing against the wind (it raises a short,
 * steep sea).
 * @param points - Moments of the routing.
 * @returns The worst one, or `null` when none.
 */
export function worstAgainst(
  points: readonly WindCurrent[],
): WindCurrent | null {
  let worst: WindCurrent | null = null;
  for (const point of points) {
    if (
      Number.isFinite(point.driftKn) &&
      point.driftKn >= AGAINST_KN &&
      angDiff(point.setDeg, point.twd) <= AGAINST_DEG &&
      (!worst || point.driftKn * point.tws > worst.driftKn * worst.tws)
    ) {
      worst = point;
    }
  }
  return worst;
}

/** Night is checked every this often. */
const NIGHT_STEP_MS = 5 * 60_000;

/**
 * The minutes under way between sunset and sunrise, and the sunset of the
 * day of departure.
 * @param departMs - ETD.
 * @param arriveMs - ETA.
 * @param place - Where (the start).
 * @param place.lat - Latitude.
 * @param place.lon - Longitude.
 * @returns Night minutes, and the sunset and sunrise met.
 */
export function nightOf(
  departMs: number,
  arriveMs: number,
  place: { lat: number; lon: number },
): { minutes: number; set: number | null; rise: number | null } {
  let minutes = 0;
  let set: number | null = null;
  let rise: number | null = null;
  for (let at = departMs; at < arriveMs; at += NIGHT_STEP_MS) {
    const sun = sunTimes(at, place.lat, place.lon);
    if (!sun) continue;
    const dark = at < sun.rise || at >= sun.set;
    if (!dark) continue;
    minutes += Math.min(NIGHT_STEP_MS, arriveMs - at) / 60_000;
    if (at >= sun.set && set === null) set = sun.set;
    if (at < sun.rise) rise = sun.rise;
  }
  return { minutes, set, rise };
}

/**
 * The lines of the label of a routing: its hours and length (and against
 * the most efficient departure of the next hours), its manoeuvres, its
 * motor, the strongest wind and gusts, the highest waves, the storm risk,
 * and what changed against the first routing.
 * @param shown - The routing.
 * @param best - The most efficient routing of the next hours, if found.
 * @returns The lines.
 */
export function labelLines(
  shown: ShownRouting,
  best: BestAhead | null,
): string[] {
  const { stats, marks, plan } = shown;
  const departMs = shown.departMs ?? 0;
  const arriveMs = shown.arriveMs ?? departMs;
  const lengthMin = (arriveMs - departMs) / 60_000;
  const lines = [
    `ETD ${hourText(departMs)} · ETA ${hourText(arriveMs)}`,
    `Durée ${fmtDur(arriveMs - departMs)}`,
  ];
  if (best && plan && best.key === planKey(plan)) {
    const more = lengthMin - best.lengthMin;
    const gain = best.soonLengthMin - lengthMin;
    let line = `Meilleur départ des prochaines ${best.hours} h`;
    if (more >= 5) {
      line = `+${minutesText(more)} sur le meilleur départ des prochaines ${best.hours} h (${hourText(best.departMs)})`;
    } else if (Math.abs(departMs - best.soonDepartMs) >= 60_000) {
      // Against leaving at the first hour of the span.
      line += ` : ${gain >= 0 ? '−' : '+'}${minutesText(gain)} sur un départ à ${hourText(best.soonDepartMs)}`;
    }
    lines.push(line);
  }
  if (stats && stats.nm > 0) {
    const speed = lengthMin > 0 ? stats.nm / (lengthMin / 60) : 0;
    lines.push(
      `Distance ${fr(stats.nm)} NM${speed > 0 ? ` · moyenne ${fr(speed)} nd` : ''}`,
    );
  }
  const start = marks[0];
  if (start && arriveMs > departMs) {
    const night = nightOf(departMs, arriveMs, start);
    if (night.minutes >= 10) {
      const when = [
        night.set === null ? '' : `coucher ${hourText(night.set)}`,
        night.rise === null ? '' : `lever ${hourText(night.rise)}`,
      ].filter(Boolean);
      lines.push(
        `De nuit ${minutesText(night.minutes)}${when.length > 0 ? ` (${when.join(', ')})` : ''}`,
      );
    } else {
      const sun = sunTimes(arriveMs, start.lat, start.lon);
      if (sun && arriveMs < sun.set) {
        lines.push(
          `De jour : arrivée ${minutesText((sun.set - arriveMs) / 60_000)} avant le coucher (${hourText(sun.set)})`,
        );
      }
    }
  }
  if (stats) {
    const turns = [
      `${stats.tacks} virement${stats.tacks > 1 ? 's' : ''}`,
      `${stats.gybes} empannage${stats.gybes > 1 ? 's' : ''}`,
    ];
    lines.push(turns.join(' · '));
    if (stats.motorMin >= 1) {
      lines.push(`Moteur ${minutesText(stats.motorMin)}`);
    }
  }
  const tws = stats?.maxTws ?? highest(marks.map((mark) => mark.tws));
  if (tws !== undefined) {
    const gust = stats?.maxGust;
    lines.push(
      `Vent max ${Math.round(tws)} nd${gust === undefined ? '' : ` · rafales ${Math.round(gust)} nd`}`,
    );
  }
  const wave =
    stats?.maxWaveM ?? highest(marks.map((mark) => mark.waveM ?? undefined));
  if (wave !== undefined) lines.push(`Vagues max ${fr(wave)} m`);
  const against = worstAgainst(marks);
  if (against) {
    lines.push(
      `Courant contre le vent ${fr(against.driftKn)} nd / vent ${Math.round(against.tws)} nd à ${hourText(against.ms)}`,
    );
  }
  const cape = stats?.maxCape;
  if (cape !== undefined) {
    lines.push(
      `Risque orageux ${stormRisk(cape)} (CAPE ${Math.round(cape)} J/kg)`,
    );
  }
  const base = plan?.base;
  if (stats && base && base.departMs !== departMs) {
    const changes = routingChanges(
      stats,
      base.stats,
      lengthMin,
      (base.arriveMs - base.departMs) / 60_000,
    );
    if (changes.length > 0) {
      lines.push(`Contre le 1er calcul : ${changes.join(' · ')}`);
    }
  }
  return lines;
}
