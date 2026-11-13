import { createElement } from 'react';

import { fmtShortDate, keyToDate } from '../../lib/format.ts';
import { roleLabel } from '../../model/crewFields.ts';
import type { CrewMember } from '../../model/types.ts';
import {
  boatById,
  deliver,
  fileName,
  isLake,
  state,
  toast,
} from '../../state/index.ts';
import { printInHolder } from '../publish/index.ts';

import { CrewPrintPage } from './CrewPrintPage.tsx';
import { sheetPng } from './externals.ts';

/** Crew list columns in the order of the paper form: field, label (legacy `CREW_LIST_COLS`). */
export const CREW_LIST_COLS: ReadonlyArray<readonly [string, string]> = [
  ['fonction', 'Fonction à bord'],
  ['nom', 'Prénom nom'],
  ['piece', 'Passeport / carte ID'],
  ['permis', 'Permis n°'],
  ['tel', 'Téléphone'],
  ['naissance', 'Date de naissance'],
  ['expiration', 'Date d’expiration'],
  ['emisPar', 'Établi par'],
  ['email', 'Courriel'],
  ['lieu', 'Lieu de naissance / d’origine'],
  ['adresse', 'Adresse postale'],
  ['nationalite', 'Nationalité'],
  ['vhf', 'Licence VHF n°'],
  ['proche', 'Proche à contacter'],
  ['sante', 'Santé, allergies'],
];

/** Heading of the crew list (legacy `crewListHead`). */
export interface CrewListHead {
  title: string;
  boat: string;
  dates: string;
  /** People on board. */
  n: number;
}

/**
 * Heading of the crew list of the open cruise (legacy `crewListHead`).
 * @returns Title, boat, dates and count.
 */
export function crewListHead(): CrewListHead {
  const cruise = state.data.cruise.value;
  const info = cruise?.info ?? {};
  const lake = isLake();
  const boat = lake ? boatById(cruise?.boatId) : undefined;
  const dates = lake
    ? fmtShortDate(new Date(cruise?.created ?? ''))
    : [info.du, info.au]
        .filter(Boolean)
        .map((day) => fmtShortDate(keyToDate(day as string)))
        .join(' → ');
  return {
    title: `Liste d’équipage · ${info.name ?? ''}`.trim(),
    boat: boat ? boat.info.boat || info.boat || '' : info.boat || '',
    dates,
    n: cruise?.crew.length ?? 0,
  };
}

/**
 * Columns chosen for the list, kept on the phone; the name is always included
 * (legacy `crewListCols`).
 * @returns The columns.
 */
export function crewListCols(): ReadonlyArray<readonly [string, string]> {
  const selected = state.preferences.settings.value.crewCols;
  return CREW_LIST_COLS.filter(
    ([key]) =>
      key === 'nom' || !Array.isArray(selected) || selected.includes(key),
  );
}

/**
 * Role of a crew line agreed with the gender (legacy `crewRole`).
 * @param member - Crew line.
 * @returns The role, or `''`.
 */
export function crewRole(member: CrewMember): string {
  return roleLabel(member.fonction, member.sexe) || '';
}

/** Print the crew list on an A4 landscape page (legacy `printCrewList`). */
export function printCrewList(): void {
  printInHolder({
    className: 'print-only book crew-print',
    content: createElement(CrewPrintPage),
    title: fileName('-equipage', 'pdf').replace(/\.pdf$/, ''),
    css: '@media print { main { display:none } @page { size: A4 landscape; margin: 8mm } }',
  });
}

/**
 * Send the crew list as an image, for WhatsApp (legacy `shareCrewList`).
 * @param setBusy - Disables the button meanwhile.
 */
export async function shareCrewList(
  setBusy?: (busy: boolean) => void,
): Promise<void> {
  if (!state.data.cruise.value?.crew.length) {
    toast('Personne à bord pour l’instant');
    return;
  }
  setBusy?.(true);
  try {
    const blob = await crewListPng();
    await deliver(blob, fileName('-equipage', 'png'), 'image/png');
  } catch {
    toast('Image impossible : faites une capture d’écran');
  }
  setBusy?.(false);
}

/**
 * The crew list of the outing as a PNG.
 * @returns The image.
 */
export async function crewListPng(): Promise<Blob> {
  const head = crewListHead();
  const columns = crewListCols();
  const withRole = columns.some(([key]) => key === 'fonction');
  const crew = state.data.cruise.value?.crew ?? [];
  return sheetPng({
    title: head.title,
    showObs: false,
    checks: [],
    sections: [
      {
        title: 'Navigation',
        rows: [
          ['Bateau', head.boat || '–'],
          ['Dates', head.dates || '–'],
          ['Personnes à bord', String(head.n)],
        ],
      },
      ...crew.map((member, index) => {
        const role = crewRole(member);
        return {
          title: `${index + 1}. ${member.nom || '…'}${role && withRole ? ` · ${role}` : ''}`,
          rows: columns
            .filter(
              ([key]) => key !== 'fonction' && key !== 'nom' && member[key],
            )
            .map(([key, label]) => [label, String(member[key])] as const),
        };
      }),
    ],
  });
}
