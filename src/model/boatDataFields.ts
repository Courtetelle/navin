import {
  autoAdd,
  marginVal,
  pairConv,
  pairManual,
  roundStep,
  stepTxt,
} from '../lib/boatValues.ts';
import { frN } from '../lib/format.ts';

import type { FieldDefinition } from './field.ts';
import { numField as n } from './field.ts';

/** Fields of the "Données techniques" section of the boat sheet. */
export const BOAT_DATA_FIELDS: readonly FieldDefinition[] = [
  {
    key: 'boat',
    label: 'Nom du bateau',
    type: 'line',
    wide: true,
    frame: 'boatId',
  },
  {
    key: 'waters',
    label: 'Navigue',
    type: 'choice',
    options: [['Eaux intérieures'], ['Eaux maritimes']],
    show: {
      'Eaux intérieures': 'en eaux intérieures',
      'Eaux maritimes': 'en eaux maritimes',
    },
    cycle: true,
    wide: true,
    frame: 'boatId',
  },
  { key: 'model', label: 'Modèle', type: 'line', grow: true, frame: 'my' },
  {
    key: 'year',
    label: 'Année',
    type: 'line',
    inputmode: 'numeric',
    frame: 'my',
  },
  {
    key: 'pas',
    label: 'Pas d’hélice en marche arrière',
    type: 'choice',
    options: [['Bâbord'], ['Tribord'], ['Sans']],
    cycle: true,
    show: {
      '': 'Sans',
      Sans: 'Sans',
      Bâbord: '< Bâbord',
      Tribord: 'Tribord >',
    },
    short: true,
    wide: true,
  },
  n('loaFt', 'Longueur', 'pieds', {
    frame: 'len',
    lock: true,
    rule: () => 'calcul : longueur hors-tout ÷ 0,3048',
    auto: (data) => pairConv(data.loa, 1 / 0.3048, 1),
    pair: 'loa',
    manual: (data) => pairManual(data, 'loaFt', 'loa'),
  }),
  n('loa', 'Longueur hors-tout (LOA)', 'm', {
    frame: 'len',
    lock: true,
    rule: () => 'calcul : longueur en pieds × 0,3048',
    auto: (data) => pairConv(data.loaFt, 0.3048, 2),
    pair: 'loaFt',
    manual: (data) => pairManual(data, 'loa', 'loaFt'),
  }),
  n('beam', 'Largeur (bau)', 'm', { lock: true, frame: 'len' }),
  n('draft', 'Tirant d’eau', 'm', { lock: true, frame: 'draft' }),
  n('draftPilot', 'Sondeₘᵢₙ selon traceur', 'm', {
    frame: 'draft',
    lock: true,
    prefix: '≥',
    rule: (settings) =>
      `calcul : tirant d’eau + ${frN(marginVal(settings, 'piedPilote'))} m${stepTxt(settings, 'arrProf')}`,
    auto: (data, settings) =>
      autoAdd(
        data.draft,
        marginVal(settings, 'piedPilote'),
        roundStep(settings, 'arrProf'),
      ),
  }),
  n('airDraft', 'Tirant d’air', 'm', { lock: true, frame: 'air' }),
  n('airMargin', 'Hauteur de passageₘᵢₙ', 'm', {
    frame: 'air',
    lock: true,
    prefix: '≥',
    rule: (settings) =>
      `calcul : tirant d’air + ${frN(marginVal(settings, 'margeHaut'))} m${stepTxt(settings, 'arrHaut')}`,
    auto: (data, settings) =>
      autoAdd(
        data.airDraft,
        marginVal(settings, 'margeHaut'),
        roundStep(settings, 'arrHaut'),
      ),
  }),
  { key: 'voilesAvant', label: 'Voiles', type: 'sails', wide: true },
  {
    key: 'hullColor',
    label: 'Couleur de la coque',
    type: 'line',
    grow: true,
    wide: true,
    en: true,
    frame: 'hull',
    placeholder: 'ex. blanche, bleu marine',
  },
  {
    key: 'marking',
    label: 'Inscription remarquable ou dessin sur la coque',
    type: 'line',
    grow: true,
    wide: true,
    en: true,
    frame: 'hull',
    placeholder: 'ex. nom en lettres rouges, bande bleue, logo',
  },
  {
    key: 'energy',
    label: 'Énergie de propulsion',
    type: 'group',
    wide: true,
    sel: 'propType',
    fields: [
      {
        key: 'propType',
        label: '',
        type: 'choice',
        options: [['Gasoil'], ['Électrique']],
        cycle: true,
        wide: true,
      },
      n('fuelCap', 'Vₘₐₓ gasoil', 'l', {
        when: 'Gasoil',
        addMore: { key: 'fuelCap2', label: '2ᵉᵐᵉ réservoir' },
      }),
      n('fuelCap2', 'Vₘₐₓ gasoil 2ᵉᵐᵉ réservoir', 'l', {
        when: 'Gasoil',
        reveal: true,
      }),
      n('conso', 'Consommation x̄ gasoil', 'l/h', {
        when: 'Gasoil',
        addMore: { key: 'conso2', label: '2ᵉᵐᵉ moteur' },
      }),
      n('conso2', 'Consommation x̄ gasoil 2ᵉᵐᵉ moteur', 'l/h', {
        when: 'Gasoil',
        reveal: true,
      }),
      n('battKwh', 'Eₘₐₓ batteries', 'kWh', {
        when: 'Électrique',
        wide: true,
      }),
      n('genFuelCap', 'Générateur gasoil : Vₘₐₓ réservoir', 'l', {
        when: 'Électrique',
      }),
      n('genConso', 'Générateur gasoil : consommation x̄', 'l/h', {
        when: 'Électrique',
      }),
    ],
  },
  n('waterCap', 'Vₘₐₓ eau potable', 'l', {
    addMore: { key: 'waterCap2', label: '2ᵉᵐᵉ réservoir' },
  }),
  n('waterCap2', 'Vₘₐₓ eau potable 2ᵉᵐᵉ réservoir', 'l', {
    reveal: true,
    addMore: { key: 'waterCap3', label: '3ᵉᵐᵉ réservoir' },
  }),
  n('waterCap3', 'Vₘₐₓ eau potable 3ᵉᵐᵉ réservoir', 'l', { reveal: true }),
];
