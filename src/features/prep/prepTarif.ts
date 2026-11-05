import { dayKey, num, textOf } from '../../lib/format.ts';
import type { Boat } from '../../model/types.ts';
import { updateCruise } from '../../state/index.ts';
import { rentalPrice } from '../boats/index.ts';

import { updatePrepFlow } from './prepTypes.ts';

/** One line of the « Tarifs » text of a boat. */
export interface PrepTarif {
  /** Position in the list. */
  index: number;
  /** Whole line. */
  line: string;
  /** Text before the colon. */
  label: string;
  /** Text after the colon. */
  price: string;
  /** Amount, rounded, `''` when the line has none. */
  chf: string;
}

const DAY_NAMES = [
  'dimanche',
  'lundi',
  'mardi',
  'mercredi',
  'jeudi',
  'vendredi',
  'samedi',
];

/**
 * Fares of a boat, one per line of its « Tarifs » text (legacy `prepTarifs`).
 * @param boat - Boat.
 * @returns The fares.
 */
export function prepTarifs(
  boat: Pick<Boat, 'info'> | null | undefined,
): PrepTarif[] {
  const lines = textOf(boat?.info?.tarifs)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.map((line, index) => {
    const amount = /(?<amount>\d+(?:[.,]\d{1,2})?)(?!.*\d)/.exec(line);
    const parts = line.split(/\s*:\s*/);
    return {
      index,
      line,
      label: parts.length > 1 ? (parts[0] ?? '') : line,
      price: parts.length > 1 ? parts.slice(1).join(' : ') : '',
      chf: amount?.groups
        ? String(Math.round(num(amount.groups.amount) ?? 0))
        : '',
    };
  });
}

/**
 * The fare of the moment: day of the week or week-end, day or evening from
 * 16:30 (legacy `prepTarifSuggest`).
 * @param boat - Boat.
 * @param now - Moment considered.
 * @returns The fare, if any, and the reason shown.
 */
export function prepTarifSuggest(
  boat: Pick<Boat, 'info'> | null | undefined,
  now: Date = new Date(),
): { tarif: PrepTarif | undefined; why: string } {
  const wanted = rentalPrice(now.getTime(), boat?.info?.tarifs);
  const weekend = now.getDay() === 0 || now.getDay() === 6;
  const evening = now.getHours() * 60 + now.getMinutes() >= 16 * 60 + 30;
  const tarifs = prepTarifs(boat);
  const tarif =
    tarifs.find((item) => {
      const isWeekend = /\bwe\b|week-?end|samedi|dimanche/i.test(item.line);
      const isEvening = /soir|17\s*h/i.test(item.line);
      return isWeekend === weekend && isEvening === evening;
    }) ?? tarifs.find((item) => item.chf === wanted);
  return {
    tarif,
    why: `${DAY_NAMES[now.getDay()] ?? ''}${evening ? ' soir' : ''}`,
  };
}

/**
 * Keep the fare chosen: on the outing, and its amount on the sheet of the day,
 * where it can still be changed (legacy `prepTarifApply`).
 * @param tarif - Fare, or null for none.
 */
export function prepTarifApply(tarif: PrepTarif | null | undefined): void {
  updatePrepFlow((prep) => {
    prep.tarif = tarif ? tarif.label : 'Sans tarif';
  });
  const today = dayKey(new Date());
  updateCruise((cruise) => {
    if (!tarif) {
      Reflect.deleteProperty(cruise, 'tarif');
      return;
    }
    cruise.tarif = { label: tarif.label, chf: tarif.chf, line: tarif.line };
    if (!tarif.chf) return;
    cruise.days[today] ??= {};
    cruise.days[today].typeSortie = 'Location';
    cruise.days[today].montant = tarif.chf;
  });
}
