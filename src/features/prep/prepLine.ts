import { PREP_PURPOSES, PREP_STEPS } from '../../model/modes.ts';
import type { Cruise } from '../../model/types.ts';
import { boatById, crewSetName, state } from '../../state/index.ts';
import { checkItems, checkLeft } from '../checklists/index.ts';

import { prepPathValid } from './prepPaths.ts';
import type { PrepFlow } from './prepTypes.ts';

/** Where an item of the step line leads. */
export type PrepLineTarget = number | 'paths' | '2t';

/** One item of the line of step titles. */
export interface PrepLineItem {
  /** Step title, or the choice made. */
  text: string;
  /** Where a touch leads. */
  target: PrepLineTarget;
  /** Colour: grey by default, `part` orange, `ok` green, `multi` the paths pill. */
  status: '' | 'part' | 'ok' | 'multi';
  /** Step being shown. */
  current: boolean;
}

/** One numbered pill of the PréP. */
export interface PrepPill {
  /** Step. */
  step: number;
  /** Number shown. */
  label: number;
  /** Classes: `on`, `done`, `view`. */
  className: string;
}

/**
 * Pills of the steps really walked: no duration on a lake, no type at sea
 * (legacy `prepPills`).
 * @param prep - PréP flow.
 * @returns The pills.
 */
export function prepPills(prep: PrepFlow): PrepPill[] {
  const shown = prep.step;
  const reached = prep.reach == null ? shown : Math.max(prep.reach, 0);
  const pills: PrepPill[] = [];
  for (let step = 0; step < PREP_STEPS.length; step++) {
    if (step === (prep.type === 'lac' ? 1 : 0)) continue;
    let className = '';
    if (step === reached) className = 'on';
    else if (step < reached) className = 'done';
    if (step === shown && shown !== reached) className += ' view';
    pills.push({ step, label: pills.length + 1, className: className.trim() });
  }
  return pills;
}

/**
 * The line of step titles (legacy `prepLine`): each title becomes the choice
 * made; grey nothing done, orange started, green final.
 * @param prep - PréP flow.
 * @param cruise - Open cruise.
 * @returns The items.
 */
export function prepLineItems(
  prep: PrepFlow,
  cruise: Cruise | null = state.data.cruise.value,
): PrepLineItem[] {
  const lake = prep.type !== 'mer';
  const items: Array<Omit<PrepLineItem, 'current'>> = [];
  if (lake) {
    let paths = 0;
    for (const [purpose] of PREP_PURPOSES) {
      if (purpose === prep.purpose || prepPathValid(purpose)) paths++;
    }
    if (paths >= 2) {
      items.push({ text: `${paths}x`, target: 'paths', status: 'multi' });
    }
    items.push({
      text: prep.purpose || 'Sortie',
      target: 0,
      status: prep.purpose ? 'part' : '',
    });
  } else {
    items.push(dureeItem(prep));
  }
  const boatName = prepBoatName(prep);
  items.push({
    text: boatName || 'Bateau',
    target: 2,
    status: boatName ? 'ok' : '',
  });
  if (lake && prep.purpose === 'Location') items.push(tarifItem(prep, cruise));
  items.push(
    crewItem(prep, cruise),
    { text: 'Check-in', target: 4, status: checkInStatus(prep, cruise) },
    { text: 'Départ', target: 5, status: '' },
  );
  const shown = prep.step === 2 && prep.sub === 'tarif' ? '2t' : prep.step;
  return items.map((item) => ({ ...item, current: item.target === shown }));
}

function dureeItem(prep: PrepFlow): Omit<PrepLineItem, 'current'> {
  const label = prep.duree === 'jour' ? 'Un jour' : 'Croisière';
  return {
    text: prep.duree ? label : 'Durée',
    target: 1,
    status: prep.duree ? 'ok' : '',
  };
}

function prepBoatName(prep: PrepFlow): string | undefined {
  const boat = prep.boatId ? boatById(prep.boatId) : null;
  return boat ? boat.info.boat : prep.boatName;
}

function tarifItem(
  prep: PrepFlow,
  cruise: Cruise | null,
): Omit<PrepLineItem, 'current'> {
  const chosen = cruise?.tarif as { label?: string; chf?: string } | undefined;
  const amount =
    chosen && chosen.label === prep.tarif && chosen.chf
      ? `CHF ${chosen.chf}`
      : prep.tarif;
  let status: PrepLineItem['status'] = '';
  if (prep.tarif) status = 'ok';
  else if ((prep.reach || 0) >= 3) status = 'part';
  return { text: amount || 'Tarif', target: '2t', status };
}

function crewItem(
  prep: PrepFlow,
  cruise: Cruise | null,
): Omit<PrepLineItem, 'current'> {
  const set = prep.crewSet
    ? state.data.crewSets.value.find((item) => item.id === prep.crewSet)
    : null;
  const names =
    cruise && cruise.crew.length > 0
      ? cruise.crew
          .map((line) => line.nom)
          .filter(Boolean)
          .join(', ')
      : '';
  const name = set ? crewSetName(set) : prep.fresh ? '' : names;
  let status: PrepLineItem['status'] = '';
  if (name) status = 'ok';
  else if (prep.crewDraft?.crew.length) status = 'part';
  return { text: name || 'Équipage', target: 3, status };
}

function checkInStatus(
  prep: PrepFlow,
  cruise: Cruise | null,
): PrepLineItem['status'] {
  if (!cruise || prep.fresh) return '';
  const all = checkItems('dep').length;
  const left = checkLeft('dep').length;
  if (!all) return '';
  if (!left) return 'ok';
  return left < all ? 'part' : '';
}
