import * as actions from '../actions.ts';

import { memberById } from './buildSamples.ts';

/** Same steps as SEA_CRUISE of scripts/parity/scenarios/core.ts, with the state actions. */
export function buildSeaCruise(): void {
  const sea = actions.blankCruise('Croatie 2026', null);
  sea.zone = 'M';
  Object.assign(sea.info, {
    ports: 'Split – Split',
    du: '2026-07-14',
    au: '2026-07-21',
    boat: 'Mistral',
    model: 'Bavaria C42',
    year: '2021',
    waters: 'Eaux maritimes',
    loa: '12,35',
    beam: '4,29',
    draft: '2,10',
    airDraft: '19,6',
    callsign: 'HB1234',
    mmsi: '269000000',
    hullColor: 'Grise',
    coastStation: 'Split Radio',
    base: 'Base de Split, ponton 3 : +385 21 000 000',
    contacts:
      'Urgence (Europe) : 112\nCapitainerie de Split : +385 21 000 001\nLoueur, permanence : +385 91 000 0002',
  });
  sea.crew = [
    actions.crewFromMember(memberById('ex6'), 'Skipper'),
    actions.crewFromMember(memberById('ex4'), 'Second'),
    actions.crewFromMember(memberById('ex3'), 'Équipier'),
    { nom: 'Invité sans fiche', fonction: 'Équipier' },
  ];
  actions.setCruise(sea);
  actions.saveCruise();
  actions.addEntry({
    id: 'sea-e1',
    t: '2026-07-14T07:00:00.000Z',
    v: {
      pos: { lat: 43.5047, lon: 16.4393 },
      loch: 0,
      sog: 0,
      evt: ['Départ', 'Début moteur'],
      baro: 1016,
      visi: 'TB',
      quart: 'Elena García',
    },
  });
  actions.addEntry({
    id: 'sea-e2',
    t: '2026-07-14T09:00:00.000Z',
    v: {
      pos: { lat: 43.4012, lon: 16.3001 },
      loch: 9.6,
      sog: 5.5,
      hdg: 215,
      cog: 212,
      allure: 'Travers',
      twd: 300,
      tws: 14,
      mer: '3',
      vagues: 290,
      gv: 'Haute',
      avant: 'Génois',
      evt: ['Fin moteur', 'Début voile'],
      baro: 1015,
    },
  });
  actions.addEntry({
    id: 'sea-e3',
    t: '2026-07-14T13:30:00.000Z',
    v: {
      pos: { lat: 43.1721, lon: 16.441 },
      loch: 24.3,
      sog: 0,
      evt: ['Arrivée', 'Mouillage'],
      note: 'Mouillage à Hvar, fond de sable.',
    },
  });
  actions.addEntry({
    id: 'sea-e4',
    t: '2026-07-15T06:15:00.000Z',
    v: {
      pos: { lat: 43.1721, lon: 16.441 },
      loch: 24.3,
      evt: ['Départ'],
      baro: 1012,
      tws: 18,
      twd: 320,
    },
  });
  actions.addEntry({
    id: 'sea-e5',
    t: '2026-07-15T08:00:00.000Z',
    auto: true,
    needWx: true,
    v: {
      pos: { lat: 43.0607, lon: 16.183 },
      loch: 37.1,
      sog: 6.2,
      cog: 245,
      evt: ['Changement de cap'],
    },
  });
  actions.updateDay(
    '2026-07-14',
    (day) => {
      Object.assign(day, {
        de: 'Split',
        a: 'Hvar',
        fVentDir: '300',
        fVentVit: '14',
        fPression: '1016',
        moteurSoir: '1520,5',
        plein: '',
        nmJour: '24,3',
        ctrl: ['Eau douce relevée', 'VHF ON, squelch'],
        dest: 'Hvar',
        canal: '17',
        debrief: 'Belle journée, mouillage calme.',
      });
    },
    { save: false },
  );
  actions.updateDay(
    '2026-07-15',
    (day) => {
      Object.assign(day, {
        de: 'Hvar',
        a: 'Vis',
        fVentDir: '320',
        fVentVit: '18',
        fRafales: '25',
        etd: '08:00',
        eta: '15:00',
      });
    },
    { save: false },
  );
  actions.updateCruise((cruise) => {
    Object.assign(cruise.info, { moteurInit: '1515' });
  });
}
