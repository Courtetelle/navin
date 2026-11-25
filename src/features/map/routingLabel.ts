import { fmtDur, fmtTime, fr } from '../../lib/format.ts';
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
    lines.push(
      more >= 5
        ? `+${minutesText(more)} sur le meilleur départ des ${best.hours} h (${hourText(best.departMs)})`
        : `Meilleur départ des ${best.hours} prochaines heures`,
    );
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
