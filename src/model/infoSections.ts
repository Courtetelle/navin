import { radioDesc } from '../lib/boatDescription.ts';
import {
  callsignClean,
  callsignNote,
  mmsiClean,
  mmsiNote,
} from '../lib/radioId.ts';

import { BOAT_DATA_FIELDS } from './boatDataFields.ts';
import type { FieldDefinition, SectionDefinition } from './field.ts';
import { TECH_FIELDS, powerPair } from './techFields.ts';

/** MMSI and call sign of the boat VHF (cruise sheet and boat sheet). */
export const RADIO_ID_FIELDS: readonly FieldDefinition[] = [
  {
    key: 'mmsi',
    label: 'Numéro MMSI',
    type: 'line',
    lock: true,
    inputmode: 'numeric',
    wide: true,
    placeholder: 'ex. 269 123 456',
    clean: mmsiClean,
    note: mmsiNote,
  },
  {
    key: 'callsign',
    label: 'Indicatif d’appel',
    type: 'line',
    lock: true,
    wide: true,
    placeholder: 'ex. HBY1234',
    clean: callsignClean,
    note: callsignNote,
  },
];

/**
 * The same MMSI and call sign on a cruise sheet: taken from the boat sheet,
 * never typed in the cruise.
 */
export const CRUISE_RADIO_FIELDS: readonly FieldDefinition[] =
  RADIO_ID_FIELDS.map(({ note, ...field }) => ({
    ...field,
    lock: false,
    fromBoat: true,
    placeholder: '',
    note: (value: string) =>
      value
        ? `${note?.(value) ?? ''} · fiche du bateau`
        : 'À saisir sur la fiche du bateau (Bateaux)',
  }));

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
      ...CRUISE_RADIO_FIELDS,
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
    title: 'Compagnie Charter, base',
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
