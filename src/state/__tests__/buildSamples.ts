import { intlPhone } from '../../lib/phone.ts';
import { store } from '../../storage/store.ts';
import * as actions from '../actions.ts';
import { data } from '../data.ts';

/**
 * A member card of the state by id.
 * @param id - Member id.
 * @returns The card.
 */
export function memberById(id: string) {
  const member = data.members.value.find((item) => item.id === id);
  if (!member) throw new Error(`unknown member ${id}`);
  return member;
}

/** Same steps as LAKE_OUTING of scripts/parity/scenarios/core.ts, with the state actions. */
export function buildLakeOuting(): void {
  const boat = actions.boatById('savannah');
  if (!boat) throw new Error('no Savannah');
  const outing = actions.blankOuting('Entraînement du 15.07', boat, 'jour');
  outing.purpose = 'Entraînement';
  outing.crew = [
    actions.crewFromMember(memberById('ex2'), 'Skipper'),
    actions.crewFromMember(memberById('ex1'), 'Second'),
    actions.crewFromMember(memberById('ex5'), 'Équipier'),
  ];
  actions.setCruise(outing);
  actions.saveCruise();
  actions.noteUse('boat', boat.id, 'Entraînement');
  actions.addEntry({
    id: 'lk-e1',
    t: '2026-07-15T06:40:00.000Z',
    auto: true,
    v: {
      pos: { lat: 46.5049, lon: 6.4968 },
      sog: 0,
      loch: 0,
      evt: ['Départ'],
      twd: 225,
      tws: 8,
    },
    windSrc: 'trace',
  });
  actions.addEntry({
    id: 'lk-e2',
    t: '2026-07-15T07:10:00.000Z',
    auto: true,
    needWx: true,
    v: {
      pos: { lat: 46.4925, lon: 6.4812 },
      sog: 4.8,
      cog: 222,
      loch: 1.2,
      evt: ['Changement de cap'],
    },
  });
  actions.addEntry({
    id: 'lk-e3',
    t: '2026-07-15T07:25:00.000Z',
    v: {
      quart: 'Thomas Keller',
      allure: 'Près',
      gv: 'Haute',
      avant: 'Foc',
      twd: 230,
      tws: 12,
      feux: 'Prudence',
      mer: '2',
      note: 'Bise qui fraîchit, un ris préparé.',
    },
  });
  actions.addEntry({
    id: 'lk-e4',
    t: '2026-07-15T08:05:00.000Z',
    auto: true,
    v: {
      pos: { lat: 46.4811, lon: 6.4655 },
      sog: 5.4,
      cog: 238,
      loch: 2.9,
      evt: ['Virement'],
    },
  });
  const departure = boat.checklistDep ?? [];
  actions.updateDay('2026-07-15', (day) => {
    Object.assign(day, {
      typeSortie: 'Entraînement',
      skipper: 'Thomas Keller',
      coSkipper: 'Camille Rochat',
      equipage: 'Noa Dubois',
      moteurDebut: '1234,5',
      carbPct: '80',
      batt1: '12,6',
      batt2: '12,5',
      eauPct: '60',
      diesel: '3/4',
      observations: 'Taquet avant tribord à resserrer.',
    });
    day.checkDone = departure.slice(0, 4).map((item) => item.id);
    day.ckOpen = [departure[4]?.id ?? ''];
  });
  store.set('ldb.markSeq', 12);
  actions.updateMarks((marks) => {
    marks.push({
      id: 'mk-lake',
      n: 12,
      name: 'M012',
      at: '2026-07-15T07:30:00.000Z',
      lat: 46.488,
      lon: 6.475,
      depth: '34',
      note: 'Bouée de régate',
    });
  });
  actions.updateMembers((members) => {
    members.push({
      id: 'm-lea',
      prenom: 'Léa',
      nom: 'Favre',
      sexe: 'Femme',
      tel: intlPhone('079 555 12 34'),
      email: 'lea.favre@example.org',
    });
  });
  actions.updateCrewSets((sets) => {
    sets.push({
      id: 'cs-lake',
      name: 'Équipe du mercredi',
      crew: [
        { memberId: 'ex2', fonction: 'Skipper' },
        { memberId: 'm-lea', fonction: 'Équipier' },
      ],
    });
  });
  actions.sosLogAdd('🆘 Touche SOS', 'sos');
  actions.sosLogAdd('Page VHF ouverte');
  actions.sosLogEnd();
}
