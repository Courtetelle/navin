import { marginVal, pairConv, pairManual } from '../lib/boatValues.ts';
import { frN, num } from '../lib/format.ts';

import type { FieldDefinition } from './field.ts';
import { numField as n } from './field.ts';

/** Factor between kilowatts and metric horsepower. */
const CH_PER_KW = 1.359_62;

/**
 * A kW field and its horsepower twin, each computed from the other.
 * @param kwKey - Key of the kW field.
 * @param chKey - Key of the ch field.
 * @param label - Label of the kW field.
 * @param frame - Shared frame.
 * @param extra - Flags of both fields (gasOnly, elecOnly).
 * @returns The two field definitions.
 */
export function powerPair(
  kwKey: string,
  chKey: string,
  label: string,
  frame: string,
  extra: Partial<FieldDefinition>,
): FieldDefinition[] {
  return [
    n(kwKey, label, 'kW', {
      frame,
      ...extra,
      rule: () => 'calcul : ch ÷ 1,36',
      auto: (data) => pairConv(data[chKey], 1 / CH_PER_KW, 1),
      pair: chKey,
      manual: (data) => pairManual(data, kwKey, chKey, kwKey),
    }),
    n(chKey, '', 'ch', {
      unitOnly: true,
      frame,
      ...extra,
      rule: () => 'calcul : kW × 1,36',
      auto: (data) => pairConv(data[kwKey], CH_PER_KW, 1),
      pair: kwKey,
      manual: (data) => pairManual(data, chKey, kwKey, kwKey),
    }),
  ];
}

/** Technical sheet fields, at the top of the "Informations" section (legacy `TECH_FIELDS`). */
export const TECH_FIELDS: readonly FieldDefinition[] = [
  {
    key: 'builder',
    label: 'Constructeur',
    type: 'line',
    grow: true,
    wide: true,
  },
  {
    key: 'architect',
    label: 'Architecte',
    type: 'line',
    grow: true,
    wide: true,
  },
  { key: 'hin', label: 'CIN / HIN n°', type: 'line', grow: true, wide: true },
  {
    key: 'ceId',
    label: 'Identification CE',
    type: 'line',
    grow: true,
    wide: true,
  },
  { key: 'flag', label: 'Pavillon', type: 'line', grow: true },
  { key: 'homePort', label: 'Port d’attache', type: 'line', grow: true },
  {
    key: 'flagNo',
    label: 'Pavillon / francisation n°',
    type: 'line',
    grow: true,
    wide: true,
  },
  {
    key: 'reg',
    label: 'Immatriculation',
    type: 'line',
    grow: true,
    wide: true,
  },
  {
    key: 'category',
    label: 'Catégorie de conception',
    type: 'line',
    grow: true,
    wide: true,
  },
  n('lhull', 'Longueur de coque (LH)', 'm', {
    frame: 'lw',
    lock: true,
    rule: (settings) =>
      `calcul : longueur hors-tout − ${frN(marginVal(settings, 'coquePct'))} %`,
    auto: (data, settings) => {
      const length = num(data.loa) ?? num(pairConv(data.loaFt, 0.3048, 2));
      return length == null
        ? ''
        : frN(
            Math.round(
              length * (1 - marginVal(settings, 'coquePct') / 100) * 100,
            ) / 100,
          );
    },
  }),
  n('lwl', 'Longueur flottaison (LWL)', 'm', { lock: true, frame: 'lw' }),
  n('displ', 'Déplacement lège', 'kg', { frame: 'displ' }),
  n('keelWeight', 'dont quille', 'kg', { frame: 'displ' }),
  {
    key: 'anchor',
    label: 'Ancre (type, chaîne)',
    type: 'line',
    grow: true,
    frame: 'anc',
  },
  n('anchorKg', 'Poids de l’ancre', 'kg', { frame: 'anc' }),
  {
    key: 'rig',
    label: 'Type de bateau',
    type: 'line',
    grow: true,
    wide: true,
    frame: 'rig',
  },
  {
    key: 'rigging',
    label: 'Gréement',
    type: 'line',
    grow: true,
    wide: true,
    frame: 'rig',
    placeholder: 'ex. sloop en tête de mât, fractionné',
  },
  n('sails', 'Surface de voilure au près', 'm²', { wide: true, frame: 'rig' }),
];

/** Radio fields hidden in inland waters. */
export const WATERS_SEA_ONLY: readonly string[] = [
  'callsign',
  'mmsi',
  'vhfMarina',
  'coastStation',
  'desc',
];
