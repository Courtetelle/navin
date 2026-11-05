import { DAY_SECTIONS } from './daySections.ts';
import type { SectionDefinition } from './field.ts';
import { numField as n } from './field.ts';
import { LAKE_WX, LEVELS, OUTING_TYPES } from './lists.ts';

/** Sections of the simplified lake day sheet (legacy `LAKE_DAY_SECTIONS`). */
export const LAKE_DAY_SECTIONS: readonly SectionDefinition[] = [
  {
    title: '1 · Informations générales',
    fields: [
      {
        key: 'typeSortie',
        label: 'Type de sortie',
        type: 'choice',
        options: OUTING_TYPES,
      },
      { key: 'skipper', label: 'Skipper', type: 'crewpick' },
      { key: 'coSkipper', label: 'Second', type: 'crewpick' },
      { key: 'equipage', label: 'Équipage', type: 'area', rows: 2 },
      { key: 'calcLake', type: 'calc', calc: 'lake' },
      n('nmJour', 'Nombre de milles parcourus', 'NM', { wide: true }),
      n('moteurDebut', 'Heures moteur : début', 'h'),
      n('moteurSoir', 'Heures moteur : fin', 'h'),
      n('carbPct', 'Carburant à l’arrivée', '%'),
      n('eauPct', 'Eau à l’arrivée', '%'),
      n('batt1', 'Batterie 1 à l’arrivée', 'V'),
      n('batt2', 'Batterie 2 à l’arrivée', 'V'),
      {
        key: 'diesel',
        label: 'Niveau du diesel',
        type: 'choice',
        options: LEVELS,
      },
      {
        key: 'eauPotable',
        label: 'Niveau de l’eau potable',
        type: 'choice',
        options: LEVELS,
      },
      {
        key: 'eauxNoires',
        label: 'Réservoir eaux noires',
        type: 'choice',
        options: [['OK'], ['À vidanger']],
      },
      {
        key: 'respUnique',
        label: 'Skipper seul responsable de la franchise (entraînement)',
        type: 'choice',
        options: [['Non, partagée'], ['Oui, le skipper']],
      },
      n('montant', 'Location : montant', 'CHF'),
      {
        key: 'lienDossier',
        label: 'Documents de la sortie : lien vers le dossier',
        type: 'line',
        wide: true,
        inputmode: 'url',
      },
    ],
  },
  {
    title: '2 · Observations, constatations, propositions d’améliorations',
    fields: [
      { key: 'observations', label: '', type: 'area', rows: 5 },
      { key: 'sigSkip', label: 'Signature du responsable', type: 'signature' },
    ],
  },
  {
    title: 'Météo (facultatif)',
    collapsed: true,
    fields: DAY_SECTIONS.flatMap((section) => section.fields).filter((field) =>
      LAKE_WX.includes(field.key),
    ),
  },
];
