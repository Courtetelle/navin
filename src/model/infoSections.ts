import { radioDesc } from '../lib/boatDescription.ts';

import { BOAT_DATA_FIELDS } from './boatDataFields.ts';
import type { SectionDefinition } from './field.ts';
import { TECH_FIELDS, powerPair } from './techFields.ts';

/** Sections of the "Bateau et croisière" sheet (legacy `INFO_SECTIONS`). */
export const INFO_SECTIONS: readonly SectionDefinition[] = [
  {
    title: 'Croisière',
    fields: [
      {
        key: 'name',
        label: 'Nom de la croisière',
        type: 'line',
        wide: true,
        placeholder: 'ex. Croatie 2026',
      },
      {
        key: 'ports',
        label: 'Port de départ et d’arrivée',
        type: 'line',
        wide: true,
      },
      { key: 'du', label: 'Du', type: 'date' },
      { key: 'au', label: 'Au', type: 'date', minFrom: 'du' },
    ],
  },
  {
    title: 'Données techniques',
    fields: BOAT_DATA_FIELDS,
  },
  {
    title: 'Informations',
    fields: [
      ...TECH_FIELDS,
      {
        key: 'engine',
        label: 'Moteur (marque, transmission)',
        type: 'line',
        grow: true,
        wide: true,
        gasOnly: true,
      },
      ...powerPair('power', 'powerCh', 'Puissance', 'pw', { gasOnly: true }),
      {
        key: 'battType',
        label: 'Type de batteries',
        type: 'line',
        grow: true,
        wide: true,
        elecOnly: true,
        placeholder: 'ex. lithium',
      },
      ...powerPair('podKw', 'podCh', 'Puissance du pod électrique', 'pod', {
        elecOnly: true,
      }),
      ...powerPair(
        'genKw',
        'genCh',
        'Puissance du générateur (back-up)',
        'gen',
        { elecOnly: true },
      ),
    ],
  },
  {
    title: 'Radio et identification',
    fields: [
      {
        key: 'callsign',
        label: 'Indicatif (call sign)',
        type: 'line',
        lock: true,
      },
      {
        key: 'mmsi',
        label: 'MMSI',
        type: 'line',
        lock: true,
        inputmode: 'numeric',
      },
      {
        key: 'sailColor',
        label: 'Couleur des voiles',
        type: 'line',
        grow: true,
        placeholder: 'ex. blanches',
      },
      {
        key: 'desc',
        label: 'Description pour la radio',
        type: 'descgen',
        wide: true,
        auto: (data) => radioDesc(data, 'en', true),
        rule: () =>
          'calcul : modèle, longueur, couleurs et inscription · toucher : français 3 s',
      },
      {
        key: 'vhfMarina',
        label: 'Canal VHF de la marina',
        type: 'line',
        grow: true,
      },
      {
        key: 'coastStation',
        label: 'Station côtière radio',
        type: 'line',
        grow: true,
        placeholder: 'ex. Split Radio',
      },
    ],
  },
  {
    title: 'Loueur, base',
    fields: [
      { key: 'base', label: 'Chef de base, bureau, téléphones', type: 'area' },
    ],
  },
  {
    title: 'Location et règlement du bateau',
    lake: true,
    fields: [
      {
        key: 'tarifs',
        label: 'Tarifs de location',
        type: 'area',
        rows: 4,
        placeholder: 'ex. Journée semaine : CHF …\nDès 17h00 : CHF …',
      },
      {
        key: 'reglement',
        label: 'Règlement, franchise d’assurance',
        type: 'area',
        rows: 6,
      },
    ],
  },
  {
    title: 'Numéros utiles (page SOS)',
    fields: [
      {
        key: 'contacts',
        label: 'Un par ligne, sous la forme « Nom : numéro »',
        type: 'area',
        rows: 6,
      },
    ],
  },
  {
    title: 'Météo',
    fields: [
      {
        key: 'meteo',
        label: 'Bulletins VHF (canaux, horaires), sites web, heure légale',
        type: 'area',
        rows: 5,
      },
    ],
  },
];
