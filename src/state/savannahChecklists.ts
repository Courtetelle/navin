import type { Boat, ChecklistItem } from '../model/types.ts';
import { store } from '../storage/store.ts';

const CHECK_IN_LISTS = ['checklistDep', 'checklistDepX'] as const;

/** Reading labels renamed once: key → [old label, new label]. */
const READING_LABELS: Readonly<Record<string, readonly [string, string]>> = {
  carbPct: ['Relever le niveau de carburant', 'Checker le niveau de carburant'],
  batt1: ['Relever la tension de la batterie 1', 'Tension de la batterie 1'],
  batt2: ['Relever la tension de la batterie 2', 'Tension de la batterie 2'],
  eauPct: ['Relever le niveau d’eau', 'Niveau d’eau potable'],
};

/**
 * One-shot fixes of the Savannah check-in lists (flags `noBattOpen`,
 * `motLabel`, `ck383` on the boat), each persisted as in legacy.
 * @param boat - The Savannah, changed in place.
 * @param boats - All boats (written after each fix).
 */
export function migrateSavannahChecklists(boat: Boat, boats: Boat[]): void {
  if (!boat.noBattOpen) {
    for (const property of CHECK_IN_LISTS) {
      const list = boat[property];
      if (list) {
        boat[property] = list.filter(
          (item) => item.label !== 'Ouvrir la batterie du moteur',
        );
      }
    }
    boat.noBattOpen = true;
    store.set('ldb.boats', boats);
  }
  if (!boat.motLabel) {
    for (const property of CHECK_IN_LISTS) {
      for (const item of boat[property] || []) {
        if (
          item.key === 'moteurDebut' &&
          item.label === 'Relever les heures moteur'
        ) {
          item.label = 'Allumer le moteur et relever les heures moteur';
        }
      }
    }
    boat.motLabel = true;
    store.set('ldb.boats', boats);
  }
  if (!boat.ck383) {
    if (boat.checklistDep) {
      boat.checklistDep = boat.checklistDep.filter(
        (item: ChecklistItem) => item.label !== 'Fermer le frigo',
      );
    }
    for (const property of CHECK_IN_LISTS) {
      for (const item of boat[property] || []) {
        const rename = item.key ? READING_LABELS[item.key] : undefined;
        if (!rename) continue;
        if (item.label === rename[0]) item.label = rename[1];
      }
    }
    boat.ck383 = true;
    store.set('ldb.boats', boats);
  }
}
