import type { SectionDefinition } from './field.ts';
import { numField as n } from './field.ts';
import { STORM_LIGHTS, TREND } from './lists.ts';

/** Day sheet keys kept in `cruise.info` (values of the whole cruise). */
export const DAY_INFO_KEYS: readonly string[] = [
  'moteurInit',
  'fuelInit',
  'vMoteur',
];

/** Daily controls of the sea day sheet. */
const DAY_CONTROLS: readonly string[] = [
  'Eau douce relevée',
  'Batteries, frigo off',
  'VHF ON, squelch',
  'Cabine rangée',
  'Hublots fermés',
  'Cales écopées',
  'Réserves de gaz',
  'Annexe, pagaies, essence',
  'Eau de refroidissement moteur',
  'Vidange eaux noires',
  'Moteur : propreté, filtre, huile, courroie',
];

/** Sections of the day sheet (legacy `DAY_SECTIONS`). */
export const DAY_SECTIONS: readonly SectionDefinition[] = [
  {
    title: 'Étape',
    fields: [
      { key: 'de', label: 'De', type: 'line' },
      { key: 'a', label: 'À', type: 'line' },
    ],
  },
  {
    title: 'Prévisions météo',
    fields: [
      n('fVentDir', 'Vent : direction', '°'),
      n('fVentVit', 'Vent : vitesse', 'nd', { wind: true }),
      n('fRafales', 'Rafales', 'nd', { wind: true }),
      {
        key: 'fVentTend',
        label: 'Tendance du vent',
        type: 'choice',
        options: TREND,
      },
      n('fMerDir', 'Mer : direction', '°', { sea: true }),
      n('fMerH', 'Mer : hauteur', 'm', { sea: true }),
      n('fMerP', 'Mer : période', 's', { sea: true }),
      {
        key: 'fMerTend',
        label: 'Tendance de la mer',
        type: 'choice',
        options: TREND,
        sea: true,
      },
      {
        key: 'fFeux',
        label: 'Feux d’avis de tempête',
        type: 'choice',
        options: STORM_LIGHTS,
        lake: true,
      },
      n('fPression', 'Pression', 'hPa'),
      {
        key: 'fPressTend',
        label: 'Tendance pression',
        type: 'choice',
        options: TREND,
      },
      n('fAir', 'Air', '°C'),
      n('fRessentie', 'Ressentie', '°C'),
      n('fEau', 'Eau', '°C'),
      n('fNuages', 'Nuages', '%'),
      n('fPluie', 'Pluie', 'mm'),
      n('fRisquePluie', 'Risque de pluie', '%'),
      n('fOrage', 'Risque orageux', '%'),
      n('fVisi', 'Visibilité', 'km'),
      n('fHum', 'Humidité', '%'),
      n('fUV', 'Indice UV', ''),
      {
        key: 'fProtection',
        label: 'Protection port ou mouillage / alternative',
        type: 'area',
      },
    ],
  },
  {
    title: 'Route prévue',
    fields: [
      { key: 'dest', label: 'Destination', type: 'line', wide: true },
      n('canal', 'Canal VHF', ''),
      n('duree', 'Durée', 'h'),
      {
        key: 'amarrage',
        label: 'Type d’amarrage, tenue du mouillage',
        type: 'line',
        wide: true,
      },
      n('prof', 'Profondeur', 'm'),
      { key: 'etd', label: 'Départ prévu (ETD)', type: 'clock' },
      { key: 'eta', label: 'Arrivée prévue (ETA)', type: 'clock' },
      { key: 'lever', label: 'Lever du soleil', type: 'clock' },
      { key: 'coucher', label: 'Coucher du soleil', type: 'clock' },
    ],
  },
  {
    title: 'Moteur et carburant',
    fields: [
      n('moteurInit', 'Compteur moteur au départ de la croisière', 'h', {
        wide: true,
      }),
      n('fuelInit', 'Carburant au départ de la croisière', 'l'),
      n('vMoteur', 'Vitesse au moteur', 'nd'),
      n('moteurSoir', 'Heures moteur relevées ce soir', 'h', { wide: true }),
      n('plein', 'Carburant ajouté ce jour', 'l', { wide: true }),
      { key: 'calcMoteur', type: 'calc', calc: 'engine' },
    ],
  },
  {
    title: 'Navigation du jour',
    fields: [
      { key: 'calcNav', type: 'calc', calc: 'nav' },
      {
        key: 'dureeNav',
        label: 'Durée de navigation saisie à la main (remplace le calcul)',
        type: 'line',
        wide: true,
        placeholder: 'ex. 5 h 30',
      },
    ],
  },
  {
    title: 'Milles parcourus',
    fields: [
      n('nmJour', 'Milles effectués ce jour', 'NM', { wide: true }),
      { key: 'calcMilles', type: 'calc', calc: 'miles' },
    ],
  },
  {
    title: 'Contrôles',
    fields: [
      { key: 'ctrl', type: 'check', options: DAY_CONTROLS },
      n('eauDouce', 'Eau douce restante', 'l', { wide: true }),
    ],
  },
  {
    title: 'Marées',
    sea: true,
    fields: [
      { key: 'marPort', label: 'Port', type: 'line' },
      n('marCoeff', 'Coefficient', ''),
      { key: 'marees', type: 'tides' },
    ],
  },
  {
    title: 'Conditions spéciales, quarts',
    sea: true,
    fields: [
      n('hNuit', 'Heures de nuit', 'h'),
      n('h5bf', 'Heures > 5 Bf', 'h'),
      { key: 'quarts', label: 'Organisation des quarts', type: 'area' },
    ],
  },
  {
    title: 'Escale et debriefing',
    fields: [
      {
        key: 'dysfonct',
        label: 'Dysfonctionnements constatés en route',
        type: 'area',
      },
      {
        key: 'aFaire',
        label: 'Problèmes à résoudre à l’escale, interventions',
        type: 'area',
      },
      {
        key: 'avitaillement',
        label: 'Avitaillement complémentaire',
        type: 'area',
      },
      { key: 'debrief', label: 'Debriefing de la journée', type: 'area' },
    ],
  },
  {
    title: 'Signatures',
    fields: [
      { key: 'navigateur', label: 'Navigateur', type: 'crewpick' },
      { key: 'sigNav', label: 'Signature du navigateur', type: 'signature' },
      { key: 'skipper', label: 'Skipper', type: 'crewpick' },
      { key: 'sigSkip', label: 'Signature du skipper', type: 'signature' },
    ],
  },
];
