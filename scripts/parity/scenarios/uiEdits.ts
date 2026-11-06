import type { Scenario } from '../types.ts';

import { IGNORE_NAME, here, quiet } from './mapFixtures.ts';

const edited = { view: 'x', orig: 'x', at: '2026-07-01T10:00:00.000Z' };
const dataTab = {
  ...edited,
  label: 'Infos',
  sub: 'tout',
  size: 's',
  wrap: 'clip',
};
const sosTab = { ...edited, wrap: 'roll' };
/** Label edits on what is not a React `Button`. */
export const uiEditScenarios: Scenario[] = [
  {
    name: 'ui-edit-tabs',
    fixture: 'sample-lake',
    overrides: {
      ...quiet,
      // Legacy reads `data-base` or not at boot, which of the two comes first
      // being a race: both keys hold the edit.
      'ldb.uiEdits': {
        'onglets|data-view=more&data-pt=1&data-base=data': dataTab,
        'onglets|data-view=more&data-pt=1': dataTab,
        'onglets|data-view=sos&data-pt=1&data-base=SOS': sosTab,
        'onglets|data-view=sos&data-pt=1': sosTab,
      },
    },
    steps: [
      { wait: 2500 },
      { snapshot: 'boot' },
      { go: 'more' },
      { wait: 500 },
      { snapshot: 'more' },
      { click: '.top-tab[data-view="more"]' },
      { wait: 500 },
      { snapshot: 'choice' },
      { wait: 5500 },
      { snapshot: 'back-to-name' },
    ],
  },
  {
    name: 'ui-edit-links',
    fixture: 'sample-lake',
    overrides: {
      ...quiet,
      'ldb.uiEdits': {
        'map|#mapAsc': { ...edited, label: 'Courbes', sub: 'sur l’appareil' },
        'map|txt=🌐 Carte interactive du Léman (ArcGIS)': {
          ...edited,
          label: 'ArcGIS',
          size: 'l',
        },
        'docs|txt=🌐 Carte interactive du Léman (ArcGIS)': {
          ...edited,
          label: 'Le Léman',
          wrap: 'clip',
        },
        'docs|txt=🌐 Ouvrir en ligne': { ...edited, label: 'En ligne' },
        'cartes|txt=🌐 Carte ArcGIS du Léman': {
          ...edited,
          label: 'Léman',
          wrap: 'roll',
        },
        'sos|txt=📞': { ...edited, label: '☎️', size: 'xl' },
      },
    },
    steps: [
      { wait: 2500 },
      { go: 'map' },
      { wait: 1200 },
      { snapshot: 'map' },
      { go: 'docs' },
      { wait: 600 },
      { snapshot: 'docs' },
      { go: 'cartes' },
      { wait: 900 },
      { snapshot: 'cartes' },
      { go: 'sos' },
      { wait: 600 },
      { snapshot: 'sos' },
    ],
    ignoreAttributes: IGNORE_NAME,
  },
  {
    name: 'ui-edit-popup',
    fixture: 'sample-lake',
    overrides: {
      ...quiet,
      'ldb.marks': [],
      'ldb.uiEdits': {
        'tracker|data-lp=goto': { ...edited, label: 'Aller', size: 'l' },
        'tracker|data-lp=mark': { ...edited, sub: 'ici', wrap: 'clip' },
      },
    },
    geolocation: here,
    steps: [
      { wait: 3000 },
      { longpress: '#trkMap', ms: 900 },
      { wait: 400 },
      { snapshot: 'long-press' },
    ],
    ignoreAttributes: IGNORE_NAME,
  },
  {
    name: 'ui-edit-mark-popup',
    fixture: 'sample-lake',
    overrides: {
      ...quiet,
      'ldb.uiEdits': {
        'tracker|txt=🎯 Go to': { ...edited, label: 'Aller', size: 'l' },
        'tracker|txt=📒 Mes marques': {
          ...edited,
          label: 'Liste',
          wrap: 'roll',
        },
      },
    },
    steps: [
      { wait: 3000 },
      { click: '.mark-ic' },
      { wait: 500 },
      { snapshot: 'popup' },
    ],
    ignoreAttributes: IGNORE_NAME,
  },
];
