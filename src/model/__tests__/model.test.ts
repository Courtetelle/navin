import { expect, test } from 'vitest';

import {
  BOAT_KEYS,
  boatSections,
  boatSnap,
  boatSub,
  infoDiffKeys,
} from '../boatSheet.ts';
import { inFrenchLeman, inInland } from '../contacts.ts';
import { MEMBER_KEYS, roleLabel } from '../crewFields.ts';
import { DAY_SECTIONS } from '../daySections.ts';
import { autoVal, flatFields } from '../field.ts';
import { INFO_SECTIONS } from '../infoSections.ts';
import { LAKE_DAY_SECTIONS } from '../lakeDaySections.ts';
import { modeOf } from '../modes.ts';
import { SETTINGS_DEFAULTS } from '../settings.ts';
import type { Boat } from '../types.ts';

const infoField = (key: string) => {
  const found = flatFields(
    INFO_SECTIONS.flatMap((section) => section.fields),
  ).find((field) => field.key === key);
  if (!found) throw new Error(key);
  return found;
};

test('zones of Lake Geneva and inland waters', () => {
  expect([
    inFrenchLeman({ lat: 46.4, lon: 6.6 }),
    inFrenchLeman({ lat: 46.5, lon: 6.6 }),
    inFrenchLeman({ lat: 46.38, lon: 6.25 }),
    inFrenchLeman(null),
  ]).toStrictEqual([true, false, false, false]);
  expect([
    inInland({ lat: 46.45, lon: 6.55 }),
    inInland({ lat: 43.1, lon: 5.9 }),
    inInland(null),
  ]).toStrictEqual([true, false, false]);
});

test('modes and roles', () => {
  expect([
    modeOf(null),
    modeOf({ type: 'mer' }),
    modeOf({ type: 'lac' }),
    modeOf({ type: 'lac', duree: 'croisiere' }),
  ]).toStrictEqual(['mer', 'mer', 'lacj', 'lacc']);
  expect([
    roleLabel('Second', 'Femme'),
    roleLabel('Équipier', 'Femme'),
    roleLabel('Skipper', 'Femme'),
    roleLabel('Second', 'Homme'),
    roleLabel(undefined),
  ]).toStrictEqual(['Seconde', 'Équipière', 'Skipper', 'Second', '']);
});

test('computed boat fields follow the settings margins', () => {
  const data = { loaFt: '31,6', draft: '1,53', airDraft: '14,77' };
  expect(autoVal(infoField('loa'), data, SETTINGS_DEFAULTS)).toBe('9,63');
  expect(autoVal(infoField('lhull'), data, SETTINGS_DEFAULTS)).toBe('9,53');
  expect(autoVal(infoField('draftPilot'), data, SETTINGS_DEFAULTS)).toBe('2,2');
  expect(
    autoVal(infoField('airMargin'), data, {
      ...SETTINGS_DEFAULTS,
      arrHaut: 0.5,
    }),
  ).toBe('16,5');
  expect(infoField('draftPilot').rule?.(SETTINGS_DEFAULTS)).toBe(
    'calcul : tirant d’eau + 0,6 m, arrondi au 0,1 m supérieur',
  );
  expect(
    autoVal(infoField('powerCh'), { power: '13,3' }, SETTINGS_DEFAULTS),
  ).toBe('18,1');
});

test('section definitions keep the legacy keys', () => {
  expect(DAY_SECTIONS.map((section) => section.title)).toStrictEqual([
    'Étape',
    'Prévisions météo',
    'Route prévue',
    'Moteur et carburant',
    'Navigation du jour',
    'Milles parcourus',
    'Contrôles',
    'Marées',
    'Conditions spéciales, quarts',
    'Escale et debriefing',
    'Signatures',
  ]);
  expect(LAKE_DAY_SECTIONS[2]?.fields.map((field) => field.key)).toStrictEqual([
    'fVentDir',
    'fVentVit',
    'fRafales',
    'fVentTend',
    'fFeux',
    'fAir',
    'fEau',
    'fOrage',
  ]);
  expect(MEMBER_KEYS).toStrictEqual([
    'sexe',
    'naissance',
    'lieu',
    'nationalite',
    'tel',
    'email',
    'piece',
    'expiration',
    'permis',
    'vhf',
    'emisPar',
    'adresse',
    'sante',
    'procheNom',
    'procheTel',
    'proche2Nom',
    'proche2Tel',
    'proche3Nom',
    'proche3Tel',
    'pieceType',
    'lieuType',
  ]);
  expect(BOAT_KEYS).toStrictEqual([
    'boat',
    'waters',
    'model',
    'year',
    'pas',
    'loaFt',
    'loa',
    'beam',
    'draft',
    'draftPilot',
    'airDraft',
    'airMargin',
    'voilesAvant',
    'hullColor',
    'marking',
    'energy',
    'propType',
    'fuelCap',
    'fuelCap2',
    'conso',
    'conso2',
    'battKwh',
    'genFuelCap',
    'genConso',
    'waterCap',
    'waterCap2',
    'waterCap3',
    'builder',
    'architect',
    'hin',
    'ceId',
    'flag',
    'homePort',
    'flagNo',
    'reg',
    'category',
    'lhull',
    'lwl',
    'displ',
    'keelWeight',
    'anchor',
    'anchorKg',
    'rig',
    'rigging',
    'sails',
    'engine',
    'power',
    'powerCh',
    'battType',
    'podKw',
    'podCh',
    'genKw',
    'genCh',
    'callsign',
    'mmsi',
    'sailColor',
    'desc',
    'vhfMarina',
    'coastStation',
    'base',
    'tarifs',
    'reglement',
    'contacts',
    'gvDesc',
    'voilesDesc',
    'gvColor',
    'voilesColor',
    'vMoteur',
  ]);
});

test('boat sheet: custom fields, aliases, sub-label and versions', () => {
  const boat: Boat = {
    id: 'b1',
    info: { model: 'Hanse 325', year: 'construit en 2013' },
    custom: [
      { id: 'c1', label: 'Place au port', after: 'homePort' },
      { id: 'c2', label: 'Début', after: '§Informations' },
      { id: 'c3', label: 'Ailleurs', after: 'inconnu' },
    ],
    alias: { reg: 'Plaque' },
  };
  const information = boatSections(boat).find(
    (section) => section.title === 'Informations',
  );
  const keys = information?.fields.map((field) => field.key) ?? [];
  expect(keys.slice(0, 2)).toStrictEqual(['x_c2', 'builder']);
  expect(keys[keys.indexOf('homePort') + 1]).toBe('x_c1');
  expect(keys.at(-1)).toBe('x_c3');
  expect(information?.fields.find((field) => field.key === 'reg')?.label).toBe(
    'Plaque',
  );
  expect(boatSub(boat.info)).toBe('Hanse 325 (2013)');
  expect(infoDiffKeys({ a: '1', b: '' }, { a: '1', c: '2' })).toStrictEqual([
    'b',
    'c',
  ]);
  expect(
    boatSnap(boat, { model: 'Old' }, 'Test', '2026-01-01T00:00:00.000Z'),
  ).toBe(true);
  expect(
    boatSnap(boat, { model: 'Old' }, 'Again', '2026-02-01T00:00:00.000Z'),
  ).toBe(false);
  expect(boat.hist).toStrictEqual([
    { at: '2026-01-01T00:00:00.000Z', from: 'Test', info: { model: 'Old' } },
  ]);
});
